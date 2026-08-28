import { addDays, dayKey, daysBetween, startOfDay } from "./dates";
import { weekStart } from "./email-stats";
import type { ActivityType } from "./types";

/**
 * « Ma performance » — la part pure.
 *
 * Ce module mesure **la personne, pas le contact** : le rythme de travail, ce
 * qu'il produit, et sa régularité. Trois principes le gouvernent :
 *
 * 1. **Il mesure ce qui est consigné, pas ce qui est fait.** Un appel jamais
 *    consigné n'existe pas ici. La page le dit en toutes lettres, sinon une
 *    baisse de saisie se lirait comme une baisse de travail.
 * 2. **Une période se compare à la précédente de même longueur**, terminée là
 *    où celle-ci commence. Comparer « cette semaine » à un mois glissant ne
 *    compare rien.
 * 3. **La régularité se mesure en jours ouvrés.** « 12 jours actifs sur 15
 *    ouvrés » dit plus qu'un total — et compter les week-ends en jours
 *    inactifs punirait le repos.
 */

/* ------------------------------------------------------------- périodes */

export const PERIODS = ["jour", "semaine", "mois", "90j", "libre"] as const;
export type PeriodKind = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<PeriodKind, string> = {
  jour: "Aujourd'hui",
  semaine: "Cette semaine",
  mois: "Ce mois",
  "90j": "90 jours",
  libre: "Période libre",
};

export interface Period {
  readonly kind: PeriodKind;
  /** Premier jour, minuit inclus. */
  readonly from: Date;
  /** Borne haute **exclusive** : le minuit qui suit le dernier jour. */
  readonly to: Date;
}

/**
 * La période demandée, bornée sur des jours entiers.
 *
 * « Cette semaine » commence le lundi et « ce mois » le premier — des périodes
 * calendaires, pas glissantes : c'est ainsi qu'on se demande « qu'ai-je fait
 * cette semaine ». « 90 jours » est la seule fenêtre glissante, comme partout
 * ailleurs dans le produit. Une période libre invalide retombe sur la semaine
 * plutôt que d'échouer : un lien vieilli doit ouvrir l'écran.
 */
export function resolvePeriod(
  kind: PeriodKind,
  now: Date,
  custom?: { readonly from: Date; readonly to: Date },
): Period {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);

  if (kind === "jour") return { kind, from: today, to: tomorrow };
  if (kind === "semaine") return { kind, from: weekStart(now), to: tomorrow };
  if (kind === "mois") {
    return { kind, from: new Date(now.getFullYear(), now.getMonth(), 1), to: tomorrow };
  }
  if (kind === "90j") return { kind, from: addDays(today, -89), to: tomorrow };

  if (custom !== undefined && custom.from.getTime() <= custom.to.getTime()) {
    return {
      kind,
      from: startOfDay(custom.from),
      to: addDays(startOfDay(custom.to), 1),
    };
  }
  return { ...resolvePeriod("semaine", now), kind: "semaine" };
}

/**
 * La période de comparaison : même longueur, terminée où celle-ci commence.
 *
 * Pour les périodes calendaires, c'est la période calendaire précédente
 * **entière** — comparer trois jours de semaine entamée à sept jours de
 * semaine pleine ferait apparaître chaque lundi comme un effondrement.
 * La direction honnête est donc affichée avec sa légende : « vs la semaine
 * dernière (complète) ».
 */
export function previousPeriod(period: Period, now: Date): Period {
  if (period.kind === "semaine") {
    const start = weekStart(now);
    return { kind: period.kind, from: addDays(start, -7), to: start };
  }
  if (period.kind === "mois") {
    return {
      kind: period.kind,
      from: new Date(period.from.getFullYear(), period.from.getMonth() - 1, 1),
      to: period.from,
    };
  }
  const days = Math.max(1, daysBetween(period.from, period.to));
  return { kind: period.kind, from: addDays(period.from, -days), to: period.from };
}

export function inPeriod(date: Date, period: Period): boolean {
  return date >= period.from && date < period.to;
}

/** Nombre de jours couverts, la journée en cours comprise. */
export function periodDays(period: Period, now: Date): number {
  const end = Math.min(period.to.getTime(), addDays(startOfDay(now), 1).getTime());
  return Math.max(0, Math.round((end - period.from.getTime()) / 86_400_000));
}

/* ------------------------------------------------------------ activité */

/** Un canal de la mesure : un type d'interaction, ou l'issue d'un appel. */
export interface ActivityLike {
  readonly date: Date;
  readonly type: ActivityType;
  readonly outcome: string | null;
  readonly owner: string;
}

export interface DayStack {
  readonly key: string;
  readonly label: string;
  /** Compte par canal, tous présents — zéro compris, pour l'empilement. */
  readonly counts: Readonly<Record<ActivityType, number>>;
  readonly total: number;
}

const EMPTY_COUNTS: Readonly<Record<ActivityType, number>> = {
  call: 0,
  email: 0,
  meeting: 0,
  demo: 0,
  note: 0,
  linkedin: 0,
  instagram: 0,
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * L'activité par jour, canaux empilés, **jours vides compris**.
 *
 * Les jours sans rien restent dans la série à zéro : c'est précisément eux
 * qu'on veut voir. Une courbe qui saute les jours creux transforme une semaine
 * d'inaction en continuité — le mensonge visuel déjà refusé au jalon 37.
 */
export function dailyStacks(
  activities: readonly ActivityLike[],
  period: Period,
  now: Date,
): DayStack[] {
  const byDay = new Map<string, Record<ActivityType, number>>();
  for (const activity of activities) {
    if (!inPeriod(activity.date, period)) continue;
    const key = dayKey(activity.date);
    const counts = byDay.get(key) ?? { ...EMPTY_COUNTS };
    counts[activity.type] += 1;
    byDay.set(key, counts);
  }

  const stacks: DayStack[] = [];
  const days = periodDays(period, now);
  for (let index = 0; index < days; index += 1) {
    const day = addDays(period.from, index);
    const key = dayKey(day);
    const counts = byDay.get(key) ?? EMPTY_COUNTS;
    stacks.push({
      key,
      label: `${pad(day.getDate())}/${pad(day.getMonth() + 1)}`,
      counts,
      total: Object.values(counts).reduce((sum, value) => sum + value, 0),
    });
  }
  return stacks;
}

/* -------------------------------------------------------- comparaison */

export interface Delta {
  readonly current: number;
  readonly previous: number;
  readonly diff: number;
  /** Le texte « +8 vs la semaine dernière » se compose à l'écran ; ici le sens. */
  readonly direction: "up" | "down" | "flat";
}

export function delta(current: number, previous: number): Delta {
  const diff = current - previous;
  return {
    current,
    previous,
    diff,
    direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
  };
}

/* -------------------------------------------------------- régularité */

/** Samedi et dimanche ne sont pas des jours de travail — règle du jalon 38. */
export function isWorkingDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

export interface Consistency {
  /** Jours ouvrés couverts par la période, la journée en cours comprise. */
  readonly workingDays: number;
  /** Jours ouvrés portant au moins une interaction consignée. */
  readonly activeDays: number;
  /**
   * Jours ouvrés consécutifs actifs, en remontant depuis aujourd'hui.
   *
   * Aujourd'hui sans activité **ne casse pas la série** : la journée n'est pas
   * finie, et une série qui tombe à zéro chaque matin ne mesurerait que
   * l'heure de la lecture. Elle ne le prolonge pas non plus.
   */
  readonly currentStreak: number;
  /** La plus longue série de jours ouvrés actifs de la période. */
  readonly longestStreak: number;
}

export function consistency(
  activityDates: readonly Date[],
  period: Period,
  now: Date,
): Consistency {
  const active = new Set<string>();
  for (const date of activityDates) {
    if (inPeriod(date, period) && isWorkingDay(date)) active.add(dayKey(date));
  }

  let workingDays = 0;
  let longest = 0;
  let run = 0;
  const days = periodDays(period, now);
  for (let index = 0; index < days; index += 1) {
    const day = addDays(period.from, index);
    if (!isWorkingDay(day)) continue; // un week-end ne casse pas une série
    workingDays += 1;
    if (active.has(dayKey(day))) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }

  // La série en cours : depuis aujourd'hui en remontant, jours ouvrés
  // seulement, la journée en cours indulgente.
  let current = 0;
  let cursor = startOfDay(now);
  let first = true;
  while (cursor >= period.from) {
    if (isWorkingDay(cursor)) {
      if (active.has(dayKey(cursor))) current += 1;
      else if (!first) break;
      first = false;
    }
    cursor = addDays(cursor, -1);
  }

  return { workingDays, activeDays: active.size, currentStreak: current, longestStreak: longest };
}

/* ------------------------------------------------------------ objectif */

export interface TargetProgress {
  readonly target: number;
  readonly done: number;
  /** Borné à 1 : un objectif dépassé est atteint, pas à 130 %. */
  readonly share: number;
}

/**
 * L'avancement vers l'objectif hebdomadaire. `target: 0` signifie « pas
 * d'objectif réglé » — l'appelant n'affiche alors rien plutôt qu'un « 4 sur
 * 0 » : sans objectif, un nombre n'est qu'un nombre, et c'est précisément la
 * raison d'être du réglage.
 */
export function targetProgress(done: number, target: number): TargetProgress | null {
  if (target <= 0) return null;
  return { target, done, share: Math.min(1, done / target) };
}
