import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "../db";
import { recordOutreachEvent } from "./outreach-events";
import { ownerOrDefault } from "./automation";
import { parisDayRange } from "../domain/mailbox-cap";
import { contactTitle } from "../domain/contact-identity";
import {
  MANUAL_COUNT_PREFIX,
  MAX_BATCH,
  channelOfRow,
  entryIdOf,
  entryPrefix,
  manualCountKey,
  manualShape,
  tally,
  type ManualChannel,
  type ManualTally,
} from "../domain/manual-count";
import type { OutreachType } from "../domain/outreach";

/**
 * **Les trois faits qu'aucune machine ne peut constater.**
 *
 * « Démo envoyée », « Démo testée », « Retour reçu » : une démo part par un
 * canal que le CRM ne voit pas toujours, et un retour se dit au téléphone. Les
 * trois se posent donc à la main, depuis la fiche ou l'affaire, et chacun écrit
 * **un** événement de source `manual`.
 *
 * Deux décisions :
 *
 * - **Annulable.** Le geste est un interrupteur, pas une écriture définitive :
 *   se tromper de fiche arrive, et une démo qualifiée à tort fausse le seul
 *   chiffre sur lequel on décide d'insister. Retirer « Retour reçu » retire la
 *   qualification, par construction — `qualifiedAt` exige les trois.
 * - **Un seul événement par fiche et par type.** L'identifiant externe est
 *   déterministe (`manual:<type>:<contact>`), donc recliquer ne double pas le
 *   fait. La contrainte d'unicité le garantit ; une vérification applicative
 *   serait contournable par deux clics simultanés (jalon 8).
 *
 * `demo_tested` peut aussi naître d'un clic sur le lien de la démonstration
 * (jalon 92, `recordClick`) : les deux chemins écrivent le même type, avec deux
 * identifiants distincts — le clic est un fait, la saisie en est un autre, et
 * `qualifiedAt` ne compte de toute façon la personne qu'une fois.
 */

export const MANUAL_TYPES: readonly OutreachType[] = [
  "demo_sent",
  "demo_tested",
  "feedback_received",
];

export function isManualType(value: string): value is OutreachType {
  return (MANUAL_TYPES as readonly string[]).includes(value);
}

function keyOf(type: OutreachType, contactId: string): string {
  return `manual:${type}:${contactId}`;
}

export interface ManualEventResult {
  readonly ok: boolean;
  readonly message: string;
  /** L'état après le geste : l'écran s'en sert pour rendre l'interrupteur. */
  readonly present: boolean;
}

export async function setManualEvent(
  contactId: string,
  type: OutreachType,
  present: boolean,
  now = new Date(),
): Promise<ManualEventResult> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { companyId: true, owner: true },
  });
  if (contact === null) return { ok: false, message: "Fiche introuvable.", present: false };

  const externalId = keyOf(type, contactId);

  if (!present) {
    // Annuler ne retire que l'événement **saisi à la main** : un clic réel sur
    // le lien de la démonstration est un fait, et l'écran ne doit pas pouvoir
    // l'effacer.
    const removed = await prisma.outreachEvent.deleteMany({
      where: { source: "manual", externalId },
    });
    return {
      ok: true,
      message: removed.count > 0 ? "Retiré." : "Il n'y avait rien à retirer.",
      present: false,
    };
  }

  const created = await recordOutreachEvent(prisma, {
    contactId,
    companyId: contact.companyId,
    channel: "other",
    type,
    occurredAt: now,
    owner: await ownerOrDefault(prisma, contact.owner),
    source: "manual",
    externalId,
  });

  return {
    ok: true,
    message: created ? "Consigné." : "C'était déjà consigné.",
    present: true,
  };
}

/** Lesquels des trois sont posés sur cette fiche, saisis ou constatés. */
export async function readManualState(
  contactId: string,
): Promise<Record<string, boolean>> {
  const rows = await prisma.outreachEvent.findMany({
    where: { contactId, type: { in: [...MANUAL_TYPES] } },
    select: { type: true },
  });
  const state: Record<string, boolean> = {};
  for (const type of MANUAL_TYPES) state[type] = false;
  for (const row of rows) state[row.type] = true;
  return state;
}

/* ========================================================================== *
 *  Le compteur de messages manuels (jalon 112)
 * ========================================================================== */

/**
 * **Compter ce qu'aucun outil ne voit partir.**
 *
 * Les messages automatiques arrivent par la synchronisation lemlist (jalon
 * 111) ; les emails du CRM par le journal des envois (jalon 32). Restent les
 * gestes faits à la main — un DM LinkedIn, une invitation, un WhatsApp depuis
 * le téléphone, un DM Instagram, un appel — qui n'étaient comptés nulle part.
 *
 * ## Pourquoi ce n'est pas `logActivity`
 *
 * `logActivity` écrit déjà un `message_sent` pour un appel, un message LinkedIn
 * ou un DM Instagram (jalon 109, par `eventForActivity`). Trois choses lui
 * manquent, et c'est tout l'écart : il **exige une fiche**, il ne connaît pas
 * WhatsApp (`ACTIVITY_TYPES` n'a pas ce canal), et il crée une tâche de
 * prochaine action — trop lourd pour cocher trois DM depuis un téléphone.
 *
 * **Le compteur n'écrit donc que dans le journal d'événements, jamais une
 * interaction.** Écrire les deux doublerait le message, puisque l'interaction
 * produit déjà son événement : c'est le double compte que le jalon 109
 * interdit. Conséquence à dire, et elle est réelle — un message compté ici
 * n'apparaît pas dans la chronologie de la fiche et n'avance pas sa date de
 * dernière touche. « Consigner un appel » reste le geste pour cela, et il
 * compte déjà.
 *
 * ## Un lot s'annule d'un geste
 *
 * Un « +5 » écrit **cinq** événements : cinq messages sont cinq faits. Mais
 * « Annuler » doit retirer les cinq, sinon le geste d'annulation ne défait pas
 * le geste de saisie. Les cinq lignes partagent donc un préfixe d'identifiant
 * externe (`manual-count:<lot>:<rang>`), et un `deleteMany` sur ce préfixe
 * défait exactement une saisie — sans colonne de regroupement ajoutée, et sans
 * rien changer à l'idempotence `(source, externalId)` ligne à ligne.
 */

export interface ManualCountInput {
  readonly channel: ManualChannel;
  readonly quantity: number;
  readonly owner: string;
  /** `null` : le message est compté sans destinataire enregistré. */
  readonly contactId: string | null;
  /** Antidatage, borné à sept jours par `readEntryDate`. */
  readonly at: Date;
}

export interface ManualCountResult {
  readonly ok: boolean;
  readonly message: string;
  /** Le lot écrit, pour que « Annuler » sache quoi défaire. */
  readonly entryId: string;
  readonly written: number;
}

/**
 * Écrit une saisie du compteur.
 *
 * Les `quantity` lignes portent **le même instant** : elles consignent une
 * session de prospection, pas cinq horodatages qu'on aurait inventés en les
 * espaçant d'une minute. Un instant faux serait pire qu'un instant partagé.
 */
export async function logManualMessages(
  input: ManualCountInput,
): Promise<ManualCountResult> {
  const shape = manualShape(input.channel);

  let companyId: string | null = null;
  if (input.contactId !== null) {
    const contact = await prisma.contact.findUnique({
      where: { id: input.contactId },
      select: { companyId: true },
    });
    if (contact === null) {
      return { ok: false, message: "Fiche introuvable.", entryId: "", written: 0 };
    }
    companyId = contact.companyId;
  }

  const owner = await ownerOrDefault(prisma, input.owner);
  const entryId = randomUUID();

  let written = 0;
  for (let index = 0; index < input.quantity; index += 1) {
    const created = await recordOutreachEvent(prisma, {
      contactId: input.contactId,
      companyId,
      channel: shape.channel,
      type: shape.type,
      occurredAt: input.at,
      owner,
      source: "manual",
      externalId: manualCountKey(entryId, index),
      detail: shape.detail,
    });
    if (created) written += 1;
  }

  return {
    ok: true,
    message:
      written === 1
        ? `1 ${shape.label} compté.`
        : `${written} ${shape.label} comptés.`,
    entryId,
    written,
  };
}

/**
 * Défait un lot entier.
 *
 * `deleteMany` sur le préfixe, et non sur les identifiants un par un : le
 * nombre de lignes du lot n'a pas à être reporté à l'écran pour que
 * l'annulation soit juste.
 */
export async function undoManualEntry(entryId: string): Promise<{
  readonly ok: boolean;
  readonly message: string;
  readonly removed: number;
}> {
  if (entryId.trim() === "") return { ok: false, message: "Saisie inconnue.", removed: 0 };

  const removed = await prisma.outreachEvent.deleteMany({
    where: { source: "manual", externalId: { startsWith: entryPrefix(entryId) } },
  });
  return {
    ok: removed.count > 0,
    message:
      removed.count > 0
        ? `${removed.count} ${removed.count > 1 ? "messages retirés" : "message retiré"}.`
        : "Il n'y avait rien à retirer.",
    removed: removed.count,
  };
}

/* ------------------------------------------------------------ la lecture --- */

export interface ManualEntry {
  readonly entryId: string;
  readonly channel: ManualChannel;
  readonly label: string;
  readonly count: number;
  readonly at: Date;
  readonly owner: string;
  readonly contactId: string | null;
  readonly contactName: string;
}

export interface ManualCounterState {
  /** Le décompte du jour de Paris, canal par canal, zéros compris. */
  readonly today: readonly ManualTally[];
  /** Les vingt dernières saisies, la plus récente d'abord. */
  readonly history: readonly ManualEntry[];
  readonly owners: readonly string[];
}

/** Les lignes écrites par le compteur, les plus récentes d'abord. */
async function counterRows(limit: number) {
  return prisma.outreachEvent.findMany({
    where: { source: "manual", externalId: { startsWith: MANUAL_COUNT_PREFIX } },
    orderBy: { occurredAt: "desc" },
    take: limit,
    select: {
      externalId: true,
      channel: true,
      type: true,
      detail: true,
      occurredAt: true,
      owner: true,
      contactId: true,
      contact: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          instagram: true,
          company: { select: { name: true } },
        },
      },
    },
  });
}

/**
 * Ce que le bloc affiche.
 *
 * **Le décompte du jour se lit au jour de Paris**, par `parisDayRange` — la
 * même fonction que le plafond d'envoi (jalon 100). Compter au jour UTC ferait
 * basculer « aujourd'hui » à une heure du matin en été, c'est-à-dire pendant
 * qu'on prospecte encore.
 */
export async function readManualCounter(now = new Date()): Promise<ManualCounterState> {
  const day = parisDayRange(now);

  const [todayRows, recent, owners] = await Promise.all([
    prisma.outreachEvent.findMany({
      where: {
        source: "manual",
        externalId: { startsWith: MANUAL_COUNT_PREFIX },
        occurredAt: { gte: day.start, lt: day.end },
      },
      select: { channel: true, type: true, detail: true },
    }),
    // On lit large puis on regroupe : vingt **saisies** peuvent peser jusqu'à
    // vingt fois `MAX_BATCH` lignes, et tronquer avant le regroupement
    // couperait un lot en deux.
    counterRows(20 * MAX_BATCH),
    prisma.settingsList.findMany({
      where: { kind: "owners" },
      orderBy: { position: "asc" },
      select: { value: true },
    }),
  ]);

  const grouped = new Map<string, ManualEntry>();
  for (const row of recent) {
    const entryId = entryIdOf(row.externalId);
    const channel = channelOfRow(row);
    if (entryId === null || channel === null) continue;

    const known = grouped.get(entryId);
    if (known !== undefined) {
      grouped.set(entryId, { ...known, count: known.count + 1 });
      continue;
    }
    grouped.set(entryId, {
      entryId,
      channel,
      label: manualShape(channel).label,
      count: 1,
      at: row.occurredAt,
      owner: row.owner,
      contactId: row.contactId,
      contactName:
        row.contact === null
          ? ""
          : contactTitle({
              firstName: row.contact.firstName,
              lastName: row.contact.lastName,
              company: row.contact.company,
              email: row.contact.email,
              instagram: row.contact.instagram,
            }),
    });
  }

  return {
    today: tally(todayRows),
    history: [...grouped.values()].slice(0, 20),
    owners: owners.map((row) => row.value).filter((value) => value !== ""),
  };
}
