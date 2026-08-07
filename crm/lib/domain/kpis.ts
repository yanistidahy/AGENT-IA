import { daysBetween, daysSince, monthKey } from "./dates";
import { openDeals, resolveStage, weightedValue } from "./pipeline";
import type { ContactLike, DealLike, StageLike } from "./types";

export interface FunnelRow {
  readonly stageId: string;
  readonly label: string;
  readonly color: string;
  readonly count: number;
  readonly amount: number;
  /** Taux de passage depuis l'étape précédente, en %. `null` sur la première. */
  readonly rate: number | null;
}

export interface ForecastPoint {
  readonly month: string;
  readonly value: number;
}

/** Affaires clôturées dans la fenêtre de `days` jours. `null` = depuis le début. */
export function withinPeriod(
  date: Date | null,
  days: number | null,
  now: Date,
): boolean {
  if (date === null) return false;
  if (days === null) return true;
  return daysSince(date, now) <= days;
}

export function wonDeals(
  deals: readonly DealLike[],
  days: number | null,
  now: Date,
): DealLike[] {
  return deals.filter((d) => d.status === "won" && withinPeriod(d.closedAt, days, now));
}

export function lostDeals(
  deals: readonly DealLike[],
  days: number | null,
  now: Date,
): DealLike[] {
  return deals.filter((d) => d.status === "lost" && withinPeriod(d.closedAt, days, now));
}

/** Chiffre d'affaires signé. */
export function revenue(deals: readonly DealLike[]): number {
  return deals.reduce((total, deal) => total + deal.amount, 0);
}

/**
 * Taux de closing, en %. `0` quand aucune affaire n'est clôturée sur la période
 * — on ne divise jamais par zéro.
 */
export function winRate(won: readonly DealLike[], lost: readonly DealLike[]): number {
  const closed = won.length + lost.length;
  if (closed === 0) return 0;
  return Math.round((won.length / closed) * 100);
}

/** Cycle de vente moyen en jours : création → signature, sur les affaires gagnées. */
export function cycle(won: readonly DealLike[]): number {
  const measurable = won.filter((deal) => deal.closedAt !== null);
  if (measurable.length === 0) return 0;
  const total = measurable.reduce((sum, deal) => {
    const closedAt = deal.closedAt;
    if (closedAt === null) return sum;
    return sum + daysBetween(deal.createdAt, closedAt);
  }, 0);
  return Math.round(total / measurable.length);
}

/** Panier moyen sur les affaires gagnées. */
export function averageWonDeal(won: readonly DealLike[]): number {
  if (won.length === 0) return 0;
  return revenue(won) / won.length;
}

/**
 * Entonnoir de conversion.
 * Une affaire a « atteint » l'étape d'index `i` si elle est gagnée, ou si son
 * étape courante est d'index supérieur ou égal à `i` — règle du prototype.
 */
export function funnel(
  deals: readonly DealLike[],
  stages: readonly StageLike[],
): FunnelRow[] {
  const ordered = [...stages].sort((a, b) => a.position - b.position);
  const indexById = new Map(ordered.map((stage, index) => [stage.id, index]));

  const rows: FunnelRow[] = [];
  ordered.forEach((stage, index) => {
    const reached = deals.filter((deal) => {
      if (deal.status === "won") return true;
      const dealIndex = indexById.get(deal.stageId);
      return dealIndex !== undefined && dealIndex >= index;
    });

    const previous = rows[index - 1];
    const rate =
      previous !== undefined && previous.count > 0
        ? Math.round((reached.length / previous.count) * 100)
        : null;

    rows.push({
      stageId: stage.id,
      label: stage.name,
      color: stage.color,
      count: reached.length,
      amount: revenue(reached),
      rate,
    });
  });

  return rows;
}

/**
 * Prévision de revenus pondérée, par mois de clôture prévue.
 * Seules les affaires en cours comptent : une affaire gagnée est du CA, pas une
 * prévision.
 */
export function forecast(
  deals: readonly DealLike[],
  stages: readonly StageLike[],
  months: readonly string[],
): ForecastPoint[] {
  const open = openDeals(deals);
  return months.map((month) => {
    const value = open.reduce((total, deal) => {
      if (deal.expectedClose === null) return total;
      if (monthKey(deal.expectedClose) !== month) return total;
      return total + weightedValue(deal, resolveStage(stages, deal.stageId));
    }, 0);
    return { month, value: Math.round(value) };
  });
}

/** CA signé par mois, sur les mois demandés. */
export function revenueByMonth(
  deals: readonly DealLike[],
  months: readonly string[],
): ForecastPoint[] {
  return months.map((month) => {
    const value = deals.reduce((total, deal) => {
      if (deal.status !== "won" || deal.closedAt === null) return total;
      if (monthKey(deal.closedAt) !== month) return total;
      return total + deal.amount;
    }, 0);
    return { month, value };
  });
}

/** Taux de qualification : part des contacts créés sur la période sortis du statut « Lead ». */
export function conversionRate(
  contacts: readonly ContactLike[],
  days: number | null,
  now: Date,
): number {
  const leads = contacts.filter((c) => withinPeriod(c.createdAt, days, now));
  if (leads.length === 0) return 0;
  const qualified = leads.filter((c) => c.lifecycle !== "Lead");
  return Math.round((qualified.length / leads.length) * 100);
}

/** Rétention : clients actifs rapportés au total clients actifs + anciens clients. */
export function retention(contacts: readonly ContactLike[]): number {
  const active = contacts.filter((c) => c.lifecycle === "Client").length;
  const churned = contacts.filter((c) => c.lifecycle === "Ancien Client").length;
  if (active + churned === 0) return 100;
  return Math.round((active / (active + churned)) * 100);
}
