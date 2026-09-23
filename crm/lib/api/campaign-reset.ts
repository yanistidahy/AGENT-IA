import "server-only";
import { prisma } from "../db";
import { contactTitle } from "../domain/contact-identity";
import {
  describeReset,
  describeRepliers,
  describeResetExclusions,
  resettable,
  type ResetExclusion,
  type ResetPlan,
} from "../domain/campaign-reset";
import { REAL_ACTIVITY } from "./real-activity";
import { ANSWERED_OUTCOMES } from "../domain/status";
import { composeForCampaign } from "./compose-now";

/**
 * **Réinitialiser une campagne : un nouveau premier message pour tout le monde.**
 *
 * Une campagne qui a tourné il y a trois mois porte les consignes de l'époque :
 * le mail de référence a changé, les notes d'angle aussi, et la recherche
 * atteint désormais les fiches sans société (jalon 84). « Écrire les mails »
 * ne rejoue pas ce qui est **parti** ; ce geste-ci le fait, en ouvrant un
 * chapitre plutôt qu'en effaçant le précédent.
 *
 * Ce qu'il **ne touche jamais** : `EmailSend`, les interactions consignées, la
 * chronologie des fiches. La progression de la campagne est la seule chose qui
 * revient à zéro, et c'est exactement ce que `lastStep` porte.
 *
 * `POST` regarde, `PUT` écrit — la séparation du jalon 8, et celle du jalon 81 :
 * un point d'entrée unique ferait d'un affichage d'écran cinquante-deux
 * brouillons facturés.
 */

async function sequenceOf(campaignId: string): Promise<string | null> {
  const sequence = await prisma.emailSequence.findFirst({
    where: { campaignId },
    select: { id: true },
  });
  return sequence?.id ?? null;
}

/**
 * La dernière réponse consignée par cette personne, ou `null`.
 *
 * **Lue dans les interactions, comme partout ailleurs** (jalon 39) : la
 * définition de « a répondu » ne se réécrit pas pour un écran de plus. Sans
 * borne de temps ici, délibérément — la question posée est « cette personne
 * nous a-t-elle déjà répondu », pas « depuis son dernier message ». Une
 * réponse d'il y a six mois reste un signal qu'un premier message froid
 * effacerait.
 */
async function repliedAt(contactIds: readonly string[]): Promise<Map<string, Date>> {
  if (contactIds.length === 0) return new Map();
  const rows = await prisma.activity.findMany({
    where: {
      ...REAL_ACTIVITY,
      contactId: { in: [...contactIds] },
      outcome: { in: [...ANSWERED_OUTCOMES] },
    },
    orderBy: { date: "desc" },
    select: { contactId: true, date: true },
  });

  const latest = new Map<string, Date>();
  for (const row of rows) {
    if (row.contactId === null) continue;
    if (!latest.has(row.contactId)) latest.set(row.contactId, row.date);
  }
  return latest;
}

export interface CampaignResetPlan extends ResetPlan {
  /** La phrase de confirmation, composée par le domaine. */
  readonly message: string;
  readonly repliersNote: string;
  readonly exclusionsNote: string;
  /** Ce qui empêche, le cas échéant : campagne sans séquence, sans inscrit. */
  readonly blocked: string | null;
}

/** Ce que la réinitialisation ferait, **sans rien écrire ni rien composer**. */
export async function planCampaignReset(
  campaignId: string,
  includeRepliers: boolean,
): Promise<CampaignResetPlan> {
  const sequenceId = await sequenceOf(campaignId);
  const empty = {
    included: 0,
    alreadyWritten: 0,
    repliers: [],
    excluded: [],
    includeRepliers,
    repliersNote: "",
    exclusionsNote: "",
  };
  if (sequenceId === null) {
    return { ...empty, message: "", blocked: "Cette campagne n'a pas de séquence." };
  }

  const rows = await prisma.sequenceEnrollment.findMany({
    where: { sequenceId },
    select: {
      id: true,
      status: true,
      contactId: true,
      lastSentAt: true,
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
  if (rows.length === 0) {
    return { ...empty, message: "", blocked: "Personne n'est inscrit dans cette campagne." };
  }

  const replies = await repliedAt(rows.map((row) => row.contactId));

  let included = 0;
  let alreadyWritten = 0;
  const repliers: string[] = [];
  const excluded: ResetExclusion[] = [];

  for (const row of rows) {
    const name = contactTitle(row.contact);
    const reply = replies.get(row.contactId) ?? null;
    if (reply !== null) repliers.push(name);

    const verdict = resettable({ status: row.status, repliedAt: reply }, includeRepliers);
    if (!verdict.ok) {
      excluded.push({ name, block: verdict.block });
      continue;
    }
    included += 1;
    // « déjà contactée il y a plusieurs jours » : c'est ce fait qui rend le
    // second premier message étrange à lire, donc il est compté.
    if (row.lastSentAt !== null) alreadyWritten += 1;
  }

  const plan: ResetPlan = { included, alreadyWritten, repliers, excluded, includeRepliers };
  return {
    ...plan,
    message: describeReset(plan),
    repliersNote: describeRepliers(plan),
    exclusionsNote: describeResetExclusions(plan),
    blocked: null,
  };
}

export interface CampaignResetOutcome {
  readonly reset: number;
  readonly blocked: string | null;
}

/**
 * Ramène les inscriptions retenues à l'étape 1, puis compose.
 *
 * Quatre écritures, et pas une de plus :
 *
 * - `status` redevient `active` et `stopReason` se vide — l'inscription
 *   reprend du service ;
 * - `lastStep` revient à `0` : c'est **la** progression de la campagne, et
 *   c'est la seule chose que « réinitialiser » signifie ;
 * - `round` avance d'un cran, ce qui laisse les départs déjà composés à leur
 *   place au lieu de les remplacer ;
 * - `resetAt` marque le début du chapitre, et sert d'ancre aux réponses.
 *
 * **`lastSentAt` ne bouge pas** : c'est la date du dernier message réellement
 * parti, un fait, et la liste des inscrits le montre. L'effacer ferait mentir
 * l'écran sur ce qui s'est passé.
 *
 * La composition suit, **en arrière-plan** : cinquante brouillons sont
 * cinquante appels au modèle, et la requête n'a pas à les attendre (jalon 56).
 * Elle passe par `composeForCampaign`, donc par les mêmes garde-fous que tout
 * le reste — rien n'est envoyé.
 */
export async function applyCampaignReset(
  campaignId: string,
  includeRepliers: boolean,
  now = new Date(),
): Promise<CampaignResetOutcome> {
  const plan = await planCampaignReset(campaignId, includeRepliers);
  if (plan.blocked !== null) return { reset: 0, blocked: plan.blocked };

  const sequenceId = await sequenceOf(campaignId);
  if (sequenceId === null) return { reset: 0, blocked: "Cette campagne n'a pas de séquence." };

  const rows = await prisma.sequenceEnrollment.findMany({
    where: { sequenceId },
    select: { id: true, status: true, contactId: true, round: true },
  });
  const replies = await repliedAt(rows.map((row) => row.contactId));

  /*
    **La sélection passe par `resettable`, jamais par une clause SQL jumelle.**
    Le jalon 82 a payé cette leçon : une seconde écriture de la règle dans le
    `updateMany` décide réellement, et le plan peut alors annoncer des gens que
    l'écriture ne touche pas — sans que rien ne lève.
  */
  const retained = rows.filter(
    (row) =>
      resettable({ status: row.status, repliedAt: replies.get(row.contactId) ?? null }, includeRepliers)
        .ok,
  );
  if (retained.length === 0) return { reset: 0, blocked: null };

  // `round` est propre à chaque inscription : un `updateMany` ne sait pas
  // incrémenter par ligne sans écraser les tours déjà différents.
  for (const row of retained) {
    await prisma.sequenceEnrollment.update({
      where: { id: row.id },
      data: {
        status: "active",
        stopReason: "",
        lastStep: 0,
        round: row.round + 1,
        resetAt: now,
      },
    });
  }

  // Les brouillons **jamais partis** du tour précédent n'ont plus d'objet :
  // ils décrivaient une étape que la personne ne recevra plus sous cette
  // forme. Ce qui est parti reste, avec son tour.
  await prisma.sequenceDeparture.deleteMany({
    where: { enrollmentId: { in: retained.map((row) => row.id) }, status: { not: "sent" } },
  });

  await composeForCampaign(campaignId, now, "background");
  return { reset: retained.length, blocked: null };
}
