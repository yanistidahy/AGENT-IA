/**
 * Le rythme d'une séquence, lu depuis ses étapes — pur, sans Prisma ni React.
 *
 * Une séquence est **une suite dans le temps**, et c'est la seule chose que
 * l'ancien formulaire ne montrait pas : trois rangées de champs alignées se
 * lisent comme un tableau de réglages, pas comme « ce message part, puis
 * quatre jours plus tard celui-ci ». Les fonctions ci-dessous composent les
 * phrases que la frise affiche, à un seul endroit — deux écrans les montrent
 * (la campagne et /reglages), et deux formulations finiraient par diverger.
 *
 * **Le délai d'une étape court depuis l'étape précédente**, jamais depuis
 * l'inscription (jalon 38) : reporter un départ d'un jour décale la suite d'un
 * jour. Le jour cumulé est donc calculé, jamais stocké — le stocker le ferait
 * mentir dès qu'un délai change.
 */

export interface StepTiming {
  /** Jours depuis l'étape précédente, tels que saisis. */
  readonly delayDays: number;
  /** Jours depuis l'inscription, cumulés. */
  readonly day: number;
}

/** Le nombre de jours depuis l'inscription, étape par étape. */
export function stepDays(steps: ReadonlyArray<{ readonly delayDays: number }>): StepTiming[] {
  let day = 0;
  return steps.map((step, index) => {
    // La première étape part le jour de l'inscription, quoi que porte son
    // champ : c'est la règle du moteur, et l'écran ne peut pas en promettre
    // une autre.
    const delayDays = index === 0 ? 0 : Math.max(0, step.delayDays);
    day += delayDays;
    return { delayDays, day };
  });
}

/**
 * L'étiquette portée par le connecteur, entre deux blocs.
 *
 * C'est elle qui rend le rythme lisible sans ouvrir une seule étape — la
 * demande de ce jalon. Zéro jour se dit en toutes lettres : « J+0 » se lit
 * comme un champ vide, « le même jour » comme une décision.
 */
export function connectorLabel(delayDays: number): string {
  const days = Math.max(0, delayDays);
  return days === 0 ? "le même jour" : `J+${days}`;
}

/** Quand cette étape part, dite dans le bloc lui-même. */
export function describeTiming(index: number, timing: StepTiming): string {
  if (index === 0) return "Part le jour de l'inscription";
  const since =
    timing.delayDays === 0
      ? `le même jour que l'étape ${index}`
      : `${timing.delayDays} jour${timing.delayDays > 1 ? "s" : ""} après l'étape ${index}`;
  return `Part ${since} · jour ${timing.day} de la séquence`;
}

export interface StepPreview {
  readonly text: string;
  /** Sans consigne, cette étape **n'écrit rien** (jalon 56). */
  readonly empty: boolean;
}

const PREVIEW_MAX = 90;

/**
 * De quoi reconnaître une étape sans l'ouvrir.
 *
 * Un aperçu, pas le texte entier : le but est de retrouver la bonne étape d'un
 * coup d'œil, et une consigne de quatre cents caractères rendue en entier
 * remettrait la structure sous le contenu — exactement ce qu'on vient de
 * défaire.
 */
export function stepPreview(brief: string, mode: string = "alex"): StepPreview {
  const manual = mode === "manual";
  const first = brief.split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
  if (first === "") {
    return {
      text: manual
        ? "Aucun texte : cette étape n'écrira rien tant qu'elle reste vide."
        : "Aucune consigne : cette étape n'écrira rien tant qu'elle reste vide.",
      empty: true,
    };
  }
  return {
    text: first.length > PREVIEW_MAX ? `${first.slice(0, PREVIEW_MAX - 1).trimEnd()}…` : first,
    empty: false,
  };
}

/**
 * Déplace une étape d'un cran, **sans déplacer le rythme**.
 *
 * Le délai appartient au rang, pas au message : monter la troisième étape veut
 * dire « ce message part plus tôt », pas « toute la cadence change ». Faire
 * voyager le délai avec le message donnerait en prime une première étape à
 * J+4, que le moteur ramènerait à zéro en silence — un écran qui promet autre
 * chose que ce qui se passera.
 *
 * Rend le tableau inchangé quand le mouvement sort des bornes : c'est ce qui
 * permet à l'appelant de désactiver les flèches sans dupliquer la règle.
 */
export function moveStep<T extends { readonly delayDays: number }>(
  steps: readonly T[],
  index: number,
  direction: -1 | 1,
): T[] {
  const target = index + direction;
  if (index < 0 || index >= steps.length || target < 0 || target >= steps.length) {
    return [...steps];
  }
  const a = steps[index] as T;
  const b = steps[target] as T;
  const next = [...steps];
  next[index] = { ...b, delayDays: a.delayDays };
  next[target] = { ...a, delayDays: b.delayDays };
  return next;
}

/**
 * Une étape peut-elle écrire quelque chose ?
 *
 * **La question est la même dans les deux modes, la colonne lue ne l'est pas** :
 * une étape d'Alex a besoin de sa consigne, une étape manuelle de son texte.
 * Avant le jalon 87, le garde-fou de composition ne regardait que `brief` — une
 * campagne entièrement écrite à la main aurait donc été refusée au motif
 * qu'« aucune étape ne porte de consigne », ce qui était vrai et hors sujet.
 */
export function stepReady(step: {
  readonly mode?: string;
  readonly brief: string;
  readonly body?: string;
}): boolean {
  return step.mode === "manual" ? (step.body ?? "").trim() !== "" : step.brief.trim() !== "";
}
