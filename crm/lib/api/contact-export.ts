import "server-only";
import { prisma } from "../db";
import { REAL_ACTIVITY } from "./real-activity";
import { ANSWERED_OUTCOMES } from "../domain/status";
import { latestReply, replyFloor, SENDING_ENROLLMENT_STATUS } from "../domain/reply-stop";
import { readHotProspects } from "./hot-prospects";

/**
 * **Ce que l'export sait en plus de la fiche, lu une fois pour toute la page.**
 *
 * Trois faits que `ContactRecord` ne porte pas : la campagne en cours, la
 * réponse, et la chaleur. Aucun n'est recalculé ici — chacun vient de la
 * fonction qui le décide déjà ailleurs dans le produit :
 *
 * - **« a répondu »** réunit les deux sources par `latestReply` (jalon 106) :
 *   l'interaction consignée **et** la détection du relevé IMAP. C'est le même
 *   combinateur que celui qui arrête les relances, et c'est voulu : la colonne
 *   doit dire « non » exactement quand une relance partirait encore ;
 * - **« prospect chaud »** vient de `readHotProspects`, la source unique du
 *   jalon 105 — le même ensemble que le compte de l'écran Tâches et que
 *   `/contacts?chauds=1`. Un second calcul aurait fini par exporter un « oui »
 *   que la liste filtrée ne rend pas ;
 * - **la campagne** lit `SENDING_ENROLLMENT_STATUS`, la constante du jalon 106 :
 *   seule une inscription active est « en cours ».
 *
 * **Rien n'est écrit.** Un export est une consultation, et une consultation qui
 * écrit n'est plus une consultation (jalon 8) : une garde statique vérifie qu'il
 * n'y a dans ce fichier aucun `create`, `update`, `delete` ni `upsert`.
 *
 * Pourquoi pas `readReplyFacts` (jalon 39), qui porte déjà « a répondu » ? Parce
 * qu'elle est **ancrée au premier envoi** : elle mesure ce que les emails
 * produisent, et une réponse antérieure à notre premier message n'y compte pas,
 * à juste titre. Ici la question est autre — « cette personne nous a-t-elle
 * répondu ? » — et l'ancrage au premier envoi répondrait « non » pour quelqu'un
 * qui a répondu à un message écrit à la main depuis sa fiche. D'où `replyFloor`
 * sans borne, et la raison écrite ici pour qu'on ne « simplifie » pas vers la
 * mauvaise définition.
 */

export interface ContactExportExtra {
  /** Nom de la campagne dont l'inscription est active, vide s'il n'y en a pas. */
  readonly campaign: string;
  /** Étapes déjà envoyées, et combien la séquence en porte. */
  readonly lastStep: number;
  readonly totalSteps: number;
  readonly replied: boolean;
  readonly hot: boolean;
}

const EMPTY: ContactExportExtra = {
  campaign: "",
  lastStep: 0,
  totalSteps: 0,
  replied: false,
  hot: false,
};

export function extraOf(
  extras: ReadonlyMap<string, ContactExportExtra>,
  contactId: string,
): ContactExportExtra {
  return extras.get(contactId) ?? EMPTY;
}

export async function readExportExtras(
  contactIds: readonly string[],
  now = new Date(),
): Promise<Map<string, ContactExportExtra>> {
  const extras = new Map<string, ContactExportExtra>();
  if (contactIds.length === 0) return extras;

  const ids = [...contactIds];
  const floor = replyFloor(null);

  const [answers, replies, enrollments, hot] = await Promise.all([
    prisma.activity.findMany({
      where: {
        ...REAL_ACTIVITY,
        contactId: { in: ids },
        outcome: { in: [...ANSWERED_OUTCOMES] },
        ...(floor === null ? {} : { date: { gte: floor } }),
      },
      select: { contactId: true, date: true },
      orderBy: { date: "desc" },
    }),
    prisma.emailReply.findMany({
      where: { contactId: { in: ids } },
      select: { contactId: true, receivedAt: true },
      orderBy: { receivedAt: "desc" },
    }),
    /*
      **La plus récente des inscriptions actives.** Quelqu'un peut être inscrit
      à deux campagnes à la fois : empiler deux noms dans une case rendrait la
      colonne illisible et contredirait « une valeur par colonne ». La plus
      récente est celle qui décrit le travail en cours, et c'est elle qu'on
      exporte — le tableau des inscrits de chaque campagne porte le détail.
    */
    prisma.sequenceEnrollment.findMany({
      where: { contactId: { in: ids }, status: SENDING_ENROLLMENT_STATUS },
      select: {
        contactId: true,
        lastStep: true,
        enrolledAt: true,
        sequence: {
          select: {
            name: true,
            campaign: { select: { name: true } },
            _count: { select: { steps: true } },
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    }),
    readHotProspects(now),
  ]);

  const activityAt = new Map<string, Date>();
  for (const answer of answers) {
    if (answer.contactId === null) continue;
    if (!activityAt.has(answer.contactId)) activityAt.set(answer.contactId, answer.date);
  }

  const replyAt = new Map<string, Date>();
  for (const reply of replies) {
    if (reply.contactId === null) continue;
    if (!replyAt.has(reply.contactId)) replyAt.set(reply.contactId, reply.receivedAt);
  }

  const current = new Map<string, (typeof enrollments)[number]>();
  for (const enrollment of enrollments) {
    if (!current.has(enrollment.contactId)) current.set(enrollment.contactId, enrollment);
  }

  const hotIds = new Set(hot.ids);

  for (const id of ids) {
    const enrollment = current.get(id);
    extras.set(id, {
      campaign: enrollment?.sequence.campaign?.name ?? enrollment?.sequence.name ?? "",
      lastStep: enrollment?.lastStep ?? 0,
      totalSteps: enrollment?.sequence._count.steps ?? 0,
      replied: latestReply(activityAt.get(id) ?? null, replyAt.get(id) ?? null) !== null,
      hot: hotIds.has(id),
    });
  }

  return extras;
}
