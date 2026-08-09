/**
 * Ce qu'une carte d'indicateur doit dire en plus de son nombre.
 *
 * Un nombre seul ne se juge pas : 31 contactés cette semaine est une bonne ou
 * une mauvaise semaine selon ce qu'était la précédente. La comparaison est donc
 * portée par la carte, pas laissée à la mémoire de celui qui regarde.
 *
 * **La couleur ne suit pas le signe, elle suit le sens.** « Jamais contactés »
 * qui monte est une mauvaise nouvelle bien qu'il s'agisse d'un `+` ; le module
 * reçoit donc la direction souhaitable et refuse de la deviner.
 */

export type DeltaTone = "good" | "bad" | "flat";

export interface Delta {
  /** « +12 vs semaine dernière ». */
  readonly text: string;
  readonly tone: DeltaTone;
  readonly change: number;
}

/**
 * Compare deux périodes.
 *
 * `null` quand la période précédente est inconnue — il n'y a alors rien à
 * comparer, et afficher « +31 » contre un néant transformerait une première
 * semaine en exploit.
 */
export function describeDelta(
  current: number,
  previous: number | null,
  period: string,
  higherIsBetter = true,
): Delta | null {
  if (previous === null) return null;

  const change = current - previous;
  if (change === 0) return { text: `stable vs ${period}`, tone: "flat", change: 0 };

  const sign = change > 0 ? "+" : "−";
  const rising = change > 0;
  return {
    text: `${sign}${Math.abs(change)} vs ${period}`,
    tone: rising === higherIsBetter ? "good" : "bad",
    change,
  };
}

/**
 * Ce qu'une carte vide doit dire à la place d'un tiret.
 *
 * Un « — » dans « Taux de réponse » ressemble à une panne. La vraie
 * information est qu'il manque une saisie, et laquelle : la carte enseigne
 * comment la remplir au lieu de constater son absence.
 */
export interface EmptyHint {
  readonly value: "—";
  readonly explanation: string;
}

export const EMPTY_HINTS = {
  responseRate:
    "renseignez le résultat de vos échanges (répondu, sans réponse…) pour que le taux se calcule",
  conversion: "aucune affaire créée : le taux apparaîtra dès la première",
} as const satisfies Record<string, string>;
