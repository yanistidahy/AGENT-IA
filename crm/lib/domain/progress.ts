/**
 * L'avancement du jour — le chiffre qui manquait.
 *
 * « Traité aujourd'hui sur la file du jour ». C'est la seule mesure de l'écran
 * qui récompense le travail au lieu de le décrire, et elle n'a de valeur que si
 * elle est honnête sur deux points.
 *
 * **Le dénominateur ne recule pas.** La file du jour est figée au premier
 * affichage de la journée : sans cela, traiter une ligne ferait baisser le
 * total en même temps que le reste, et l'anneau n'avancerait jamais. Mais il
 * peut **monter** — une relance arrivée à échéance en cours de journée s'ajoute
 * au travail réel, et le cacher serait mentir dans l'autre sens. D'où le
 * `Math.max` : jamais moins que ce qui est fait plus ce qui reste.
 *
 * **Zéro sur zéro n'est pas cent pour cent.** Une journée sans rien à faire
 * n'est pas une journée accomplie ; elle est vide, et l'écran le dit autrement.
 */

export interface DayProgress {
  readonly done: number;
  readonly remaining: number;
  /** Taille de la file du jour, jamais inférieure à `done + remaining`. */
  readonly planned: number;
  /** Entre 0 et 1. Vaut 0 sur une journée vide. */
  readonly ratio: number;
  /** Tout est traité, **et** il y avait quelque chose à traiter. */
  readonly complete: boolean;
  /** Rien n'était prévu et rien ne reste. */
  readonly empty: boolean;
}

export function dayProgress(done: number, remaining: number, planned: number): DayProgress {
  const safeDone = Math.max(done, 0);
  const safeRemaining = Math.max(remaining, 0);
  const total = Math.max(planned, safeDone + safeRemaining, 0);

  return {
    done: safeDone,
    remaining: safeRemaining,
    planned: total,
    ratio: total === 0 ? 0 : Math.min(safeDone / total, 1),
    complete: total > 0 && safeRemaining === 0,
    empty: total === 0,
  };
}

export interface RingDash {
  readonly radius: number;
  readonly circumference: number;
  /** `stroke-dashoffset` : la longueur encore vide. */
  readonly offset: number;
}

/**
 * Géométrie de l'anneau, calculée ici plutôt que dans le JSX.
 *
 * Un cercle SVG démarre à trois heures ; le composant le fait pivoter d'un
 * quart de tour pour partir du haut, comme tout le monde s'y attend.
 */
export function ringDash(ratio: number, radius: number): RingDash {
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const circumference = 2 * Math.PI * radius;
  return {
    radius,
    circumference,
    offset: circumference * (1 - clamped),
  };
}

/**
 * L'état de fin de journée.
 *
 * Une file vidée mérite mieux qu'un tiret. Elle dit que c'est fini, et ce que
 * demain apporte — parce que la question suivante est toujours celle-là.
 */
export function tomorrowLabel(count: number): string {
  if (count === 0) return "Rien de programmé pour demain.";
  return count === 1 ? "1 relance demain." : `${count} relances demain.`;
}

/** Texte accessible de l'anneau. Le SVG seul ne dit rien à un lecteur d'écran. */
export function progressLabel(progress: DayProgress): string {
  if (progress.empty) return "Aucun élément dans la file du jour.";
  return `${progress.done} élément(s) traité(s) sur ${progress.planned} dans la file du jour.`;
}
