import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { REAL_ACTIVITY } from "./real-activity";
import { ANSWERED_OUTCOMES } from "../domain/status";
import {
  toChannel,
  type OutreachChannel,
  type OutreachSource,
  type OutreachType,
} from "../domain/outreach";
import { NO_CONTACT_LABEL, type EventRow } from "../domain/pilotage";
import { sizeBucketOf } from "../domain/size-buckets";
import { groupLabel } from "../domain/contact-group";
import { contactTitle } from "../domain/contact-identity";
import type { ActivityType } from "../domain/types";

/**
 * **Le seul écrivain du journal, et le seul lecteur du pilotage.**
 *
 * Un événement s'écrit là où le fait est **déjà** consigné aujourd'hui, et dans
 * la même transaction quand il y en a une : une interaction écrite sans son
 * événement produirait un tableau de bord qui ignore du travail réel, et
 * l'écart ne se verrait nulle part.
 *
 * ## Aucun double compte, et c'est la décision qui structure ce module
 *
 * Un email envoyé depuis le CRM laisse **deux** traces depuis le jalon 32 : une
 * ligne dans `email_sends` et une interaction de type `email`. Écrire un
 * événement des deux côtés doublerait chaque message envoyé — et le chiffre
 * serait faux de 100 % sans qu'aucun test ne rougisse.
 *
 * La règle est donc : **les emails viennent du journal des envois, les autres
 * canaux des interactions.** `eventForActivity` rend `null` pour une
 * interaction de type `email`, et une garde statique le vérifie.
 */

/* ---------------------------------------------------------- l'écriture ---- */

export interface OutreachEventInput {
  /**
   * `null` depuis le jalon 112 : le compteur manuel consigne des messages dont
   * le destinataire n'est pas enregistré. Tout le reste du produit écrit
   * toujours une fiche, et les indicateurs « par personne » sautent ces lignes
   * par `contactsOf`.
   */
  readonly contactId: string | null;
  readonly companyId?: string | null;
  readonly campaignId?: string | null;
  /**
   * La campagne **chez la source**, quand elle n'a pas de ligne dans le CRM.
   * Vide pour tout ce que le CRM produit lui-même.
   */
  readonly extCampaignId?: string;
  readonly extCampaignName?: string;
  readonly channel: OutreachChannel;
  readonly type: OutreachType;
  readonly occurredAt: Date;
  readonly owner?: string;
  readonly source?: OutreachSource;
  readonly externalId?: string | null;
  readonly replyCategory?: string;
  /**
   * **L'étape de séquence chez la source**, quand le fait en vient.
   *
   * `null` — le défaut — se lit « hors séquence », et c'est le cas de tout ce
   * que le CRM et le compteur manuel écrivent. L'onglet Campagnes en tire le
   * résultat par étape : savoir que la relance 3 ne produit rien est ce qui
   * permet de la retirer, et un total de campagne ne le dit pas.
   */
  readonly stepIndex?: number | null;
  readonly stepType?: string;
  readonly detail?: string;
}

/** Ce qu'un client Prisma ou une transaction ont tous deux en commun. */
type Writer = Pick<Prisma.TransactionClient, "outreachEvent">;

/**
 * Écrit un événement, et **avale le doublon** plutôt que de lever.
 *
 * La contrainte `(source, externalId)` est la déduplication de la
 * synchronisation à venir : deux passages posant le même identifiant doivent
 * produire une ligne, pas une erreur. C'est la posture d'`autoKey` (jalon 8) —
 * la base tranche, pas une vérification applicative que deux appels simultanés
 * contourneraient.
 *
 * Rend `true` quand la ligne a été créée.
 */
export async function recordOutreachEvent(
  writer: Writer,
  input: OutreachEventInput,
): Promise<boolean> {
  try {
    await writer.outreachEvent.create({
      data: {
        contactId: input.contactId,
        companyId: input.companyId ?? null,
        campaignId: input.campaignId ?? null,
        extCampaignId: input.extCampaignId ?? "",
        extCampaignName: input.extCampaignName ?? "",
        channel: input.channel,
        type: input.type,
        occurredAt: input.occurredAt,
        owner: input.owner ?? "",
        source: input.source ?? "crm",
        externalId: input.externalId ?? null,
        replyCategory: input.replyCategory ?? "",
        stepIndex: input.stepIndex ?? null,
        stepType: input.stepType ?? "",
        detail: input.detail ?? "",
      },
    });
    return true;
  } catch (error) {
    // Déjà enregistré par un autre passage : la contrainte a fait son travail.
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * Le canal et le type d'une interaction consignée, ou `null` si elle n'est pas
 * de la prospection.
 *
 * Deux refus, et ils sont la raison d'être de cette fonction :
 *
 * - **`email` rend `null`** : l'envoi est déjà compté par `email_sends`. Voir le
 *   paragraphe sur le double compte en tête de module ;
 * - **`note` rend `null`** : une note n'est pas une touche. Les notes de
 *   correction en sont d'ailleurs exclues par `REAL_ACTIVITY` (jalon 27).
 *
 * `instagram` tombe dans `other` et le dit dans `detail` : les six canaux sont
 * ceux de lemlist, et en ajouter un septième que la synchronisation ne connaît
 * pas se paierait au jalon suivant.
 */
export function eventForActivity(
  type: ActivityType,
): { readonly channel: OutreachChannel; readonly type: OutreachType; readonly detail: string } | null {
  switch (type) {
    case "call":
      return { channel: "call", type: "message_sent", detail: "" };
    case "linkedin":
      return { channel: "linkedin_message", type: "message_sent", detail: "" };
    case "instagram":
      return { channel: "other", type: "message_sent", detail: "DM Instagram" };
    case "meeting":
      return { channel: "other", type: "meeting_held", detail: "Réunion" };
    case "demo":
      return { channel: "other", type: "meeting_held", detail: "Démo tenue" };
    case "email":
    case "note":
      return null;
  }
}

/**
 * La catégorie de réponse qui correspond à une issue d'interaction.
 *
 * **Ce n'est pas une déduction, c'est une traduction** : l'issue a été choisie à
 * la main dans un formulaire, et les deux vocabulaires disent la même chose.
 * `replied` reste sans catégorie — le relevé IMAP ne lit que des en-têtes, il
 * sait qu'il y a une réponse et rien de plus (jalon 41), et lui attribuer une
 * couleur serait exactement l'invention que ce jalon refuse.
 */
export function categoryForOutcome(outcome: string): string {
  switch (outcome) {
    case "interested":
      return "interested";
    case "later":
      return "not_now";
    case "not-interested":
      return "not_interested";
    case "wrong-person":
      return "wrong_person";
    case "meeting":
      return "interested";
    default:
      return "";
  }
}

/* ------------------------------------------------------- la reprise ------- */

export type BackfillCounts = Record<string, number>;

export interface BackfillReport {
  readonly before: BackfillCounts;
  readonly after: BackfillCounts;
  readonly written: BackfillCounts;
}

async function countsByType(): Promise<BackfillCounts> {
  const rows = await prisma.outreachEvent.groupBy({ by: ["type"], _count: { _all: true } });
  const counts: BackfillCounts = {};
  for (const row of rows) counts[row.type] = row._count._all;
  return counts;
}

/**
 * **Reprend ce que le CRM porte déjà, sans rien y toucher.**
 *
 * Lecture seule sur les tables sources : aucun envoi, aucune réponse, aucun
 * clic, aucune interaction n'est modifié ni supprimé. Chaque type a **une**
 * source, choisie pour qu'aucun fait ne soit compté deux fois :
 *
 * | Type | Source | Pourquoi celle-là |
 * |---|---|---|
 * | `message_sent` / email | `email_sends` | porte la campagne et le signataire ; l'interaction jumelle serait un doublon |
 * | `message_sent` / autres canaux | `activities` | un appel, un message LinkedIn, un DM n'ont pas de ligne d'envoi |
 * | `reply_received` | `activities` à issue de réponse | toute réponse relevée consigne une interaction (jalon 41) : lire aussi `email_replies` doublerait chaque réponse |
 * | `meeting_booked` | interactions à issue « RDV obtenu » | c'est la définition de `metAt` (jalon 39) |
 * | `meeting_held` | interactions de type réunion ou démo | un rendez-vous tenu est un fait consigné |
 * | `demo_tested` | clics sur le lien de la démonstration | même identifiant que le chemin vivant, donc aucun doublon |
 * | `customer_won` | affaires gagnées | `closedAt` est la date du fait |
 *
 * Les cinq types restants — `bounce`, `linkedin_invite_sent`,
 * `linkedin_invite_accepted`, `demo_sent`, `feedback_received`,
 * `trial_started` — **n'ont aucune source dans l'historique**, et c'est dit
 * plutôt que rempli : les rebonds ne sont pas stockés (le relevé les écarte,
 * jalon 41), les invitations LinkedIn ne l'ont jamais été comme telles, et les
 * trois dernières sont des notions que ce jalon introduit. Leur compte de
 * reprise est donc zéro, ce qui est le fait — et non une estimation.
 *
 * Idempotent : rejouer la reprise ne crée rien, parce que chaque ligne reprise
 * porte un `externalId` déterministe dérivé de sa source.
 */
export async function backfillOutreachEvents(): Promise<BackfillReport> {
  const before = await countsByType();

  const sends = await prisma.emailSend.findMany({
    select: {
      id: true,
      contactId: true,
      sentAt: true,
      subject: true,
      signatoryName: true,
      campaignId: true,
      contact: { select: { companyId: true, owner: true } },
    },
  });
  for (const send of sends) {
    if (send.contactId === null) continue;
    await recordOutreachEvent(prisma, {
      contactId: send.contactId,
      companyId: send.contact?.companyId ?? null,
      campaignId: send.campaignId === "" ? null : send.campaignId,
      channel: "email",
      type: "message_sent",
      occurredAt: send.sentAt,
      owner: send.contact?.owner ?? "",
      source: "crm",
      externalId: `send:${send.id}`,
      detail: send.subject,
    });
  }

  /*
    **Les clics déjà enregistrés comptent, eux aussi.**

    Le chemin vivant écrit « démo testée » au clic sur le lien de la
    démonstration (`recordClick`, jalon 92 pour le clic, 109 pour l'événement).
    Les clics d'avant ce jalon seraient restés muets : une démo réellement
    testée la semaine dernière aurait manqué au tableau de bord, et l'écart
    n'aurait eu aucun endroit où se voir.

    L'identifiant est **exactement celui du chemin vivant**
    (`demo-tested:<envoi>`) : reprendre un clic déjà consigné ne crée rien, et
    deux clics du même destinataire ne font pas deux démos testées — il a testé
    une fois. `kind: "video"` et non `"demo"` : voir le piège des noms dans
    `recordClick`, où `demo` est le lien de prise de rendez-vous.
  */
  const videoClicks = await prisma.emailLinkClick.findMany({
    where: { kind: "video" },
    orderBy: { at: "asc" },
    select: {
      at: true,
      emailSend: {
        select: {
          id: true,
          contactId: true,
          campaignId: true,
          contact: { select: { companyId: true, owner: true } },
        },
      },
    },
  });
  for (const click of videoClicks) {
    const send = click.emailSend;
    if (send === null || send.contactId === null) continue;
    await recordOutreachEvent(prisma, {
      contactId: send.contactId,
      companyId: send.contact?.companyId ?? null,
      campaignId: send.campaignId === "" ? null : send.campaignId,
      channel: "email",
      type: "demo_tested",
      occurredAt: click.at,
      owner: send.contact?.owner ?? "",
      source: "crm",
      externalId: `demo-tested:${send.id}`,
      detail: "Clic sur le lien de la démonstration",
    });
  }

  const activities = await prisma.activity.findMany({
    where: { ...REAL_ACTIVITY, contactId: { not: null } },
    select: {
      id: true,
      type: true,
      date: true,
      outcome: true,
      owner: true,
      contactId: true,
      contact: { select: { companyId: true } },
    },
  });

  /*
    **Les réponses viennent des interactions, et d'elles seules.**

    `email_replies` aurait semblé la source naturelle, et elle aurait produit un
    double compte : toute réponse rapprochée par le relevé consigne une
    interaction d'issue « Répondu » (jalon 41), et c'est cette interaction que le
    chemin vivant transforme en événement. Reprendre les deux aurait écrit deux
    `reply_received` pour une seule réponse — faux de 100 %, et invisible.

    Le cas où le relevé n'écrit pas d'interaction est celui de la réponse **sans
    fiche rattachée** (jalon 45) : rien n'est consigné sur personne, et le
    bandeau rouge de l'accueil le dit déjà. Il n'y a donc rien à reprendre.
  */
  for (const activity of activities) {
    const contactId = activity.contactId;
    if (contactId === null) continue;
    const companyId = activity.contact?.companyId ?? null;
    const shape = eventForActivity(activity.type as ActivityType);

    if (shape !== null) {
      await recordOutreachEvent(prisma, {
        contactId,
        companyId,
        channel: shape.channel,
        type: shape.type,
        occurredAt: activity.date,
        owner: activity.owner,
        source: "crm",
        externalId: `activity:${activity.id}`,
        detail: shape.detail,
      });
    }

    // Toute issue qui vaut réponse, relevée ou saisie à la main : la règle est
    // celle d'`ANSWERED_OUTCOMES` (jalon 27), partagée avec le taux de réponse.
    if ((ANSWERED_OUTCOMES as readonly string[]).includes(activity.outcome)) {
      await recordOutreachEvent(prisma, {
        contactId,
        companyId,
        channel: toChannel(activity.type === "call" ? "call" : "other"),
        type: "reply_received",
        occurredAt: activity.date,
        owner: activity.owner,
        source: "crm",
        externalId: `activity-reply:${activity.id}`,
        replyCategory: categoryForOutcome(activity.outcome),
      });
    }

    if (activity.outcome === "meeting") {
      await recordOutreachEvent(prisma, {
        contactId,
        companyId,
        channel: "other",
        type: "meeting_booked",
        occurredAt: activity.date,
        owner: activity.owner,
        source: "crm",
        externalId: `activity-meeting:${activity.id}`,
      });
    }
  }

  const won = await prisma.deal.findMany({
    where: { status: "won", contactId: { not: null } },
    select: { id: true, contactId: true, companyId: true, closedAt: true, createdAt: true, owner: true },
  });
  for (const deal of won) {
    if (deal.contactId === null) continue;
    await recordOutreachEvent(prisma, {
      contactId: deal.contactId,
      companyId: deal.companyId,
      channel: "other",
      type: "customer_won",
      // `closedAt` est la date du fait ; à défaut la création, pour qu'une
      // affaire gagnée sans date de clôture ne disparaisse pas du journal.
      occurredAt: deal.closedAt ?? deal.createdAt,
      owner: deal.owner,
      source: "crm",
      externalId: `deal-won:${deal.id}`,
    });
  }

  const after = await countsByType();
  const written: BackfillCounts = {};
  for (const type of new Set([...Object.keys(before), ...Object.keys(after)])) {
    written[type] = (after[type] ?? 0) - (before[type] ?? 0);
  }
  return { before, after, written };
}

/* --------------------------------------------------------- la lecture ----- */

/**
 * **Toutes les lignes, et le filtrage a lieu dans le domaine.**
 *
 * Borner la requête à la période aurait été plus économique et faux : « nouvelle
 * personne contactée » demande de savoir si elle a été touchée **avant** la
 * période, et la qualification d'une démo peut s'étaler sur deux semaines. Le
 * service rend donc l'histoire, et `lib/domain/pilotage.ts` en tire ce que
 * chaque chiffre demande.
 */
export async function readEventRows(): Promise<EventRow[]> {
  const rows = await prisma.outreachEvent.findMany({
    orderBy: { occurredAt: "asc" },
    select: {
      id: true,
      contactId: true,
      campaignId: true,
      extCampaignId: true,
      extCampaignName: true,
      channel: true,
      type: true,
      occurredAt: true,
      owner: true,
      source: true,
      detail: true,
      replyCategory: true,
      stepIndex: true,
      stepType: true,
      campaign: { select: { name: true } },
      company: { select: { name: true, monthlyVisitors: true, niche: true } },
      contact: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          instagram: true,
          contactGroup: true,
          groupSetBy: true,
          company: { select: { name: true } },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    contactId: row.contactId,
    /*
      **« Sans contact » est un libellé, pas une fiche vide.**

      Depuis le jalon 112 une ligne peut n'avoir personne derrière elle : un
      message compté au compteur manuel sans destinataire enregistré. La liste
      d'un chiffre doit alors afficher quelque chose, sinon son nombre de lignes
      cesse d'égaler le nombre annoncé — et c'est l'invariant du jalon 109.
    */
    contactName:
      row.contact === null
        ? NO_CONTACT_LABEL
        : contactTitle({
            firstName: row.contact.firstName,
            lastName: row.contact.lastName,
            company: row.contact.company,
            email: row.contact.email,
            instagram: row.contact.instagram,
          }),
    companyName: row.company?.name ?? row.contact?.company?.name ?? "",
    campaignId: row.campaignId,
    campaignName: row.campaign?.name ?? "",
    extCampaignId: row.extCampaignId,
    extCampaignName: row.extCampaignName,
    channel: toChannel(row.channel),
    type: row.type as EventRow["type"],
    occurredAt: row.occurredAt,
    owner: row.owner,
    source: row.source,
    replyCategory: row.replyCategory,
    /*
      La taille et la niche sont lues sur la **société recopiée sur
      l'événement**, pas sur celle du contact : une fiche peut changer de maison
      après coup, et l'histoire mesurée n'a pas à bouger avec elle (c'est la
      raison d'être de `companyId` sur l'événement, jalon 109).
    */
    size: sizeBucketOf(row.company?.monthlyVisitors ?? null),
    niche: row.company?.niche ?? "",
    group: groupLabel(row.contact?.contactGroup ?? "", row.contact?.groupSetBy ?? ""),
    stepIndex: row.stepIndex,
    stepType: row.stepType,
  }));
}
