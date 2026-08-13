import { daysBetween, startOfDay } from "./dates";
import type { ActivityType } from "./types";

/**
 * Les mesures de la prospection.
 *
 * `/rapports` ne savait mesurer que le closing : chiffre d'affaires, taux de
 * gain, cycle de vente. Sur un portefeuille sans affaire, tout y valait zéro —
 * l'écran était donc muet précisément pour quelqu'un dont l'activité du jour est
 * d'appeler des gens.
 *
 * Ce module calcule ce qui bouge tous les jours. Il est pur : il reçoit des
 * formes minimales et une horloge, et ne connaît ni Prisma ni React.
 *
 * **Aucun taux n'est inventé.** Partout où le dénominateur est nul, la fonction
 * rend `null` plutôt que zéro — zéro pour cent affirme un échec, l'absence de
 * données n'affirme rien. C'est la règle déjà posée pour l'entonnoir de
 * l'accueil, reprise ici sans exception.
 */

/* ------------------------------------------------------------- rythme */

export interface ActivityLike {
  readonly date: Date;
  readonly type: ActivityType;
  /** Issue consignée ; chaîne vide quand personne ne l'a renseignée. */
  readonly outcome: string;
}

export interface WeekBucket {
  /** Lundi de la semaine, à minuit. */
  readonly start: Date;
  readonly label: string;
  readonly total: number;
  readonly byType: Readonly<Record<string, number>>;
}

/** Lundi de la semaine contenant `date`. Les semaines commencent le lundi. */
export function weekStart(date: Date): Date {
  const day = startOfDay(date);
  // `getDay()` rend 0 le dimanche : on le ramène à 6 pour que la semaine
  // commence le lundi, comme le reste du produit.
  const offset = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - offset);
  return day;
}

const WEEK_LABEL = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" });

/**
 * Le rythme des `weeks` dernières semaines, la plus ancienne d'abord.
 *
 * Les semaines vides sont **présentes**, à zéro : les omettre transformerait
 * une semaine sans prospection en trou dans la courbe, c'est-à-dire en rien —
 * alors que c'est justement l'information.
 */
export function weeklyRhythm(
  activities: readonly ActivityLike[],
  weeks: number,
  now: Date,
): readonly WeekBucket[] {
  const current = weekStart(now);
  const buckets: WeekBucket[] = [];

  for (let index = weeks - 1; index >= 0; index -= 1) {
    const start = new Date(current);
    start.setDate(start.getDate() - index * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const inWeek = activities.filter((item) => item.date >= start && item.date < end);
    const byType: Record<string, number> = {};
    for (const item of inWeek) byType[item.type] = (byType[item.type] ?? 0) + 1;

    buckets.push({
      start,
      label: WEEK_LABEL.format(start),
      total: inWeek.length,
      byType,
    });
  }

  return buckets;
}

/* --------------------------------------------------- réponse par canal */

export interface ChannelRate {
  readonly channel: ActivityType;
  /** Échanges dont l'issue est renseignée — le seul dénominateur honnête. */
  readonly known: number;
  readonly answered: number;
  /** `null` quand aucune issue n'est connue sur ce canal. */
  readonly rate: number | null;
  /** Échanges consignés, issue renseignée ou non. */
  readonly total: number;
}

/**
 * Le taux de réponse par canal — le nombre qui devrait changer demain.
 *
 * Le dénominateur ne compte que les échanges **dont l'issue est connue** :
 * compter les interactions sans issue comme des non-réponses ferait passer un
 * défaut de saisie pour un échec commercial. `total` est rendu à côté pour que
 * l'écran puisse dire sur quelle proportion le taux porte.
 */
export function responseByChannel(activities: readonly ActivityLike[]): readonly ChannelRate[] {
  const map = new Map<ActivityType, { known: number; answered: number; total: number }>();

  for (const item of activities) {
    const row = map.get(item.type) ?? { known: 0, answered: 0, total: 0 };
    row.total += 1;
    if (item.outcome !== "") {
      row.known += 1;
      if (item.outcome !== "no-answer") row.answered += 1;
    }
    map.set(item.type, row);
  }

  return [...map.entries()]
    .map(([channel, row]) => ({
      channel,
      known: row.known,
      answered: row.answered,
      total: row.total,
      rate: row.known === 0 ? null : Math.round((row.answered / row.known) * 100),
    }))
    .sort((a, b) => b.total - a.total);
}

/* ------------------------------------------- délai avant premier contact */

export interface FirstTouchLike {
  readonly createdAt: Date;
  /** Première interaction consignée, `null` si la fiche n'a jamais été touchée. */
  readonly firstActivityAt: Date | null;
}

export interface FirstTouch {
  /** Médiane des délais, en jours. `null` si aucune fiche n'a été touchée. */
  readonly medianDays: number | null;
  readonly touched: number;
  /** Fiches jamais approchées — l'arriéré, et son ancienneté. */
  readonly untouched: number;
  readonly untouchedMedianAgeDays: number | null;
}

/**
 * Combien de temps s'écoule entre l'entrée d'un contact et le premier appel.
 *
 * **Médiane et non moyenne** : trois fiches touchées le jour même et une
 * oubliée depuis huit mois donneraient une moyenne de deux mois, qui ne décrit
 * aucune des quatre. La médiane dit ce qui se passe d'habitude.
 *
 * L'arriéré est compté à part, avec son ancienneté médiane : ce sont les fiches
 * qui n'ont pas de délai *parce qu'elles attendent encore*, et les fondre dans
 * le même nombre les ferait disparaître.
 */
export function firstTouchDelay(rows: readonly FirstTouchLike[], now: Date): FirstTouch {
  const delays: number[] = [];
  const ages: number[] = [];

  for (const row of rows) {
    if (row.firstActivityAt === null) {
      ages.push(daysBetween(row.createdAt, now));
      continue;
    }
    delays.push(Math.max(daysBetween(row.createdAt, row.firstActivityAt), 0));
  }

  return {
    medianDays: median(delays),
    touched: delays.length,
    untouched: ages.length,
    untouchedMedianAgeDays: median(ages),
  };
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const low = sorted[middle - 1];
  const high = sorted[middle];
  if (low === undefined || high === undefined) return null;
  return Math.round((low + high) / 2);
}

/* -------------------------------------------------- discipline de relance */

export interface ReminderWeek {
  readonly label: string;
  readonly honoured: number;
  readonly missed: number;
}

export interface ReminderLike {
  readonly due: Date;
  readonly done: boolean;
  readonly doneAt: Date | null;
}

/**
 * Relances tenues contre relances manquées, semaine par semaine.
 *
 * « Tenue » veut dire **terminée au plus tard le jour de l'échéance**. Compter
 * comme tenue une relance faite trois semaines après reviendrait à mesurer
 * qu'on finit par tout faire, ce qui est vrai de tout le monde et n'apprend
 * rien. Les relances encore ouvertes et non échues ne comptent nulle part : le
 * jugement n'est pas encore tombé.
 */
export function reminderDiscipline(
  reminders: readonly ReminderLike[],
  weeks: number,
  now: Date,
): readonly ReminderWeek[] {
  const current = weekStart(now);
  const output: ReminderWeek[] = [];

  for (let index = weeks - 1; index >= 0; index -= 1) {
    const start = new Date(current);
    start.setDate(start.getDate() - index * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    let honoured = 0;
    let missed = 0;
    for (const item of reminders) {
      if (item.due < start || item.due >= end) continue;
      if (item.done && item.doneAt !== null) {
        if (startOfDay(item.doneAt) <= startOfDay(item.due)) honoured += 1;
        else missed += 1;
      } else if (item.due < startOfDay(now)) {
        missed += 1;
      }
    }

    output.push({ label: WEEK_LABEL.format(start), honoured, missed });
  }

  return output;
}

/* ------------------------------------------------- vieillissement du vivier */

export interface AgeBracket {
  readonly label: string;
  readonly count: number;
}

/** Bornes en jours, exclusives à droite. La dernière tranche est ouverte. */
const BRACKETS: ReadonlyArray<{ label: string; upTo: number }> = [
  { label: "< 7 j", upTo: 7 },
  { label: "7–30 j", upTo: 30 },
  { label: "30–90 j", upTo: 90 },
  { label: "90–180 j", upTo: 180 },
  { label: "> 180 j", upTo: Number.POSITIVE_INFINITY },
];

/**
 * Le vivier jamais approché, par tranche d'ancienneté.
 *
 * Un arriéré de soixante-treize fiches est un nombre ; le même arriéré dont
 * quarante dorment depuis plus de trois mois est un problème. C'est la
 * répartition qui le dit, pas le total.
 */
export function poolAging(ages: readonly number[]): readonly AgeBracket[] {
  return BRACKETS.map((bracket, index) => {
    const from = index === 0 ? 0 : (BRACKETS[index - 1]?.upTo ?? 0);
    return {
      label: bracket.label,
      count: ages.filter((age) => age >= from && age < bracket.upTo).length,
    };
  });
}

/* ------------------------------------------------- taux de qualification */

export interface SourceRate {
  readonly source: string;
  readonly contacts: number;
  readonly qualified: number;
  /** `null` quand la source n'a aucun contact — jamais zéro pour cent. */
  readonly rate: number | null;
}

export interface QualifiableLike {
  readonly source: string;
  readonly qualified: boolean;
}

/**
 * Contacts devenus `Qualifié`, par source.
 *
 * C'est la mesure qui dit où chercher : une source à 12 % et une à 1 % ne
 * méritent pas le même effort, et le total les confond.
 */
export function qualificationBySource(rows: readonly QualifiableLike[]): readonly SourceRate[] {
  const map = new Map<string, { contacts: number; qualified: number }>();

  for (const row of rows) {
    const key = row.source === "" ? "(sans source)" : row.source;
    const entry = map.get(key) ?? { contacts: 0, qualified: 0 };
    entry.contacts += 1;
    if (row.qualified) entry.qualified += 1;
    map.set(key, entry);
  }

  return [...map.entries()]
    .map(([source, entry]) => ({
      source,
      contacts: entry.contacts,
      qualified: entry.qualified,
      rate: entry.contacts === 0 ? null : Math.round((entry.qualified / entry.contacts) * 100),
    }))
    .sort((a, b) => b.qualified - a.qualified || b.contacts - a.contacts);
}
