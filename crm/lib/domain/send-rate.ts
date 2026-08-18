/**
 * Le débit d'envoi, et ce qu'on fait quand le serveur dit non.
 *
 * **Le réglage n'est qu'une estimation prudente ; c'est le serveur qui connaît
 * la vraie limite.** IONOS fait monter le quota avec l'âge de la boîte, et les
 * chiffres publiés ne valent pas engagement. Toute la conception tient donc en
 * une phrase : partir bas, et **apprendre du refus** plutôt que de le traiter
 * comme une panne.
 *
 * Module pur : les seuils se testent sans base et sans serveur SMTP.
 */

export interface SendLimits {
  readonly perHour: number;
  readonly perDay: number;
}

export const DEFAULT_LIMITS: SendLimits = { perHour: 30, perDay: 150 };

/**
 * Espacement entre deux envois automatiques, en secondes.
 *
 * Cinquante messages partis à la seconde près sont un signal de masse à eux
 * seuls, indépendamment du quota. La valeur est tirée au hasard dans cette
 * fourchette à chaque départ.
 */
export const SPACING_SECONDS = { min: 120, max: 300 } as const;

export function spacingSeconds(random: number): number {
  const span = SPACING_SECONDS.max - SPACING_SECONDS.min;
  // `Math.random()` rend [0, 1), donc `span + 1` donne bien une distribution
  // uniforme sur les entiers. Le `min` final borne le cas limite `random === 1`,
  // qu'un appelant peut passer même si l'horloge ne le produit jamais.
  return Math.min(SPACING_SECONDS.max, SPACING_SECONDS.min + Math.floor(random * (span + 1)));
}

export type RateVerdict =
  | { readonly ok: true; readonly remainingHour: number; readonly remainingDay: number }
  | { readonly ok: false; readonly reason: string };

/**
 * Reste-t-il de la place pour un envoi de plus ?
 *
 * Vérifié **avant** l'envoi : on ne rattrape pas un message parti. Le refus
 * nomme le plafond atteint et la valeur réglée — « bloqué » sans chiffre
 * n'apprend rien et se lit comme une panne.
 */
export function rateVerdict(
  sentLastHour: number,
  sentToday: number,
  limits: SendLimits,
): RateVerdict {
  if (sentLastHour >= limits.perHour) {
    return {
      ok: false,
      reason: `Plafond horaire atteint : ${sentLastHour} envois sur la dernière heure pour un plafond de ${limits.perHour}.`,
    };
  }
  if (sentToday >= limits.perDay) {
    return {
      ok: false,
      reason: `Plafond journalier atteint : ${sentToday} envois aujourd'hui pour un plafond de ${limits.perDay}.`,
    };
  }
  return {
    ok: true,
    remainingHour: limits.perHour - sentLastHour,
    remainingDay: limits.perDay - sentToday,
  };
}

/**
 * Le serveur d'envoi vient-il d'opposer une limite de débit ?
 *
 * IONOS répond `450 Requested mail action not taken … Mail send limit exceeded`.
 * On reconnaît le code **et** la formule, parce qu'un 450 est un refus
 * temporaire qui peut aussi vouloir dire tout autre chose — greylisting, boîte
 * momentanément indisponible. Confondre les deux ferait baisser le plafond pour
 * une raison qui n'a rien à voir.
 */
export function isRateRefusal(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const shaped = error as { responseCode?: number; response?: string; message?: string };
  const text = `${shaped.response ?? ""} ${shaped.message ?? ""}`.toLowerCase();
  const rateWords = text.includes("send limit") || text.includes("rate limit") ||
    text.includes("too many messages") || text.includes("sending limit");
  return shaped.responseCode === 450 && rateWords;
}

/**
 * Le nouveau plafond horaire après un refus, et ce qu'on en dit.
 *
 * **On descend à ce qui vient réellement de passer**, pas à une fraction
 * arbitraire : le serveur a accepté `observed` messages puis refusé le suivant,
 * donc `observed` est la seule valeur dont on ait la preuve. Le plancher de 1
 * évite un plafond à zéro, qui bloquerait tout sans qu'aucun réglage ne le dise.
 */
export function loweredCeiling(observedThisHour: number): number {
  return Math.max(1, observedThisHour);
}

export function limitNotice(observedThisHour: number, previous: number, raw: string): string {
  const next = loweredCeiling(observedThisHour);
  return (
    `Votre serveur d'envoi a opposé une limite de débit après ${observedThisHour} message` +
    `${observedThisHour > 1 ? "s" : ""} dans l'heure. Le plafond horaire passe de ${previous} à ${next}. ` +
    `Réponse du serveur : ${raw.slice(0, 200)}`
  );
}
