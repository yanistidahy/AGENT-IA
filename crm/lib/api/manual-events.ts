import "server-only";
import { prisma } from "../db";
import { recordOutreachEvent } from "./outreach-events";
import { ownerOrDefault } from "./automation";
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
