import { daysBetween, startOfDay } from "./dates";

/**
 * Combien d'histoire existe, et donc quel graphique a le droit de s'afficher.
 *
 * **Un graphique n'est pas une décoration : c'est une affirmation sur une
 * série.** Douze barres dont onze sont à zéro n'affirment rien — elles occupent
 * la moitié d'un écran pour dire « il ne s'est presque rien passé », ce qu'une
 * phrase dit mieux et en une ligne. Le reproche à l'origine de ce module est
 * exactement celui-là : onze emails envoyés, et un écran qui montre surtout du
 * vide.
 *
 * La règle est donc que **la forme suit l'histoire disponible**, et qu'elle y
 * revient toute seule à mesure qu'elle s'accumule — sans réglage, sans bouton.
 *
 * | Étendue d'activité | Ce qui se rend |
 * |---|---|
 * | moins de 7 jours | la liste des envois seule |
 * | 7 à 27 jours | le quotidien, **sur l'étendue réelle** — pas sur 30 jours figés |
 * | 28 jours et plus | le quotidien et l'hebdomadaire |
 *
 * Et surtout : **un graphique absent se dit**, avec la condition de son retour.
 * Un cadre vide se lit comme une panne ; « à partir de 4 semaines d'activité »
 * se lit comme une promesse.
 *
 * Module pur : les bornes se testent sans base et sans horloge réelle.
 */

/** L'étendue à partir de laquelle un graphique quotidien porte quelque chose. */
export const DAILY_MIN_DAYS = 7;

/** Quatre semaines : la valeur demandée, et le premier moment où quatre barres existent. */
export const WEEKLY_MIN_DAYS = 28;

/** Au-delà, le quotidien devient illisible et l'hebdomadaire prend le relais. */
export const DAILY_MAX_DAYS = 30;

/** Douze semaines : un trimestre, la même fenêtre que les rapports. */
export const WEEKLY_MAX_WEEKS = 12;

export interface MissingChart {
  readonly chart: "daily" | "weekly";
  /** La phrase affichée à la place du cadre — condition de retour comprise. */
  readonly notice: string;
}

export interface HistoryDepth {
  /**
   * Nombre de jours couverts, du premier envoi à aujourd'hui, **bornes
   * comprises**. Un seul envoi, passé ce matin, vaut 1 — pas 0 : il y a bien une
   * journée d'histoire.
   */
  readonly spanDays: number;
  readonly daily: boolean;
  readonly weekly: boolean;
  /** Largeur du graphique quotidien, en jours : l'étendue réelle, plafonnée. */
  readonly dailyDays: number;
  /** Largeur du graphique hebdomadaire, en semaines pleines. */
  readonly weeklyWeeks: number;
  /** Ce qui manque et pourquoi. Vide quand tout se rend. */
  readonly missing: readonly MissingChart[];
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * L'étendue de l'histoire, et ce qu'elle autorise.
 *
 * `dates` n'a pas besoin d'être triée : seule la plus ancienne compte. Une date
 * postérieure à `now` — horloge décalée, envoi programmé — ne rallonge pas
 * l'étendue, elle serait comptée en négatif.
 */
export function historyDepth(dates: readonly Date[], now: Date): HistoryDepth {
  if (dates.length === 0) {
    return { spanDays: 0, daily: false, weekly: false, dailyDays: 0, weeklyWeeks: 0, missing: [] };
  }

  const today = startOfDay(now);
  let oldest = today;
  for (const date of dates) {
    const day = startOfDay(date);
    if (day < oldest) oldest = day;
  }

  const spanDays = daysBetween(oldest, today) + 1;
  const daily = spanDays >= DAILY_MIN_DAYS;
  const weekly = spanDays >= WEEKLY_MIN_DAYS;

  const missing: MissingChart[] = [];
  if (!daily) {
    const left = DAILY_MIN_DAYS - spanDays;
    missing.push({
      chart: "daily",
      notice:
        `Graphique quotidien à partir de ${DAILY_MIN_DAYS} jours d'activité — ` +
        `encore ${left} ${plural(left, "jour", "jours")}. ` +
        `Sur ${spanDays} ${plural(spanDays, "jour", "jours")}, la liste des envois en dit davantage qu'une barre.`,
    });
  }
  if (!weekly) {
    const left = WEEKLY_MIN_DAYS - spanDays;
    missing.push({
      chart: "weekly",
      notice:
        `Graphique hebdomadaire à partir de 4 semaines d'activité — ` +
        `encore ${left} ${plural(left, "jour", "jours")}.`,
    });
  }

  return {
    spanDays,
    daily,
    weekly,
    // **L'étendue réelle, pas une fenêtre figée.** Sur onze jours d'activité,
    // un graphique de trente jours consacre les deux tiers de sa largeur à
    // affirmer qu'il ne s'est rien passé avant qu'on commence.
    dailyDays: daily ? Math.min(spanDays, DAILY_MAX_DAYS) : 0,
    weeklyWeeks: weekly ? Math.min(Math.ceil(spanDays / 7), WEEKLY_MAX_WEEKS) : 0,
    missing,
  };
}
