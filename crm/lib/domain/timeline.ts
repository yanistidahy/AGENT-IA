/**
 * **« Dans le temps » : les seaux, les cibles, et la valeur d'un point.**
 *
 * Pur, sans Prisma ni React. Tout ce que le graphique affiche vient d'ici, et
 * `tests/pilotage-source.test.ts` échoue si une vue se remet à compter.
 *
 * ## Ce que l'ancien graphique faisait mal, et ce qui le remplace
 *
 * Douze semaines fixes, dont dix vides ; des barres empilées où aucun canal ne
 * se compare à un autre ; rien au survol ni au clic. Mesuré en production :
 * 44 messages la semaine du 26 octobre, 349 celle du 2 novembre, et dix
 * colonnes de néant à gauche qui écrasaient l'échelle.
 *
 * Quatre décisions le remplacent :
 *
 * 1. **la plage commence à la première période qui porte quelque chose.** Une
 *    série qui s'ouvre sur dix zéros ne dit pas « rien ne s'est passé », elle
 *    dit « l'échelle est fausse » : la plus haute barre est comparée au vide,
 *    et les deux semaines qui comptent se tassent à droite. Les zéros
 *    **à l'intérieur** de la plage restent, eux : un creux au milieu d'une
 *    série est une information, un vide avant le début n'en est pas une ;
 * 2. **une granularité se choisit.** Le jour pour vérifier une semaine, la
 *    semaine pour tenir la cadence, le mois pour voir la tendance. Une seule
 *    granularité imposée oblige à lire la mauvaise question ;
 * 3. **l'empilement devient un choix.** « Total » répond « combien », « Par
 *    canal » répond « par où » — deux questions que des barres empilées
 *    prétendent traiter d'un coup et ne traitent ni l'une ni l'autre, parce
 *    qu'un segment au milieu d'une pile n'a pas de base commune avec son
 *    voisin ;
 * 4. **la valeur d'un point est celle de la liste qu'il ouvre**, par
 *    construction : `pointValue` appelle `metricResult`, la fonction du jalon
 *    109 qui rend la liste. Il n'y a pas un comptage « pour le graphique » et
 *    une requête « pour la liste ».
 */

import { OUTREACH_CHANNELS, type OutreachChannel } from "./outreach";
import { parisDayKey, parisDayRange } from "./mailbox-cap";
import { parisWall } from "./auto-send";
import {
  METRIC_LABELS,
  inPeriod,
  metricResult,
  slice,
  type EventRow,
  type Metric,
  type Period,
} from "./pilotage";

/* ------------------------------------------------------ les granularités --- */

export const GRANULARITIES = ["jour", "semaine", "mois"] as const;
export type Granularity = (typeof GRANULARITIES)[number];

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  jour: "Jour",
  semaine: "Semaine",
  mois: "Mois",
};

export function toGranularity(value: string): Granularity {
  return (GRANULARITIES as readonly string[]).includes(value) ? (value as Granularity) : "semaine";
}

/* ------------------------------------------------------------- les vues ---- */

export const TIMELINE_VIEWS = ["total", "canal"] as const;
export type TimelineView = (typeof TIMELINE_VIEWS)[number];

export const VIEW_LABELS: Record<TimelineView, string> = {
  total: "Total",
  canal: "Par canal",
};

export function toTimelineView(value: string): TimelineView {
  return (TIMELINE_VIEWS as readonly string[]).includes(value) ? (value as TimelineView) : "total";
}

/**
 * Les trois indicateurs que le graphique sait tracer.
 *
 * Un sous-ensemble assumé de `METRICS` : « démos qualifiées » se compte sur
 * l'histoire entière (trois faits étalés sur des semaines), donc sa valeur par
 * semaine n'a pas le sens qu'une barre suggère. Les trois retenus sont des
 * **faits datés** dont l'addition par période veut dire quelque chose.
 */
export const TIMELINE_METRICS: readonly Metric[] = ["messages", "new_contacted", "replies"];

export function toTimelineMetric(value: string): Metric {
  return TIMELINE_METRICS.includes(value as Metric) ? (value as Metric) : "messages";
}

export function timelineMetricLabel(metric: Metric): string {
  return METRIC_LABELS[metric];
}

/* ------------------------------------------------------------ les seaux ---- */

/** Un seau de temps : ses bornes exactes, et comment on le nomme. */
export interface Bucket extends Period {
  /** Clé stable, utilisée comme clé React et dans l'URL de la liste. */
  readonly key: string;
  /** Le libellé court de l'axe : « 2 nov. », « lun. 2 », « nov. 2026 ». */
  readonly short: string;
  /** Les dates exactes, pour l'infobulle : « lun. 2 nov. – dim. 8 nov. ». */
  readonly exact: string;
  /** `YYYY-MM-DD` du premier et du dernier jour, pour la plage libre. */
  readonly fromKey: string;
  readonly toKey: string;
}

/**
 * `YYYY-MM-DD` du jour **de Paris**, par la fonction qui le décide déjà.
 *
 * Écrire `start.toISOString().slice(0, 10)` paraît équivalent et ne l'est pas :
 * le début d'un jour de Paris est 23 h UTC **la veille** en hiver, donc le
 * découpage de l'ISO rend la date précédente. Ce défaut a décalé d'un jour les
 * trois seaux et la bande de cadence, et neuf tests l'ont attrapé d'un coup.
 */
function dayKeyOf(date: Date): string {
  return parisDayKey(date);
}

/** Le dernier jour **inclus** d'une période dont la borne haute est exclusive. */
function lastDayOf(period: Period): Date {
  return parisDayRange(new Date(period.end.getTime() - 1)).start;
}

const DAY_FMT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});
const DAY_SHORT_FMT = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  timeZone: "Europe/Paris",
});
const WEEK_SHORT_FMT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});
const MONTH_FMT = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

/** Le jour de Paris qui contient `at`, comme seau. */
export function dayBucket(at: Date): Bucket {
  const range = parisDayRange(at);
  const key = dayKeyOf(at);
  return {
    start: range.start,
    end: range.end,
    label: DAY_FMT.format(range.start),
    key: `j:${key}`,
    short: DAY_SHORT_FMT.format(range.start),
    exact: DAY_FMT.format(range.start),
    fromKey: key,
    toKey: key,
  };
}

/** La semaine de Paris (lundi → dimanche) qui contient `at`. */
export function weekBucket(at: Date): Bucket {
  const weekday = parisWall(at).weekday;
  const backToMonday = weekday === 0 ? 6 : weekday - 1;
  const monday = parisDayRange(new Date(at.getTime() - backToMonday * 86_400_000)).start;
  const sunday = parisDayRange(new Date(monday.getTime() + 6 * 86_400_000));
  return {
    start: monday,
    end: sunday.end,
    label: `semaine du ${WEEK_SHORT_FMT.format(monday)}`,
    key: `s:${dayKeyOf(monday)}`,
    short: WEEK_SHORT_FMT.format(monday),
    // Les deux bornes, parce que « semaine du 2 nov. » laisse deviner si le
    // dimanche est dedans. L'infobulle ne doit rien laisser deviner.
    exact: `${DAY_FMT.format(monday)} – ${DAY_FMT.format(sunday.start)}`,
    fromKey: dayKeyOf(monday),
    toKey: dayKeyOf(sunday.start),
  };
}

/** Le mois de Paris qui contient `at`. */
export function monthBucket(at: Date): Bucket {
  const first = parisDayRange(at).start;
  const day = Number.parseInt(dayKeyOf(first).slice(8, 10), 10);
  const start = parisDayRange(new Date(first.getTime() - (day - 1) * 86_400_000)).start;
  // Le 32 du mois tombe toujours dans le suivant, quelle que soit sa longueur.
  const inNext = new Date(start.getTime() + 32 * 86_400_000);
  const nextDay = Number.parseInt(dayKeyOf(inNext).slice(8, 10), 10);
  const end = parisDayRange(new Date(inNext.getTime() - (nextDay - 1) * 86_400_000)).start;
  const last = parisDayRange(new Date(end.getTime() - 1)).start;
  return {
    start,
    end,
    label: MONTH_FMT.format(start),
    key: `m:${dayKeyOf(start).slice(0, 7)}`,
    short: MONTH_FMT.format(start),
    exact: `${DAY_FMT.format(start)} – ${DAY_FMT.format(last)}`,
    fromKey: dayKeyOf(start),
    toKey: dayKeyOf(last),
  };
}

export function bucketOf(at: Date, granularity: Granularity): Bucket {
  if (granularity === "jour") return dayBucket(at);
  if (granularity === "mois") return monthBucket(at);
  return weekBucket(at);
}

/** Le seau suivant, obtenu en sautant d'un jour au-delà de la borne haute. */
export function nextBucket(bucket: Bucket, granularity: Granularity): Bucket {
  return bucketOf(new Date(bucket.end.getTime() + 86_400_000 / 2), granularity);
}

/**
 * Les seaux qui couvrent une plage, du premier au dernier **sans trou**.
 *
 * Les périodes vides *à l'intérieur* sont donc présentes, et c'est voulu : un
 * creux au milieu d'une série est une information. Ce que l'on retire, c'est la
 * course de zéros **avant** le premier fait — voir `trimLeadingEmpty`.
 *
 * `max` est un garde-fou, pas une préférence : une plage libre de deux ans en
 * granularité « jour » produirait sept cents barres illisibles et autant
 * d'appels à `metricResult`. Atteindre la borne garde les seaux **les plus
 * récents**, qui sont ceux qu'on regarde.
 */
export function bucketsBetween(
  from: Date,
  to: Date,
  granularity: Granularity,
  max = 120,
): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor = bucketOf(from, granularity);
  const limit = to.getTime();
  /*
    La borne de boucle est **fixe et large**, pas dérivée de `max` : la lier à
    `max` arrêtait la marche avant la fin de la plage, et l'on gardait alors les
    `max` premiers seaux en croyant garder les derniers. Mesuré : une plage de
    91 jours avec `max = 10` rendait le 10 octobre comme dernier seau.
    Deux mille itérations couvrent cinq ans de jours.
  */
  for (let guard = 0; guard < 2000 && cursor.start.getTime() <= limit; guard += 1) {
    buckets.push(cursor);
    cursor = nextBucket(cursor, granularity);
  }
  return buckets.length > max ? buckets.slice(buckets.length - max) : buckets;
}

/* ----------------------------------------------- la valeur d'un point ------ */

/**
 * **La valeur d'un seau, et la liste qu'il ouvre, sortent du même appel.**
 *
 * `metricResult` est la fonction du jalon 109 : elle rend `{count, rows}` avec
 * `count === rows.length` par construction. Le graphique affiche `count`, la
 * page de liste affiche `rows` — en refaisant exactement ce chemin. C'est ce
 * qui rend l'item 3 du test d'acceptation vrai sans avoir à y penser.
 *
 * `all` est l'histoire entière (filtrée par la barre de filtres) : « nouvelle
 * personne contactée » a besoin de savoir si quelqu'un a été touché **avant**
 * le seau, et une lecture bornée au seau compterait comme neuve une personne
 * approchée depuis six mois.
 */
export function pointValue(
  all: readonly EventRow[],
  bucket: Bucket,
  metric: Metric,
): number {
  return metricResult(all, slice(all, bucket), bucket, metric).count;
}

/* ------------------------------------------------------------ les cibles --- */

/**
 * La cible d'un seau, mise à l'échelle de sa granularité, ou `null`.
 *
 * - **semaine** : la cible hebdomadaire, telle quelle ;
 * - **jour** : la cible divisée par cinq, et **seulement en jour ouvré**. Un
 *   samedi n'a pas de cible : le produit n'envoie pas le week-end (jalon 93),
 *   et tracer une cible de 20 un dimanche afficherait un retard que personne
 *   n'a décidé ;
 * - **mois** : la cible multipliée par le nombre de **semaines ouvrées** du
 *   mois, soit ses jours ouvrés divisés par cinq. Un mois de 22 jours ouvrés
 *   vaut donc 4,4 semaines. C'est « la cible hebdomadaire × le nombre de
 *   semaines du mois » mesuré honnêtement : compter 4 semaines pour février et
 *   pour un mois de 23 jours ouvrés donnerait la même cible à deux mois qui ne
 *   se ressemblent pas.
 *
 * `null` quand l'indicateur n'a pas de cible — seuls « messages envoyés »,
 * « démos envoyées » et « démos qualifiées » en ont (jalon 109), et le
 * graphique ne trace que le premier des trois. Une ligne de cible inventée pour
 * « réponses » serait un objectif que personne n'a fixé.
 */
export function targetFor(
  bucket: Bucket,
  granularity: Granularity,
  weeklyTarget: number | null,
): number | null {
  if (weeklyTarget === null || weeklyTarget <= 0) return null;
  if (granularity === "semaine") return weeklyTarget;
  if (granularity === "jour") {
    return isParisWeekday(bucket.start) ? Math.round(weeklyTarget / 5) : null;
  }
  return Math.round((weeklyTarget * workdaysIn(bucket)) / 5);
}

/** Vrai du lundi au vendredi, au fuseau de Paris. */
export function isParisWeekday(at: Date): boolean {
  const weekday = parisWall(at).weekday;
  return weekday >= 1 && weekday <= 5;
}

/** Les jours ouvrés d'un seau, bornes incluses. */
export function workdaysIn(bucket: Bucket): number {
  let count = 0;
  let cursor = parisDayRange(bucket.start).start;
  const last = lastDayOf(bucket).getTime();
  for (let guard = 0; guard < 400 && cursor.getTime() <= last; guard += 1) {
    if (isParisWeekday(cursor)) count += 1;
    cursor = parisDayRange(new Date(cursor.getTime() + 36 * 3_600_000)).start;
  }
  return count;
}

/** La cible hebdomadaire d'un indicateur, ou `null` s'il n'en a pas. */
export function weeklyTargetFor(
  metric: Metric,
  targets: { readonly messages: number; readonly demos: number; readonly qualified: number },
): number | null {
  if (metric === "messages") return targets.messages;
  if (metric === "demos_sent") return targets.demos;
  if (metric === "qualified") return targets.qualified;
  return null;
}

/* ------------------------------------------------------------ la série ----- */

/** Ce qu'un point du graphique porte, et tout ce dont l'infobulle a besoin. */
export interface TimelinePoint {
  readonly bucket: Bucket;
  readonly total: number;
  /** Par canal, et **seulement pour les canaux qui portent quelque chose**. */
  readonly byChannel: Readonly<Record<OutreachChannel, number>>;
  /** `crm` / `lemlist` / `manual` — d'où viennent les faits de ce seau. */
  readonly bySource: Readonly<Record<string, number>>;
  readonly target: number | null;
  /** Le total du seau précédent, ou `null` pour le premier de la série. */
  readonly previous: number | null;
}

const ZERO_CHANNELS: Record<OutreachChannel, number> = {
  email: 0,
  linkedin_invite: 0,
  linkedin_message: 0,
  whatsapp: 0,
  call: 0,
  other: 0,
};

/**
 * **La série, une valeur par seau.**
 *
 * `byChannel` n'est pas une répartition du total calculée à part : chaque canal
 * est compté par le **même** chemin que le total, sur l'histoire réduite à ce
 * canal. C'est ce qui fait que cliquer sur un point de la vue « Par canal »
 * ouvre une liste de la même longueur — l'item 3 du test d'acceptation porte
 * sur les deux vues, et il serait faux si la répartition était une division du
 * total.
 *
 * La raison est subtile et vaut d'être écrite : pour « nouvelles personnes
 * contactées », la somme des canaux **n'est pas** le total. Quelqu'un touché la
 * même semaine par email et par LinkedIn est une personne nouvelle une fois
 * dans le total, et une fois dans *chacun* des deux canaux — parce que c'est sa
 * première touche sur chacun. Diviser le total aurait caché ce fait ; le
 * recompter par canal le rend exact, canal par canal, et l'infobulle dit les
 * parts par rapport au total sans prétendre qu'elles font 100 %.
 */
export function buildSeries(
  all: readonly EventRow[],
  buckets: readonly Bucket[],
  metric: Metric,
  granularity: Granularity,
  weeklyTarget: number | null,
): TimelinePoint[] {
  const perChannel = new Map<OutreachChannel, EventRow[]>();
  for (const channel of OUTREACH_CHANNELS) {
    perChannel.set(
      channel,
      all.filter((row) => row.channel === channel),
    );
  }

  const points: TimelinePoint[] = [];
  for (const bucket of buckets) {
    const total = pointValue(all, bucket, metric);

    const byChannel = { ...ZERO_CHANNELS };
    for (const channel of OUTREACH_CHANNELS) {
      byChannel[channel] = pointValue(perChannel.get(channel) ?? [], bucket, metric);
    }

    const bySource: Record<string, number> = {};
    for (const row of metricResult(all, slice(all, bucket), bucket, metric).rows) {
      bySource[row.source] = (bySource[row.source] ?? 0) + 1;
    }

    points.push({
      bucket,
      total,
      byChannel,
      bySource,
      target: targetFor(bucket, granularity, weeklyTarget),
      previous: points.length === 0 ? null : (points[points.length - 1]?.total ?? null),
    });
  }
  return points;
}

/**
 * **Retire la course de zéros du début, et rien d'autre.**
 *
 * C'est le défaut nommé par le jalon : dix colonnes vides à gauche, deux
 * semaines qui comptent tassées à droite, et une échelle réglée sur du vide.
 * Les zéros **à l'intérieur** restent — un creux au milieu d'une série dit
 * quelque chose —, et une série entièrement vide est rendue telle quelle :
 * elle est le fait, et l'écran dira « aucune donnée ».
 */
export function trimLeadingEmpty(points: readonly TimelinePoint[]): TimelinePoint[] {
  const first = points.findIndex((point) => point.total > 0);
  if (first <= 0) return [...points];
  const kept = points.slice(first);
  // Le premier point conservé n'a plus de précédent affiché : son « par rapport
  // à la période précédente » serait un écart contre une période qu'on a
  // retirée de l'écran, donc trompeur.
  const head = kept[0];
  if (head === undefined) return kept;
  return [{ ...head, previous: null }, ...kept.slice(1)];
}

/** Les canaux qui portent au moins un fait dans la série, dans l'ordre fixé. */
export function channelsWithData(points: readonly TimelinePoint[]): OutreachChannel[] {
  return OUTREACH_CHANNELS.filter((channel) =>
    points.some((point) => point.byChannel[channel] > 0),
  );
}

/** Le plus haut nombre à faire tenir dans l'échelle, cible comprise. */
export function peakOf(
  points: readonly TimelinePoint[],
  view: TimelineView,
  visible: readonly OutreachChannel[],
): number {
  let peak = 1;
  for (const point of points) {
    if (view === "total") {
      peak = Math.max(peak, point.total, point.target ?? 0);
    } else {
      for (const channel of visible) peak = Math.max(peak, point.byChannel[channel]);
    }
  }
  return peak;
}

/* ------------------------------------------------- la semaine en cours ----- */

export interface PaceDay {
  readonly key: string;
  readonly label: string;
  /** Le cumul des messages depuis lundi, ce jour inclus. */
  readonly cumulative: number;
  /** Le cumul attendu à la fin de ce jour, si la cadence est tenue. */
  readonly expected: number;
  /** Faux pour les jours encore à venir : on ne compare pas ce qui n'a pas eu lieu. */
  readonly elapsed: boolean;
}

export interface WeekPace {
  readonly days: readonly PaceDay[];
  readonly total: number;
  /** Le cumul attendu **à ce jour**, pas en fin de semaine. */
  readonly expected: number;
  /** Positif : en avance. Négatif : en retard. */
  readonly gap: number;
  readonly target: number;
  readonly sentence: string;
}

/**
 * **La bande « Semaine en cours » : la cadence, jour par jour.**
 *
 * La cible se répartit sur les **cinq jours ouvrés** et non sur sept : c'est
 * ainsi que le produit envoie (jalon 93, fenêtre 9 h – 17 h en jours ouvrés),
 * et étaler cent messages sur sept jours afficherait un retard le lundi matin
 * qu'aucune décision n'a créé.
 *
 * L'écart se mesure **à ce jour** et non en fin de semaine. « En retard de 60 »
 * un lundi serait vrai et inutile : il reste quatre jours. Ce qui est comparé,
 * c'est le cumul réel contre le cumul attendu à la fin du jour écoulé le plus
 * récent.
 */
export function weekPace(
  all: readonly EventRow[],
  now: Date,
  weeklyTarget: number,
): WeekPace {
  const week = weekBucket(now);
  const today = parisDayRange(now).start.getTime();

  const days: PaceDay[] = [];
  let cumulative = 0;
  let workdaysSoFar = 0;
  const perWorkday = weeklyTarget / 5;

  let cursor = parisDayRange(week.start).start;
  for (let index = 0; index < 7; index += 1) {
    const day = dayBucket(cursor);
    const sent = pointValue(all, day, "messages");
    const elapsed = day.start.getTime() <= today;
    cumulative += elapsed ? sent : 0;
    if (isParisWeekday(day.start)) workdaysSoFar += 1;

    days.push({
      key: day.key,
      label: DAY_SHORT_FMT.format(day.start),
      cumulative,
      expected: Math.round(perWorkday * workdaysSoFar),
      elapsed,
    });
    /*
      `day.end` **est déjà** minuit du lendemain : y ajouter trente-six heures
      saute un jour. Les sept « jours » couvraient alors treize jours réels, et
      un week-end se retrouvait au milieu de la cadence. On vise donc midi du
      lendemain, qui est sans ambiguïté même un jour de changement d'heure.
    */
    cursor = parisDayRange(new Date(day.end.getTime() + 12 * 3_600_000)).start;
  }

  const lastElapsed = [...days].reverse().find((day) => day.elapsed);
  const expected = lastElapsed?.expected ?? 0;
  const total = lastElapsed?.cumulative ?? 0;
  const gap = total - expected;

  return {
    days,
    total,
    expected,
    gap,
    target: weeklyTarget,
    sentence:
      gap === 0
        ? `Pile dans la cadence : ${total} message${total > 1 ? "s" : ""} pour ${expected} attendus.`
        : gap > 0
          ? `En avance de ${gap} : ${total} message${total > 1 ? "s" : ""} pour ${expected} attendus.`
          : `En retard de ${Math.abs(gap)} : ${total} message${total > 1 ? "s" : ""} pour ${expected} attendus.`,
  };
}

/* ------------------------------------------------------- les écarts dits --- */

/** « +249 (349 %) » ou « −12 (-8 %) ». Vide quand il n'y a rien à comparer. */
export function gapLabel(value: number, reference: number | null): string {
  if (reference === null) return "";
  const gap = value - reference;
  const sign = gap > 0 ? "+" : gap < 0 ? "−" : "";
  if (reference === 0) return `${sign}${Math.abs(gap)}`;
  const share = Math.round((value / reference) * 100);
  return `${sign}${Math.abs(gap)} (${share} %)`;
}

/** La part d'un canal dans le total du seau, ou le tiret du jalon 20. */
export function shareLabel(value: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((value / total) * 100)} %`;
}

/* ------------------------------------------------------------- la plage ---- */

export interface TimelineRange {
  readonly from: Date;
  readonly to: Date;
  /** Pourquoi la plage commence là, écrit pour l'écran. */
  readonly note: string;
}

/**
 * **La plage du graphique, et pourquoi elle n'est pas celle des pastilles.**
 *
 * Les pastilles répondent « combien cette semaine » ; le graphique répond
 * « comment ça évolue ». Honorer littéralement la période de la barre de
 * filtres — « cette semaine » par défaut — rendrait **une seule barre**, ce qui
 * n'est pas un graphique. La plage par défaut va donc du **premier fait connu**
 * jusqu'à maintenant.
 *
 * Une **plage libre** (`periode=libre`, deux bornes saisies) est en revanche un
 * choix explicite de fenêtre : elle gagne, et le graphique s'y tient. C'est la
 * lecture utile de « ou la période de la barre de filtres si elle est plus
 * étroite » : une fenêtre choisie est plus étroite, une période d'indicateur
 * n'en est pas une.
 *
 * Dans les deux cas, la course de zéros du début est retirée **après** le
 * calcul de la série, par `trimLeadingEmpty` : c'est là qu'on sait quelle
 * période porte réellement quelque chose pour l'indicateur choisi, et un
 * indicateur peut commencer plus tard qu'un autre.
 */
export function timelineRange(
  all: readonly EventRow[],
  period: Period,
  isCustom: boolean,
  now: Date,
): TimelineRange {
  if (isCustom) {
    return {
      from: period.start,
      to: new Date(Math.min(period.end.getTime(), now.getTime())),
      note: "plage choisie dans les filtres",
    };
  }

  let earliest: number | null = null;
  for (const row of all) {
    const at = row.occurredAt.getTime();
    if (earliest === null || at < earliest) earliest = at;
  }
  if (earliest === null) {
    // Rien du tout : on rend une plage d'un seau, et l'écran dira « aucune
    // donnée » plutôt que de dessiner des axes vides.
    return { from: now, to: now, note: "aucun fait enregistré" };
  }

  return {
    from: new Date(earliest),
    to: now,
    note: "depuis le premier fait enregistré",
  };
}

/**
 * La phrase qui dit la plage réellement affichée.
 *
 * Elle nomme les deux bornes **après** le retrait des zéros du début : une
 * plage annoncée « depuis septembre » au-dessus d'un graphique qui commence en
 * octobre serait un mensonge, et c'est le genre d'écart que ce produit refuse
 * (jalon 20).
 */
export function rangeNote(points: readonly TimelinePoint[], base: string): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return base;
  if (points.length === 1) return `${first.bucket.exact} · ${base}`;
  return `${first.bucket.short} → ${last.bucket.short} · ${base}`;
}
