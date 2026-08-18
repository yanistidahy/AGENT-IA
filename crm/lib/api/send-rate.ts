import "server-only";
import { prisma } from "../db";
import {
  DEFAULT_LIMITS,
  isRateRefusal,
  limitNotice,
  loweredCeiling,
  rateVerdict,
  type RateVerdict,
  type SendLimits,
} from "../domain/send-rate";

/**
 * Le débit d'envoi, mesuré depuis les envois réellement partis.
 *
 * Aucune table de compteurs : `email_sends` porte déjà `sentAt`, et compter
 * depuis les faits interdit la dérive. Un compteur entretenu à côté finirait
 * par diverger le jour où un envoi échouerait entre deux écritures — et il
 * divergerait dans le mauvais sens, en autorisant plus que le réel.
 */

export async function readLimits(): Promise<SendLimits> {
  const row = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: { sendPerHour: true, sendPerDay: true },
  });
  return {
    perHour: row?.sendPerHour ?? DEFAULT_LIMITS.perHour,
    perDay: row?.sendPerDay ?? DEFAULT_LIMITS.perDay,
  };
}

/** Combien d'envois sur la dernière heure, et depuis minuit. */
export async function sentCounts(now: Date): Promise<{ hour: number; day: number }> {
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [hour, day] = await Promise.all([
    prisma.emailSend.count({ where: { sentAt: { gte: hourAgo } } }),
    prisma.emailSend.count({ where: { sentAt: { gte: midnight } } }),
  ]);
  return { hour, day };
}

/** Reste-t-il de la place ? Vérifié **avant** l'envoi. */
export async function checkRate(now = new Date()): Promise<RateVerdict> {
  const [limits, counts] = await Promise.all([readLimits(), sentCounts(now)]);
  return rateVerdict(counts.hour, counts.day, limits);
}

/**
 * Le serveur a opposé une limite : on l'apprend au lieu de la subir.
 *
 * **Le plafond descend à ce qui vient réellement de passer.** Le serveur a
 * accepté `hour` messages puis refusé le suivant : c'est la seule valeur dont
 * on ait la preuve, et la seule qu'on puisse défendre. Et l'on ne se contente
 * pas d'un journal — l'accueil le dit, parce qu'un plafond abaissé change ce
 * que la journée peut faire.
 *
 * Rend `true` si l'erreur était bien un refus de débit, pour que l'appelant
 * distingue « la boîte a dit stop » de « l'envoi a échoué ».
 */
export async function noteRateRefusal(error: unknown, now = new Date()): Promise<boolean> {
  if (!isRateRefusal(error)) return false;

  const [limits, counts] = await Promise.all([readLimits(), sentCounts(now)]);
  const next = loweredCeiling(counts.hour);
  const shaped = error as { response?: string; message?: string };
  const notice = limitNotice(counts.hour, limits.perHour, shaped.response ?? shaped.message ?? "");

  await prisma.settings.update({
    where: { id: "singleton" },
    data: { sendPerHour: next, sendLimitNotice: notice, sendLimitNoticeAt: now },
  });

  console.warn(`[envoi] limite de débit opposée par le serveur — plafond horaire ramené à ${next}`);
  return true;
}

export interface LimitNotice {
  readonly text: string;
  readonly at: Date;
}

/** Ce que l'accueil doit dire, ou `null`. */
export async function readLimitNotice(): Promise<LimitNotice | null> {
  const row = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: { sendLimitNotice: true, sendLimitNoticeAt: true },
  });
  if (row === null || row.sendLimitNotice === "" || row.sendLimitNoticeAt === null) return null;
  return { text: row.sendLimitNotice, at: row.sendLimitNoticeAt };
}

/** Acquitté en relevant le plafond à la main, depuis les réglages. */
export async function clearLimitNotice(): Promise<void> {
  await prisma.settings.update({
    where: { id: "singleton" },
    data: { sendLimitNotice: "", sendLimitNoticeAt: null },
  });
}
