import "server-only";
import { prisma } from "../db";
import { readReplyFacts } from "./email-replies";
import type { FunnelInput } from "../domain/email-funnel";

/**
 * Les faits d'envoi, lus une seule fois.
 *
 * Ce module portait aussi, jusqu'au jalon 109, les statistiques de l'écran
 * « Emails » — entonnoir, taux d'ouverture, courbes par jour et par semaine,
 * tableau par signataire. Cet écran a été retiré : un seul tableau de bord
 * subsiste, `/pilotage`, et il lit le **journal des événements de prospection**,
 * pas ces additions. Ce qui reste ici est ce qui sert encore :
 *
 * - `readFunnelFacts`, l'entonnoir **d'une campagne** (`/campagnes/<id>`), qui
 *   n'a pas été retiré et qui reste la seule addition de cet entonnoir ;
 * - `readEmailHealth`, les deux nombres opérationnels de `/emails` : combien de
 *   messages sont partis, et combien n'ont pas été copiés dans « Envoyés ».
 *
 * **Les ouvertures ne sont plus un indicateur.** Elles continuent d'être
 * enregistrées (rien n'est supprimé en base) et restent visibles ligne à ligne
 * dans le tableau des inscrits d'une campagne ; elles ne pilotent plus rien.
 */
export const EMAIL_WINDOW_DAYS = 90;
const WINDOW_DAYS = EMAIL_WINDOW_DAYS;

/**
 * La portée d'un entonnoir : une fenêtre, une campagne, ou les deux.
 *
 * `sequenceId` borne à une campagne — la relation campagne ↔ séquence est
 * un-à-un depuis le jalon 54, et c'est `EmailSend.sequenceId` qui porte
 * l'appartenance sur chaque envoi.
 */
export interface FunnelScope {
  readonly since?: Date;
  readonly sequenceId?: string;
}

/** Ce qu'il faut pour construire un entonnoir, plus les lignes qui l'ont produit. */
export interface FunnelFacts {
  readonly input: FunnelInput;
  readonly unaudited: number;
  readonly sends: SendRow[];
  readonly firstSend: Map<string, Date>;
}

type SendRow = {
  sentAt: Date;
  signatoryName: string;
  sequenceName: string;
  sequenceStep: number | null;
  contactId: string | null;
  tracked: boolean;
  firstOpenAt: Date | null;
  openCount: number;
  _count: { hits: number };
  copyStatus: string;
};

/**
 * **Le calcul de l'entonnoir, en un seul endroit.**
 *
 * `/emails` et la carte d'une campagne affichaient le même entonnoir calculé
 * deux fois — écrit ainsi au jalon 54, et c'était une faute : deux additions
 * d'une même chose finissent par diverger, et le jour venu on ne sait plus
 * laquelle croire. Elles appellent désormais cette fonction, l'une avec une
 * fenêtre, l'autre avec une campagne. **Les nombres ne peuvent plus se
 * contredire, parce qu'il n'y en a qu'une série.**
 *
 * Les règles qu'elle porte sont celles des jalons 37 et 39, inchangées :
 *
 * - la réponse se compte **par personne**, jamais par envoi — relancer trois
 *   fois quelqu'un qui répond une fois ne fait pas trois réponses ;
 * - le dénominateur de l'ouverture est le nombre de personnes **suivies**, pas
 *   écrites : un message parti sans pixel n'avait aucune chance d'être compté ;
 * - un envoi orphelin (fiche supprimée) reste **une personne écrite** — le
 *   compter pour rien flatterait tous les taux ;
 * - la borne de la réponse est le **premier** envoi à cette personne dans la
 *   portée : une réponse antérieure ne répond pas à un message postérieur.
 */
export async function readFunnelFacts(scope: FunnelScope): Promise<FunnelFacts> {
  const sends = await prisma.emailSend.findMany({
    where: {
      ...(scope.since === undefined ? {} : { sentAt: { gte: scope.since } }),
      ...(scope.sequenceId === undefined ? {} : { sequenceId: scope.sequenceId }),
    },
    select: {
      sentAt: true,
      signatoryName: true,
      sequenceName: true,
      sequenceStep: true,
      contactId: true,
      tracked: true,
      firstOpenAt: true,
      openCount: true,
      _count: { select: { hits: true } },
      copyStatus: true,
    },
    orderBy: { sentAt: "asc" },
  });

  const firstSend = new Map<string, Date>();
  for (const send of sends) {
    if (send.contactId === null) continue;
    const known = firstSend.get(send.contactId);
    if (known === undefined || send.sentAt < known) firstSend.set(send.contactId, send.sentAt);
  }

  const facts = await readReplyFacts(firstSend);

  let replied = 0;
  let meetings = 0;
  for (const fact of facts.values()) {
    if (fact.repliedAt !== null) replied += 1;
    if (fact.metAt !== null) meetings += 1;
  }

  const people = new Set<string>();
  const trackedPeople = new Set<string>();
  const openedPeople = new Set<string>();
  sends.forEach((send, index) => {
    const key = send.contactId ?? `orphelin:${index}`;
    people.add(key);
    if (!send.tracked) return;
    trackedPeople.add(key);
    if (send.firstOpenAt !== null) openedPeople.add(key);
  });

  // **Un envoi dont le compteur est non nul sans aucun chargement détaillé est
  // antérieur au tri du jalon 43** : son chiffre n'a été ni confirmé ni
  // infirmé. L'écran doit le dire au lieu de laisser lire l'estimation comme
  // si elle avait été auditée.
  const unaudited = sends.filter(
    (send) => send.tracked && send.openCount > 0 && send._count.hits === 0,
  ).length;

  return {
    input: {
      written: people.size,
      messages: sends.length,
      opened: openedPeople.size,
      tracked: trackedPeople.size,
      replied,
      meetings,
    },
    unaudited,
    sends,
    firstSend,
  };
}

/**
 * Ce que `/emails` a besoin de savoir, et rien de plus.
 *
 * Deux comptes, pas une lecture de toutes les lignes : la page affiche le
 * journal des envois (paginé par `readSentEmails`) et la file « sans
 * réponse » ; elle n'a plus aucune série à tracer. Les envois non copiés
 * restent annoncés parce que c'est un **fait opérationnel** — le message est
 * parti, la copie IMAP a échoué —, pas un indicateur de performance.
 */
export interface EmailHealth {
  readonly total: number;
  readonly windowDays: number;
  readonly copyFailures: number;
}

export async function readEmailHealth(now = new Date()): Promise<EmailHealth> {
  const since = new Date(now);
  since.setDate(since.getDate() - WINDOW_DAYS);

  const [total, copyFailures] = await Promise.all([
    prisma.emailSend.count({ where: { sentAt: { gte: since } } }),
    prisma.emailSend.count({ where: { sentAt: { gte: since }, copyStatus: "failed" } }),
  ]);

  return { total, windowDays: WINDOW_DAYS, copyFailures };
}
