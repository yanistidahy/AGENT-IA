import "server-only";
import { prisma } from "../db";
import { readReplyFacts, replyDates } from "./email-replies";
import { buildFunnel, type FunnelInput, type FunnelStep } from "../domain/email-funnel";
import { historyDepth, type HistoryDepth } from "../domain/email-history";
import {
  byDay,
  bySequence,
  byWeek,
  signatoryLines,
  type Bucket,
  type SignatoryLine,
} from "../domain/email-stats";

/**
 * Ce que les emails ont produit, en chiffres.
 *
 * **L'ordre d'affichage est un jugement, et il est porté ici** : les réponses
 * et les rendez-vous passent avant le taux d'ouverture. Les deux premiers sont
 * des faits saisis à la main ; le troisième est une estimation qu'on sait
 * fausse dans un sens connu.
 *
 * Depuis le jalon 39, les quatre nombres sortent d'ici **déjà rangés en
 * entonnoir** : la page ne recompose aucun taux et ne choisit aucun
 * dénominateur. Un écran qui calculerait ses propres pourcentages finirait par
 * en afficher d'autres que ceux du domaine — et personne ne saurait lequel des
 * deux fait foi.
 */

export interface EmailStats {
  /** Messages partis sur la fenêtre. */
  readonly total: number;
  readonly windowDays: number;
  /** Combien d'histoire existe, et donc quel graphique a le droit de s'afficher. */
  readonly depth: HistoryDepth;
  /** Écrit → ouvert → répondu → rendez-vous, en personnes. */
  readonly funnel: readonly FunnelStep[];
  readonly perDay: readonly Bucket[];
  readonly perWeek: readonly Bucket[];
  readonly perSequence: readonly Bucket[];
  /**
   * Par signataire : envois, personnes, réponses.
   *
   * Ils sont deux depuis le jalon 35 ; un chiffre global ne dit plus qui écrit
   * ni ce que chacun obtient.
   */
  readonly perSignatory: readonly SignatoryLine[];
  /** Envois dont la copie IMAP a échoué — visible, jamais avalé. */
  readonly copyFailures: number;
  /**
   * Ce que l'estimation d'ouverture vaut, en deux nombres.
   *
   * `unaudited` compte les envois dont le compteur est non nul mais dont aucun
   * chargement n'est détaillé : ils précèdent le tri du jalon 43, donc leur
   * chiffre n'a été ni confirmé ni infirmé. **Le dire est la seule façon
   * honnête d'afficher le taux tant qu'ils pèsent dessus.**
   */
  readonly openTrust: { readonly unaudited: number; readonly tracked: number };
}

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

export async function readEmailStats(now = new Date()): Promise<EmailStats> {
  const since = new Date(now);
  since.setDate(since.getDate() - WINDOW_DAYS);

  const { input, unaudited, sends, firstSend } = await readFunnelFacts({ since });
  const facts = await readReplyFacts(firstSend);

  const dates = sends.map((send) => send.sentAt);
  const depth = historyDepth(dates, now);

  return {
    total: sends.length,
    windowDays: WINDOW_DAYS,
    depth,
    funnel: buildFunnel(input),
    // Les deux graphiques suivent l'histoire disponible : `dailyDays` et
    // `weeklyWeeks` valent 0 quand la série ne porte pas encore de quoi
    // affirmer quoi que ce soit, et la page rend alors la phrase qui dit
    // quand ils reviendront.
    perDay: depth.daily ? byDay(dates, now, depth.dailyDays) : [],
    perWeek: depth.weekly ? byWeek(dates, now, depth.weeklyWeeks) : [],
    perSequence: bySequence(sends),
    perSignatory: signatoryLines(sends, replyDates(facts)),
    copyFailures: sends.filter((send) => send.copyStatus === "failed").length,
    // Les deux nombres comptent des **envois**, pas des personnes : « 1 envoi
    // sur 1 » alors que trois messages sont suivis serait faux dans le sens qui
    // dramatise.
    openTrust: { unaudited, tracked: sends.filter((send) => send.tracked).length },
  };
}
