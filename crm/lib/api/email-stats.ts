import "server-only";
import { prisma } from "../db";
import { REAL_ACTIVITY } from "./real-activity";
import { ANSWERED_OUTCOMES } from "../domain/status";
import {
  byDay,
  bySequence,
  bySignatory,
  byWeek,
  rate,
  type Bucket,
  type Rate,
} from "../domain/email-stats";

/**
 * Ce que les emails ont produit, en chiffres.
 *
 * **L'ordre d'affichage est un jugement, et il est porté ici** : les réponses
 * et les rendez-vous passent avant le taux d'ouverture. Les deux premiers sont
 * des faits saisis à la main ; le troisième est une estimation qu'on sait
 * fausse dans un sens connu. Les mettre côte à côte sans les hiérarchiser
 * laisserait le plus gros nombre — les ouvertures — passer pour le plus
 * important.
 */

export interface EmailStats {
  readonly total: number;
  readonly windowDays: number;
  readonly perDay: readonly Bucket[];
  readonly perWeek: readonly Bucket[];
  readonly perSignatory: readonly Bucket[];
  /** Les envois **suivis** sur la fenêtre — le dénominateur du taux. */
  readonly tracked: number;
  readonly opened: number;
  readonly openRate: Rate;
  /** Faits : une interaction à issue « a répondu », postérieure à un envoi. */
  readonly replies: number;
  readonly replyRate: Rate;
  /** Faits : une interaction d'issue « RDV obtenu », postérieure à un envoi. */
  readonly meetings: number;
  /** Envois dont la copie IMAP a échoué — visible, jamais avalé. */
  readonly copyFailures: number;
  /**
   * Par séquence et par étape.
   *
   * **Quand un prospect finit par répondre, il faut savoir à quoi.** Une
   * séquence dont l'étape 1 part cent fois et l'étape 3 jamais ne dit pas la
   * même chose qu'une séquence qui va au bout : le détail par étape est ce qui
   * distingue « la séquence tourne » de « la séquence s'arrête toute seule ».
   */
  readonly perSequence: readonly Bucket[];
}

const WINDOW_DAYS = 90;

export async function readEmailStats(now = new Date()): Promise<EmailStats> {
  const since = new Date(now);
  since.setDate(since.getDate() - WINDOW_DAYS);

  const sends = await prisma.emailSend.findMany({
    where: { sentAt: { gte: since } },
    select: {
      sentAt: true,
      signatoryName: true,
      sequenceName: true,
      sequenceStep: true,
      contactId: true,
      tracked: true,
      firstOpenAt: true,
      copyStatus: true,
    },
    orderBy: { sentAt: "asc" },
  });

  const dates = sends.map((send) => send.sentAt);
  const tracked = sends.filter((send) => send.tracked).length;
  const opened = sends.filter((send) => send.tracked && send.firstOpenAt !== null).length;

  // **La réponse se compte par contact, pas par envoi.** Quelqu'un qui a reçu
  // trois messages et répond une fois a répondu une fois : compter la réponse
  // pour chacun des trois gonflerait le taux d'un facteur trois, et gonflerait
  // d'autant plus qu'on relance.
  const firstSend = new Map<string, Date>();
  for (const send of sends) {
    if (send.contactId === null) continue;
    const known = firstSend.get(send.contactId);
    if (known === undefined || send.sentAt < known) firstSend.set(send.contactId, send.sentAt);
  }

  const contactIds = [...firstSend.keys()];
  const answers =
    contactIds.length === 0
      ? []
      : await prisma.activity.findMany({
          where: {
            ...REAL_ACTIVITY,
            contactId: { in: contactIds },
            outcome: { in: [...ANSWERED_OUTCOMES] },
          },
          select: { contactId: true, outcome: true, date: true },
        });

  const replied = new Set<string>();
  const met = new Set<string>();
  for (const answer of answers) {
    if (answer.contactId === null) continue;
    const sentAt = firstSend.get(answer.contactId);
    // **Postérieure à l'envoi**, sinon on compterait comme réponse à un email
    // une conversation qui a eu lieu avant qu'il parte.
    if (sentAt === undefined || answer.date < sentAt) continue;
    replied.add(answer.contactId);
    if (answer.outcome === "meeting") met.add(answer.contactId);
  }

  return {
    total: sends.length,
    windowDays: WINDOW_DAYS,
    perDay: byDay(dates, now, 30),
    perWeek: byWeek(dates, now, 12),
    perSignatory: bySignatory(sends),
    perSequence: bySequence(sends),
    tracked,
    opened,
    openRate: rate(opened, tracked),
    replies: replied.size,
    // Le dénominateur est le nombre de **personnes** écrites, pas de messages :
    // c'est la seule façon que le taux reste comparable d'un mois à l'autre
    // quand le nombre de relances par personne change.
    replyRate: rate(replied.size, firstSend.size),
    meetings: met.size,
    copyFailures: sends.filter((send) => send.copyStatus === "failed").length,
  };
}
