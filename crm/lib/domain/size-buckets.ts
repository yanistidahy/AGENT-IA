/**
 * **Les tranches de trafic, et la règle d'échantillon — une fonction chacune.**
 *
 * Pur, sans Prisma ni React. Les deux notions vivent ici parce qu'elles sont
 * lues par les quatre onglets du pilotage **et, depuis le jalon 115, par les
 * écrans de saisie** : une tranche décidée deux fois, ou un seuil de fiabilité
 * recopié dans un écran, et deux surfaces finissent par ranger la même marque
 * dans deux populations différentes. C'est l'écart que `no-duplicate-thresholds`
 * ferme depuis le jalon 7, et que la garde statique du pilotage tient depuis le
 * jalon 113 v2.
 *
 * ## Deux tranches de travail, et plus trois
 *
 * | Jalon | Tranches | Bornes |
 * |---|---|---|
 * | 109 | petites, grosses, non renseigné | 10 000 à 15 000 tombait dans « non renseigné » |
 * | 113 v2 | micro, petites, **intermédiaires**, grosses, non renseigné | 2 000 / 10 000 / 15 000 |
 * | **115** | micro, **petites**, **grosses**, non renseigné | 2 000 / 10 000 **inclus** |
 *
 * L'utilisateur a tranché : il travaille avec **deux** segments, pas trois.
 * « Intermédiaires » disparaît, et avec lui l'idée qu'une marque à 12 000
 * visiteurs serait un cas à part — c'est une grosse marque. Deux conséquences à
 * savoir, et les deux sont mesurées dans CLAUDE.md :
 *
 * 1. **tout ce qui était « intermédiaire » devient « grosse »** (10 000 exclu à
 *    15 000 exclu), et ce qui était « grosse » le reste ;
 * 2. **10 000 pile change de côté** : la borne haute des petites était exclusive
 *    au jalon 113 v2, elle est **inclusive** ici parce que le brief l'écrit
 *    (« 2 000 à 10 000 inclus »). Un rond chiffre est précisément ce qu'on
 *    saisit quand on estime, et le ranger des deux côtés selon l'écran serait
 *    l'incohérence qui décrédibilise un tableau de bord.
 *
 * **La tranche n'est jamais stockée.** Il n'existe aucune colonne « segment » :
 * elle se recalcule à chaque lecture depuis le trafic, donc elle ne peut pas
 * dériver quand quelqu'un corrige le nombre. C'est la doctrine de
 * `lib/domain/campaign-status.ts` appliquée ici — ce qui se déduit ne se tient
 * pas à jour à la main.
 */

export const SIZE_BUCKETS = ["micro", "small", "large", "unknown"] as const;
export type SizeBucket = (typeof SIZE_BUCKETS)[number];

/** Les libellés du brief, au mot près. */
export const SIZE_LABELS: Record<SizeBucket, string> = {
  micro: "Moins de 2 000",
  small: "Petites marques",
  large: "Grosses marques",
  unknown: "Non renseigné",
};

/** Les libellés courts, pour une puce ou un en-tête de colonne. */
export const SIZE_SHORT: Record<SizeBucket, string> = {
  micro: "< 2 000",
  small: "Petites",
  large: "Grosses",
  unknown: "Non renseigné",
};

/**
 * Le libellé **au singulier**, pour la badge d'une fiche.
 *
 * « Grosse marque · 24 000 visiteurs/mois » parle d'**une** marque ; réutiliser
 * le pluriel des cartes de l'onglet Segments donnerait « Grosses marques » sur
 * la fiche d'une société, c'est-à-dire une faute d'accord à chaque ouverture.
 */
export const SIZE_ONE: Record<SizeBucket, string> = {
  micro: "Moins de 2 000",
  small: "Petite marque",
  large: "Grosse marque",
  unknown: "Trafic non renseigné",
};

/**
 * Les bornes, écrites une fois.
 *
 * `SMALL.min` **et** `SMALL.max` sont inclusifs depuis le jalon 115 : 2 000 est
 * une petite marque, 10 000 aussi, 10 001 est une grosse. En dessous de
 * `SMALL.min`, « Moins de 2 000 ».
 */
export const SMALL = { min: 2_000, max: 10_000 } as const;

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
  if (monthlyVisitors < SMALL.min) return "micro";
  if (monthlyVisitors <= SMALL.max) return "small";
  return "large";
}

export function isSizeBucket(value: string): value is SizeBucket {
  return (SIZE_BUCKETS as readonly string[]).includes(value);
}

/* ------------------------------------------------- le trafic, affiché ----- */

/** Le nombre, groupé à la française : « 24 000 ». */
export function visitorsLabel(monthlyVisitors: number): string {
  return monthlyVisitors.toLocaleString("fr-FR");
}

/**
 * **La phrase de la badge**, écrite une fois pour les trois surfaces qui la
 * portent : la fiche société, la ligne société d'un contact, et la liste.
 *
 * `null` rend « Trafic non renseigné » — jamais « 0 visiteurs/mois », qui
 * affirmerait un site sans visite là où personne n'a mesuré.
 */
export function visitorsBadge(monthlyVisitors: number | null): string {
  const bucket = sizeBucketOf(monthlyVisitors);
  if (monthlyVisitors === null) return SIZE_ONE.unknown;
  return `${SIZE_ONE[bucket]} · ${visitorsLabel(monthlyVisitors)} visiteurs/mois`;
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
