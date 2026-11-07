/**
 * **Les tranches de taille, et la règle d'échantillon — une fonction chacune.**
 *
 * Pur, sans Prisma ni React. Les deux notions vivent ici parce qu'elles sont
 * lues par les quatre onglets du pilotage : une tranche décidée deux fois, ou
 * un seuil de fiabilité recopié dans un écran, et deux cartes finissent par
 * ranger la même marque dans deux populations différentes. C'est l'écart que
 * `no-duplicate-thresholds` ferme depuis le jalon 7.
 *
 * ## Ce qui change par rapport au jalon 109
 *
 * Le jalon 109 avait trois segments — petites, grandes, non renseigné — et
 * rangeait **l'intervalle 10 000 à 15 000 dans « non renseigné »**, parce que
 * le brief d'alors ne le décrivait pas et qu'inventer une appartenance aurait
 * gonflé un segment d'après une règle que personne n'avait posée. C'était la
 * décision honnête avec l'information disponible.
 *
 * Le prototype validé nomme maintenant cinq tranches, dont cet intervalle
 * (« Intermédiaires ») et une tranche basse (« Moins de 2 000 »). On ne devine
 * donc plus : chaque marque tombe dans la tranche qui la décrit, et
 * « Non renseigné » redevient ce qu'il dit — on ne connaît pas son trafic.
 *
 * **Conséquence à savoir** : une marque à 12 000 visiteurs comptait hier dans
 * « non renseigné » et compte aujourd'hui dans « Intermédiaires ». Les deux
 * cartes « Petites » et « Grosses » ne bougent pas, elles — leurs bornes sont
 * inchangées.
 */

export const SIZE_BUCKETS = ["micro", "small", "mid", "large", "unknown"] as const;
export type SizeBucket = (typeof SIZE_BUCKETS)[number];

/** Les libellés du prototype, au mot près. */
export const SIZE_LABELS: Record<SizeBucket, string> = {
  micro: "Moins de 2 000",
  small: "Petites 2 000 à 10 000",
  mid: "Intermédiaires 10 000 à 15 000",
  large: "Grosses 15 000 et plus",
  unknown: "Non renseigné",
};

/** Les libellés courts, pour une puce ou un en-tête de colonne. */
export const SIZE_SHORT: Record<SizeBucket, string> = {
  micro: "< 2 000",
  small: "Petites",
  mid: "Intermédiaires",
  large: "Grosses",
  unknown: "Non renseigné",
};

/**
 * Les bornes, écrites une fois.
 *
 * `SMALL.min` est **inclusif** et `SMALL.max` **exclusif** : une marque à
 * exactement 10 000 visiteurs est « intermédiaire », pas « petite ». Le choix
 * compte parce qu'un rond chiffre comme 10 000 est précisément la valeur qu'on
 * saisit à la main quand on estime, et la ranger des deux côtés selon l'écran
 * serait le genre d'incohérence qui décrédibilise un tableau de bord.
 */
export const MICRO_MAX = 2_000;
export const SMALL = { min: 2_000, max: 10_000 } as const;
export const MID = { min: 10_000, max: 15_000 } as const;
export const LARGE_MIN = 15_000;

/**
 * La tranche d'une marque d'après son trafic mensuel.
 *
 * `null` — le trafic n'est pas renseigné — rend `unknown`. Un zéro, en
 * revanche, est une **valeur** : une marque à 0 visiteur déclaré tombe dans
 * « Moins de 2 000 ». Confondre « je ne sais pas » et « zéro » est exactement
 * ce que la règle du jalon 20 interdit.
 */
export function sizeBucketOf(monthlyVisitors: number | null): SizeBucket {
  if (monthlyVisitors === null) return "unknown";
  if (monthlyVisitors < MICRO_MAX) return "micro";
  if (monthlyVisitors < SMALL.max) return "small";
  if (monthlyVisitors < LARGE_MIN) return "mid";
  return "large";
}

export function isSizeBucket(value: string): value is SizeBucket {
  return (SIZE_BUCKETS as readonly string[]).includes(value);
}

/* ================================================================== *
 *  La règle d'échantillon
 * ================================================================== */

export const RELIABILITY = ["unusable", "weak", "solid"] as const;
export type Reliability = (typeof RELIABILITY)[number];

/** Les deux seuils, écrits une fois. */
export const WEAK_FROM = 10;
export const SOLID_FROM = 30;

/**
 * **Ce qu'un taux vaut, d'après le nombre de personnes derrière lui.**
 *
 * Un taux de réponse de 100 % sur une personne et un taux de 11,8 % sur 340
 * s'affichent de la même façon et ne disent pas du tout la même chose. Sans
 * cette règle, le premier gagne toujours l'attention — il est plus gros — et on
 * décide d'insister sur une population d'une personne.
 *
 * Trois états, et le vocabulaire du prototype :
 *
 * - **moins de 10** : « à ne pas interpréter ». Pas « faible » : il n'y a rien
 *   à lire du tout, et le chiffre est affiché hachuré ou en gris pour qu'on ne
 *   le compare pas ;
 * - **10 à 29** : « échantillon faible ». On peut regarder, pas conclure ;
 * - **30 et plus** : « fiable ». C'est le seuil au-delà duquel une différence
 *   entre deux taux commence à valoir quelque chose, et c'est pour cela que la
 *   puce de comparaison des deux cartes de segment n'apparaît que si les
 *   **deux** échantillons l'atteignent.
 */
export function reliabilityOf(n: number): Reliability {
  if (n < WEAK_FROM) return "unusable";
  if (n < SOLID_FROM) return "weak";
  return "solid";
}

export const RELIABILITY_LABELS: Record<Reliability, string> = {
  unusable: "à ne pas interpréter",
  weak: "échantillon faible",
  solid: "fiable",
};

export function reliabilityLabel(n: number): string {
  return RELIABILITY_LABELS[reliabilityOf(n)];
}

/** Vrai quand le nombre est trop petit pour qu'on affiche le taux sans réserve. */
export function tooSmallToRead(n: number): boolean {
  return reliabilityOf(n) === "unusable";
}

/**
 * **Comparer deux taux, et ne le faire que quand c'est permis.**
 *
 * Rend la phrase du prototype (« 3 fois moins de réponses ») pour le **plus
 * faible** des deux, ou `null`. Trois refus, et chacun évite une affirmation
 * fausse :
 *
 * 1. **un échantillon sous 30 de chaque côté** : la différence observée peut
 *    n'être que du hasard, et la nommer « 3 fois moins » lui donne une autorité
 *    qu'elle n'a pas ;
 * 2. **un taux de référence nul** : « une infinité de fois moins » n'est pas
 *    une phrase, et c'est la règle du jalon 20 — un dénominateur nul rend le
 *    tiret, pas un nombre ;
 * 3. **un rapport inférieur à 1,5** : « 1,1 fois moins » est du bruit présenté
 *    comme un écart.
 */
export function comparisonLabel(
  weaker: { readonly rate: number; readonly n: number },
  stronger: { readonly rate: number; readonly n: number },
): string | null {
  if (reliabilityOf(weaker.n) !== "solid" || reliabilityOf(stronger.n) !== "solid") return null;
  if (weaker.rate <= 0 || stronger.rate <= 0) return null;
  if (stronger.rate <= weaker.rate) return null;

  const ratio = stronger.rate / weaker.rate;
  if (ratio < 1.5) return null;

  const rounded = ratio >= 10 ? Math.round(ratio) : Math.round(ratio * 10) / 10;
  const shown = String(rounded).replace(".", ",");
  return `${shown} fois moins de réponses`;
}
