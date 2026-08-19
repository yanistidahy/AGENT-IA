import "server-only";
import { prisma } from "../db";

/**
 * Le relevé de la boîte tourne-t-il encore ?
 *
 * **Une détection de réponses qui s'arrête en silence est pire que pas de
 * détection du tout.** Sans elle, on sait qu'il faut ouvrir sa boîte ; avec
 * elle en panne, on croit le CRM à jour et on relance quelqu'un qui a répondu
 * il y a trois jours. C'est exactement le mode de défaillance du planificateur
 * muet du jalon 38, et il se traite pareil : par un bandeau.
 *
 * Le seuil est à **2 heures** pour un relevé qui passe tous les quarts d'heure
 * — huit passages manqués. Le planificateur quotidien tolère 36 heures pour la
 * même raison inverse : un seuil trop serré produit un bandeau qu'on apprend à
 * ignorer, un seuil trop lâche produit un bandeau qui arrive trop tard.
 */
export const INBOX_STALE_HOURS = 2;

export interface InboxHealth {
  readonly lastPollAt: Date | null;
  readonly enabled: boolean;
  /** Le relevé est configuré : hôte, identifiant et secret sont là. */
  readonly configured: boolean;
  readonly stale: boolean;
  /** Heures écoulées, `null` si aucun relevé n'a jamais eu lieu. */
  readonly hours: number | null;
}

export function inboxVerdict(
  lastPollAt: Date | null,
  enabled: boolean,
  configured: boolean,
  now: Date,
): InboxHealth {
  const base = { lastPollAt, enabled, configured };

  // **Désactivé ou non configuré n'est pas une panne.** Quelqu'un qui n'a pas
  // branché le relevé sait qu'il consigne ses réponses à la main : lui montrer
  // une alerte permanente lui apprendrait à ne plus lire les bandeaux.
  if (!enabled || !configured) return { ...base, stale: false, hours: null };

  if (lastPollAt === null) {
    // Activé, configuré, jamais exécuté : c'est la situation d'un déploiement
    // dont le déclencheur n'a pas été posé. Tout a l'air normal et rien ne
    // tourne — l'état à signaler par excellence.
    return { ...base, stale: true, hours: null };
  }

  const hours = (now.getTime() - lastPollAt.getTime()) / 3_600_000;
  return { ...base, stale: hours > INBOX_STALE_HOURS, hours: Math.floor(hours) };
}

export async function inboxHealth(configured: boolean, now = new Date()): Promise<InboxHealth> {
  const row = await prisma.settings.findUnique({
    where: { id: "singleton" },
    select: { lastInboxPollAt: true, inboxPollEnabled: true },
  });
  return inboxVerdict(row?.lastInboxPollAt ?? null, row?.inboxPollEnabled ?? true, configured, now);
}
