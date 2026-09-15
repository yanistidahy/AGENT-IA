/**
 * L'état d'une campagne, et son avancement — **dérivés, jamais stockés**.
 *
 * C'est la règle du statut de relance du jalon 6 et de l'état des inscrits du
 * jalon 55, appliquée à la campagne : une colonne `status` à tenir à jour
 * finirait par contredire ce que la carte affiche juste à côté — « brouillon »
 * au-dessus de trois cents messages partis. Ici, l'état est une lecture des
 * faits, donc il ne peut pas mentir.
 */

export type CampaignStatus = "archived" | "running" | "draft";

export const STATUS_LABELS: Readonly<Record<CampaignStatus, string>> = {
  archived: "Archivée",
  running: "En cours",
  draft: "Brouillon",
};

/**
 * **Trois états, et « brouillon » veut dire « ne peut pas envoyer ».**
 *
 * L'ordre compte : une campagne archivée l'est quoi qu'elle porte — c'est une
 * décision, pas un calcul. Ensuite vient ce que la campagne *peut faire* : une
 * séquence sans consigne ou sans personne dedans n'enverra rien, quel que soit
 * le soin qu'on a mis à la nommer.
 *
 * Une campagne qui a fini d'envoyer reste « en cours » jusqu'à ce qu'on
 * l'archive, et c'est voulu : la faire retomber en « brouillon » ferait lire un
 * travail terminé comme un travail jamais commencé. Archiver est le geste qui
 * la range, et il existe depuis le jalon 55.
 */
export function campaignStatus(input: {
  readonly archived: boolean;
  /** Au moins une étape porte une consigne : Alex sait quoi écrire. */
  readonly hasBrief: boolean;
  readonly enrolled: number;
}): CampaignStatus {
  if (input.archived) return "archived";
  return input.hasBrief && input.enrolled > 0 ? "running" : "draft";
}

/** Pourquoi une campagne est encore un brouillon — nommé, pas deviné. */
export function draftReason(input: {
  readonly hasBrief: boolean;
  readonly enrolled: number;
}): string | null {
  if (!input.hasBrief && input.enrolled === 0) {
    return "Aucune consigne d'étape, et personne d'inscrit.";
  }
  if (!input.hasBrief) return "Aucune étape ne porte de consigne.";
  if (input.enrolled === 0) return "Personne n'est encore inscrit.";
  return null;
}

export interface Progress {
  /** Entre 0 et 1. */
  readonly ratio: number;
  readonly label: string;
}

/**
 * Où en est la séquence — **des messages dus, pas des jours écoulés**.
 *
 * Le dénominateur est « un message par inscrit et par étape » : c'est ce que la
 * campagne doit livrer si personne ne répond. Il ne recule jamais quand
 * quelqu'un répond — l'inscription s'arrête alors et ses étapes restantes ne
 * partiront pas, mais les compter en moins ferait grimper la barre à chaque
 * réponse, c'est-à-dire exactement quand la campagne réussit. Une barre qui se
 * remplit parce qu'on a gagné ne mesure plus l'avancement (même règle que le
 * dénominateur de l'anneau du jalon 20).
 *
 * Sans inscrit ni étape il n'y a rien à mesurer : `0` plutôt qu'une division
 * par zéro rendue en « 100 % ».
 */
export function sequenceProgress(input: {
  readonly enrolled: number;
  readonly steps: number;
  /** Somme des étapes déjà envoyées, tous inscrits confondus. */
  readonly delivered: number;
}): Progress {
  const expected = input.enrolled * input.steps;
  if (expected <= 0) return { ratio: 0, label: "Rien à envoyer pour l'instant" };

  const done = Math.min(Math.max(input.delivered, 0), expected);
  const ratio = done / expected;
  return {
    ratio,
    label: `${done} message${done > 1 ? "s" : ""} sur ${expected} · étape ${stepLabel(input)}`,
  };
}

/** L'étape moyenne atteinte, en toutes lettres plutôt qu'en décimale. */
function stepLabel(input: {
  readonly enrolled: number;
  readonly steps: number;
  readonly delivered: number;
}): string {
  if (input.enrolled === 0) return `0/${input.steps}`;
  const average = Math.min(input.delivered / input.enrolled, input.steps);
  // Un chiffre après la virgule : « étape 1,4/3 » dit qu'une partie des
  // inscrits est passée à la deuxième, ce qu'un arrondi à l'entier cacherait.
  const shown = Number.isInteger(average) ? `${average}` : average.toFixed(1).replace(".", ",");
  return `${shown}/${input.steps}`;
}
