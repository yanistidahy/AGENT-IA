import "server-only";
import { prisma } from "../db";
import { listMailboxes, type Mailbox } from "./mailboxes";
import {
  DEFAULT_DAILY_CAP,
  parisDayRange,
  type MailboxUsage,
} from "../domain/mailbox-cap";

/**
 * **Le plafond quotidien, lu dans le journal des envois.**
 *
 * Aucun compteur n'est tenu à côté : le compte se refait à chaque lecture,
 * depuis `email_sends`, borné au jour parisien. C'est la leçon de `checkRate`
 * (jalon 38), et elle vaut double ici : un compteur parallèle finirait par
 * diverger, et il divergerait dans le mauvais sens, en autorisant plus que le
 * réel.
 *
 * Le compte porte sur **tout ce qui est réellement parti** de la boîte : départ
 * validé à la main, envoi de l'ordonnanceur, email écrit depuis une fiche. Une
 * ligne d'envoi n'existe que lorsque SMTP a accepté (jalon 32), donc il n'y a
 * rien à filtrer : le journal ne porte que des faits.
 */

/** Le plafond réglé, ou celui du schéma : une ligne absente ne lève jamais. */
export async function readDailyCap(): Promise<number> {
  const row = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: { dailyMailboxCap: true },
  });
  return row === null ? DEFAULT_DAILY_CAP : row.dailyMailboxCap;
}

/**
 * Ce que chaque boîte a envoyé aujourd'hui, et ce qu'elle a le droit d'envoyer.
 *
 * Les envois antérieurs au jalon 54 portent un `mailboxId` vide : ils ne sont
 * donc imputés à personne, ce qui est exact — on ne sait pas de quelle boîte ils
 * sont partis, et les attribuer à la première ferait mentir son compte.
 */
export async function readMailboxUsage(now = new Date()): Promise<MailboxUsage[]> {
  const [cap, mailboxes] = await Promise.all([readDailyCap(), listMailboxes()]);
  return await usageOf(mailboxes, cap, now);
}

/** La même lecture, quand l'appelant tient déjà ses boîtes et son plafond. */
export async function usageOf(
  mailboxes: readonly Mailbox[],
  cap: number,
  now: Date,
): Promise<MailboxUsage[]> {
  const day = parisDayRange(now);
  const rows = await prisma.emailSend.groupBy({
    by: ["mailboxId"],
    where: { sentAt: { gte: day.start, lt: day.end } },
    _count: { _all: true },
  });
  const sentBy = new Map(rows.map((row) => [row.mailboxId, row._count._all]));

  return mailboxes.map((mailbox) => ({
    mailboxId: mailbox.id,
    from: mailbox.smtpFrom,
    label: mailbox.label,
    sent: sentBy.get(mailbox.id) ?? 0,
    cap,
  }));
}

/**
 * L'état d'une seule boîte, pour le refus de `sendDeparture`.
 *
 * Une boîte inconnue rend `null` : le chemin d'envoi a d'autres refus à opposer
 * (boîte introuvable, mot de passe absent), et en inventer un ici ferait nommer
 * le plafond sur une panne de configuration.
 */
export async function readUsageFor(
  mailboxId: string,
  now = new Date(),
): Promise<MailboxUsage | null> {
  const mailboxes = await listMailboxes();
  const mailbox = mailboxes.find((row) => row.id === mailboxId);
  if (mailbox === undefined) return null;
  const rows = await usageOf([mailbox], await readDailyCap(), now);
  return rows[0] ?? null;
}
