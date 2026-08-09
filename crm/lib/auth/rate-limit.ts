/**
 * Limitation des tentatives de connexion ratées.
 *
 * Fenêtre glissante en mémoire, par adresse IP. Volontairement simple, et
 * volontairement honnête sur ses limites :
 *
 * - **en mémoire** : un redémarrage remet les compteurs à zéro, et deux
 *   instances Railway comptent chacune de leur côté. Avec un seul conteneur
 *   c'est sans effet ; à plusieurs, le plafond réel est le plafond multiplié par
 *   le nombre d'instances ;
 * - ce n'est donc **pas** une défense contre un attaquant distribué. C'est ce
 *   qui transforme un mot de passe devinable en cible hors de portée d'un script
 *   naïf, en attendant que le mot de passe lui-même soit assez long.
 *
 * Le vrai rempart reste la longueur du secret. La limitation achète du temps.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

interface Bucket {
  count: number;
  /** Fin de la fenêtre courante. */
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitState {
  readonly allowed: boolean;
  /** Secondes avant de pouvoir réessayer, quand `allowed` est faux. */
  readonly retryAfter: number;
}

function bucketFor(key: string, now: number): Bucket {
  const existing = buckets.get(key);
  if (existing !== undefined && existing.resetAt > now) return existing;

  const fresh: Bucket = { count: 0, resetAt: now + WINDOW_MS };
  buckets.set(key, fresh);
  return fresh;
}

/** Consulte l'état sans rien consommer : appelé *avant* de vérifier le mot de passe. */
export function checkRateLimit(key: string, now: number = Date.now()): RateLimitState {
  const bucket = bucketFor(key, now);
  if (bucket.count < MAX_FAILURES) return { allowed: true, retryAfter: 0 };

  return { allowed: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
}

/** Enregistre un échec. Seuls les échecs comptent : une connexion réussie n'use rien. */
export function recordFailure(key: string, now: number = Date.now()): void {
  const bucket = bucketFor(key, now);
  bucket.count += 1;

  // Purge opportuniste : sans elle, la table grossirait indéfiniment sur un
  // service exposé à Internet, une entrée par adresse jamais revue.
  if (buckets.size > 5000) {
    for (const [key_, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(key_);
    }
  }
}

/** Efface le compteur après une connexion réussie. */
export function clearFailures(key: string): void {
  buckets.delete(key);
}

/**
 * Identifie l'appelant.
 *
 * `x-forwarded-for` vient du proxy Railway, qui le réécrit — un client ne peut
 * pas le forger de bout en bout. En son absence on retombe sur une clé unique
 * partagée : mieux vaut limiter tout le monde ensemble que ne limiter personne.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first !== undefined && first !== "") return first;

  return headers.get("x-real-ip")?.trim() ?? "inconnu";
}

/** Réservé aux tests : repart d'un état vierge. */
export function resetRateLimits(): void {
  buckets.clear();
}
