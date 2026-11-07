import {
  breakdown,
  funnel,
  messagesSent,
  nicheOf,
  peopleMessaged,
  peopleReplied,
  replyRate,
  type EventRow,
  type FunnelStep,
  type Period,
} from "./pilotage";
import { bucketsBetween, type Bucket, type Granularity } from "./timeline";
import {
  comparisonLabel,
  reliabilityOf,
  SIZE_LABELS,
  type Reliability,
  type SizeBucket,
} from "./size-buckets";

/**
 * **L'onglet « Segments », calculé ici et nulle part ailleurs.**
 *
 * La question de cet onglet est unique et elle est comparative : *est-ce que les
 * petites marques répondent mieux que les grosses, et depuis quand ?* Tout ce
 * fichier sert cette question, et il la sert avec une discipline particulière,
 * parce qu'une comparaison est la façon la plus facile de mentir avec des
 * chiffres justes.
 *
 * Trois règles, et chacune a coûté une version :
 *
 * 1. **chaque taux porte son `n`.** Deux cartes côte à côte invitent à conclure,
 *    et un 100 % sur deux personnes face à un 11 % sur trois cents gagne
 *    toujours le coup d'œil. Le `n` est donc dans la structure, pas dans la vue
 *    — une vue peut oublier de l'afficher, un champ obligatoire non ;
 * 2. **la comparaison ne s'énonce que quand elle est permise** —
 *    `comparisonLabel`, qui refuse sous trente personnes de chaque côté ;
 * 3. **les deux séries sortent de `replyRate`**, la même fonction que les
 *    pastilles. Il n'y a pas un taux « pour le graphique » et un autre « pour la
 *    carte » : c'est l'écart que le jalon 109 a fermé, et une courbe est
 *    exactement l'endroit où il se réinstalle.
 */

/* ------------------------------------------------- une carte de tranche --- */

export interface SizeCard {
  readonly bucket: SizeBucket;
  readonly label: string;
  /** Les marques distinctes de la tranche — le nombre **est** leur nombre. */
  readonly brands: readonly string[];
  /** Les personnes à qui un message est parti : le dénominateur du taux. */
  readonly contacted: readonly string[];
  /** Celles qui ont répondu : le numérateur. */
  readonly replied: readonly string[];
  readonly rate: number | null;
  readonly reliability: Reliability;
  readonly steps: readonly FunnelStep[];
  /** Les lignes de la tranche, pour que la vue n'ait rien à refiltrer. */
  readonly rows: readonly EventRow[];
}

/**
 * Une carte de tranche, sur les lignes **déjà filtrées** de la période.
 *
 * `allRows` sert la qualification, qui se juge sur l'histoire entière : une démo
 * envoyée la semaine dernière et un retour reçu cette semaine qualifient cette
 * semaine-ci (la règle de `qualifiedAt`).
 */
export function sizeCard(
  allRows: readonly EventRow[],
  rows: readonly EventRow[],
  period: Period,
  bucket: SizeBucket,
): SizeCard {
  const scoped = rows.filter((row) => row.size === bucket);
  const brands: string[] = [];
  const seen = new Set<string>();
  for (const row of scoped) {
    const name = row.companyName.trim();
    if (name === "" || seen.has(name)) continue;
    seen.add(name);
    brands.push(name);
  }
  const contacted = peopleMessaged(scoped);
  const replied = peopleReplied(scoped);
  // L'histoire bornée aux personnes de la tranche : l'entonnoir de la carte doit
  // parler des mêmes gens que son taux.
  const ids = new Set(scoped.map((row) => row.contactId));
  const history = allRows.filter((row) => ids.has(row.contactId));
  return {
    bucket,
    label: SIZE_LABELS[bucket],
    brands,
    contacted,
    replied,
    rate: replyRate(scoped),
    reliability: reliabilityOf(contacted.length),
    steps: funnel(history, scoped, period),
    rows: scoped,
  };
}

/**
 * **La puce de comparaison, posée sur la plus faible des deux cartes.**
 *
 * Sur la plus faible et non sur les deux : « 3 fois moins » et « 3 fois plus »
 * disent la même chose deux fois, et répéter un écart le fait paraître plus
 * grand qu'il n'est. Rend `null` dès que la comparaison n'est pas permise — voir
 * `comparisonLabel`.
 */
export function compareCards(
  a: SizeCard,
  b: SizeCard,
): { readonly bucket: SizeBucket; readonly label: string } | null {
  if (a.rate === null || b.rate === null) return null;
  const [weaker, stronger] = a.rate <= b.rate ? [a, b] : [b, a];
  const label = comparisonLabel(
    { rate: weaker.rate ?? 0, n: weaker.contacted.length },
    { rate: stronger.rate ?? 0, n: stronger.contacted.length },
  );
  if (label === null) return null;
  return { bucket: weaker.bucket, label };
}

/* ------------------------------------------------- l'évolution du taux ---- */

export const RATE_MODES = ["cumule", "periode"] as const;
export type RateMode = (typeof RATE_MODES)[number];

export const RATE_MODE_LABELS: Record<RateMode, string> = {
  cumule: "Cumulé",
  periode: "Par période",
};

export function toRateMode(value: string): RateMode {
  return (RATE_MODES as readonly string[]).includes(value) ? (value as RateMode) : "cumule";
}

export interface RatePoint {
  readonly bucket: Bucket;
  readonly rate: number | null;
  /** Le dénominateur : combien de personnes derrière ce point. */
  readonly n: number;
  /** Le numérateur, pour que l'infobulle dise « 4 sur 37 ». */
  readonly replied: number;
  readonly reliability: Reliability;
}

export interface RateSeries {
  readonly bucket: SizeBucket;
  readonly label: string;
  readonly points: readonly RatePoint[];
}

/**
 * **L'évolution du taux de réponse, en cumulé ou période par période.**
 *
 * Le cumulé est le défaut, et c'est un choix de fond : un taux hebdomadaire sur
 * huit personnes saute de 0 % à 25 % parce qu'une personne a répondu, et le
 * graphique raconte alors une histoire de hasard avec l'autorité d'une courbe.
 * Le cumulé se stabilise à mesure que l'échantillon grossit, ce qui est
 * exactement la propriété qu'on veut d'une tendance.
 *
 * Le mode période reste disponible — il montre un vrai retournement que le
 * cumulé lisse —, et chaque point y porte son `n` ; les points sous dix sont
 * rendus creux par la vue, parce que les afficher pleins les rendrait
 * comparables alors qu'ils ne le sont pas.
 */
export function rateSeries(
  rows: readonly EventRow[],
  buckets: readonly Bucket[],
  bucket: SizeBucket,
  mode: RateMode,
): RateSeries {
  const scoped = rows.filter((row) => row.size === bucket);
  const points: RatePoint[] = [];
  for (const period of buckets) {
    /*
      En cumulé, la fenêtre va du début de la plage à la fin de cette période ;
      en mode période, elle est la période seule. Les deux passent par le même
      `replyRate`, donc « taux de réponse » veut dire la même chose dans les
      deux modes — c'est tout l'intérêt de ne pas écrire la division ici.
    */
    const from = mode === "cumule" ? (buckets[0]?.start.getTime() ?? period.start.getTime()) : period.start.getTime();
    const window = scoped.filter((row) => {
      const at = row.occurredAt.getTime();
      return at >= from && at < period.end.getTime();
    });
    const n = peopleMessaged(window).length;
    const replied = peopleReplied(window).length;
    points.push({
      bucket: period,
      rate: replyRate(window),
      n,
      replied,
      reliability: reliabilityOf(n),
    });
  }
  return { bucket, label: SIZE_LABELS[bucket], points };
}

/* --------------------------------------------- les personnes contactées --- */

export interface ContactedBar {
  readonly bucket: Bucket;
  /** Une valeur par tranche demandée, dans l'ordre reçu. */
  readonly values: readonly { readonly bucket: SizeBucket; readonly count: number }[];
  readonly total: number;
}

/**
 * Les personnes contactées par période et par tranche, en barres groupées.
 *
 * Groupées et non empilées : la question est « combien de petites **contre**
 * combien de grosses », et une pile répond à « combien en tout », qu'on lit
 * déjà dans l'onglet d'à côté. Le total voyage tout de même, pour l'infobulle.
 */
export function contactedBars(
  rows: readonly EventRow[],
  buckets: readonly Bucket[],
  sizes: readonly SizeBucket[],
): ContactedBar[] {
  return buckets.map((period) => {
    const window = rows.filter((row) => {
      const at = row.occurredAt.getTime();
      return at >= period.start.getTime() && at < period.end.getTime();
    });
    const values = sizes.map((size) => ({
      bucket: size,
      count: peopleMessaged(window.filter((row) => row.size === size)).length,
    }));
    let total = 0;
    for (const value of values) total += value.count;
    return { bucket: period, values, total };
  });
}

/* ---------------------------------------------------------- par niche ----- */

export interface NicheLine {
  readonly key: string;
  readonly label: string;
  readonly contacted: number;
  readonly replies: number;
  readonly rate: number | null;
  readonly reliability: Reliability;
  readonly demos: number;
  readonly qualified: number;
  /** Le taux de réponse **cumulé** période par période : la tendance. */
  readonly trend: readonly (number | null)[];
}

export const NICHE_SORTS = ["taux", "contactees", "reponses", "demos", "qualifiees", "niche"] as const;
export type NicheSort = (typeof NICHE_SORTS)[number];

export function toNicheSort(value: string): NicheSort {
  return (NICHE_SORTS as readonly string[]).includes(value) ? (value as NicheSort) : "contactees";
}

/**
 * **Le tableau « Par niche », trié, avec sa tendance par ligne.**
 *
 * La tendance est le taux **cumulé** par période, la même définition que la
 * courbe du dessus : une niche dont le taux monte se voit, et on ne compare pas
 * une sparkline hebdomadaire bruyante à une courbe lissée dans le même écran.
 *
 * Le tri par défaut est « contactées » et non « taux » : trier par taux met en
 * tête la niche d'une seule personne qui a répondu, c'est-à-dire du bruit, et
 * c'est précisément ce que la colonne « fiabilité » existe pour signaler.
 */
export function nicheLines(
  allRows: readonly EventRow[],
  rows: readonly EventRow[],
  period: Period,
  buckets: readonly Bucket[],
  sort: NicheSort,
): NicheLine[] {
  /*
    **Les six colonnes communes viennent de `breakdown`**, la fonction que tous
    les tableaux de ce produit partagent depuis le jalon 109. Ce tableau n'y
    ajoute que ce qui lui est propre : la fiabilité et la tendance. Les
    recalculer ici en ferait une seconde définition de « taux de réponse », et
    c'est exactement l'écart que `breakdown` existe pour fermer.
  */
  const lines = breakdown(allRows, rows, period, nicheOf).map((line) => {
    const from = buckets[0]?.start.getTime() ?? period.start.getTime();
    const trend = buckets.map((slot) =>
      replyRate(
        line.rows.filter((row) => {
          const at = row.occurredAt.getTime();
          return at >= from && at < slot.end.getTime();
        }),
      ),
    );
    return {
      key: line.key,
      label: line.label,
      contacted: line.contacted,
      replies: line.replies,
      rate: line.replyRate,
      reliability: reliabilityOf(line.contacted),
      demos: line.demos,
      qualified: line.qualified,
      trend,
    };
  });

  return sortNiches(lines, sort);
}

function sortNiches(lines: readonly NicheLine[], sort: NicheSort): NicheLine[] {
  const out = [...lines];
  out.sort((a, b) => {
    switch (sort) {
      case "niche":
        return a.label.localeCompare(b.label, "fr");
      case "reponses":
        return b.replies - a.replies || b.contacted - a.contacted;
      case "demos":
        return b.demos - a.demos || b.contacted - a.contacted;
      case "qualifiees":
        return b.qualified - a.qualified || b.contacted - a.contacted;
      case "taux":
        /*
          **Un taux absent se range en bas, pas en haut.** `null` veut dire
          « rien à convertir » ; le traiter comme zéro mettrait une niche sans
          message au même rang qu'une niche qui a vraiment échoué, et le ranger
          en tête (ce que fait une comparaison naïve sur `null`) ferait du vide
          le meilleur résultat du tableau.
        */
        if (a.rate === null && b.rate === null) return b.contacted - a.contacted;
        if (a.rate === null) return 1;
        if (b.rate === null) return -1;
        return b.rate - a.rate || b.contacted - a.contacted;
      case "contactees":
        return b.contacted - a.contacted || a.label.localeCompare(b.label, "fr");
    }
  });
  return out;
}

/**
 * Les lignes d'une tranche, ou toutes.
 *
 * Elle existe pour que l'écran n'ait pas à filtrer lui-même : le tableau « Par
 * niche » se restreint à une tranche **sans** toucher au filtre de page, sinon
 * les deux cartes du dessus se restreindraient aussi et on comparerait les
 * petites aux petites.
 */
export function restrictToSize(
  rows: readonly EventRow[],
  bucket: SizeBucket | null,
): readonly EventRow[] {
  if (bucket === null) return rows;
  return rows.filter((row) => row.size === bucket);
}

/* ------------------------------------------- le trafic renseigné ou non --- */

/**
 * **« Trafic renseigné pour X personnes sur Y »**, le bandeau de l'onglet.
 *
 * Il ouvre l'onglet parce qu'il en conditionne la lecture : deux cartes qui
 * comparent petites et grosses sur un tiers des fiches ne décrivent pas la
 * prospection, elles décrivent le tiers qu'on a pris la peine de renseigner.
 * Le dire d'emblée est la seule façon honnête d'afficher la suite.
 *
 * Le compte porte sur les **personnes** de la période filtrée, pas sur les
 * marques en base : c'est la population que les cartes du dessous mesurent.
 */
export interface Coverage {
  readonly known: readonly string[];
  readonly total: readonly string[];
  readonly share: number | null;
}

export function visitorCoverage(rows: readonly EventRow[]): Coverage {
  const sent = messagesSent(rows);
  const total = peopleMessaged(sent);
  const known = peopleMessaged(sent.filter((row) => row.size !== "unknown"));
  return {
    known,
    total,
    share: total.length === 0 ? null : known.length / total.length,
  };
}

/* ------------------------------------------------ la plage des tranches --- */

/**
 * Les tranches qui portent au moins une personne, dans l'ordre des bornes.
 *
 * C'est ce qui réalise la clause « Moins de 2 000 affichée seulement si elle
 * n'est pas vide » du brief, et la même règle sert les autres puces : une
 * tranche vide n'est pas une information, c'est une case à ne pas dessiner.
 */
export function sizesWithData(
  rows: readonly EventRow[],
  order: readonly SizeBucket[],
): SizeBucket[] {
  return order.filter((size) => peopleMessaged(rows.filter((row) => row.size === size)).length > 0);
}

/**
 * Les périodes de l'onglet, du premier fait à maintenant.
 *
 * Même règle que « Dans le temps » : commencer à la première période qui porte
 * quelque chose, et garder les zéros intérieurs — un trou au milieu est une
 * information (on n'a pas prospecté cette semaine-là), un trou au début n'est
 * que l'absence d'historique.
 */
export function segmentBuckets(
  rows: readonly EventRow[],
  granularity: Granularity,
  now: Date,
): Bucket[] {
  let first: Date | null = null;
  for (const row of messagesSent(rows)) {
    if (first === null || row.occurredAt.getTime() < first.getTime()) first = row.occurredAt;
  }
  if (first === null) return [];
  return bucketsBetween(first, now, granularity);
}
