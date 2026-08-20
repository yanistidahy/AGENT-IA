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
 *
 * **Deuxième angle mort, corrigé au jalon 42.** « Non configuré » était traité
 * comme « pas une panne », ce qui est juste pour quelqu'un qui n'a jamais
 * branché le relevé — et faux pour quelqu'un dont la configuration a été
 * effacée. En production, une restauration a vidé l'hôte IMAP et l'identifiant
 * SMTP : le relevé s'arrêtait sur « non configuré », donc muet, et l'alarme
 * bâtie exactement pour ce cas restait éteinte pendant qu'une réponse de
 * prospect n'était pas détectée.
 *
 * Ce qui départage les deux : **des envois existent**. Un CRM qui a écrit à
 * quinze personnes et dont le relevé est activé mais incapable de tourner est
 * en panne, pas en attente de configuration.
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
  /**
   * Activé, des messages sont partis, et la configuration manque.
   *
   * Distinct de `stale` parce que le geste à faire n'est pas le même : là il
   * faut aller regarder le workflow, ici il faut ressaisir un réglage effacé.
   */
  readonly unconfiguredButUsed: boolean;
}

export function inboxVerdict(
  lastPollAt: Date | null,
  enabled: boolean,
  configured: boolean,
  now: Date,
  /** Des messages sont-ils déjà partis depuis ce CRM ? */
  hasSends = false,
): InboxHealth {
  const base = { lastPollAt, enabled, configured, unconfiguredButUsed: false };

  // **Désactivé n'est pas une panne** : c'est un choix, et quelqu'un qui a
  // éteint le relevé sait qu'il consigne ses réponses à la main.
  if (!enabled) return { ...base, stale: false, hours: null };

  if (!configured) {
    // Jamais branché et rien envoyé : rien à signaler — une alerte permanente
    // sur un écran qu'on découvre apprend surtout à ne plus lire les bandeaux.
    // Mais des envois **et** pas de configuration, c'est une panne.
    return {
      ...base,
      unconfiguredButUsed: hasSends,
      stale: false,
      hours: null,
    };
  }

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
  const [row, sends] = await Promise.all([
    prisma.settings.findUnique({
      where: { id: "singleton" },
      select: { lastInboxPollAt: true, inboxPollEnabled: true },
    }),
    // `count` borné à 1 : on ne veut savoir que si le produit sert à écrire,
    // pas combien de messages sont partis.
    prisma.emailSend.count({ take: 1 }),
  ]);

  return inboxVerdict(
    row?.lastInboxPollAt ?? null,
    row?.inboxPollEnabled ?? true,
    configured,
    now,
    sends > 0,
  );
}
