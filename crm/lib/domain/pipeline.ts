import { daysSince } from "./dates";
import type { DealHeat, DealLike, PilotageSettings, StageLike } from "./types";

/** Étape correspondant à `stageId`, ou `undefined` si l'étape n'existe plus. */
export function resolveStage(
  stages: readonly StageLike[],
  stageId: string,
): StageLike | undefined {
  return stages.find((stage) => stage.id === stageId);
}

/**
 * Probabilité effective d'une affaire.
 * La valeur portée par l'affaire surcharge celle de l'étape (règle du prototype :
 * `d.prob != null ? d.prob : stage.prob`).
 */
export function dealProb(deal: DealLike, stage: StageLike | undefined): number {
  if (deal.prob !== null) return deal.prob;
  return stage?.prob ?? 0;
}

/** Montant pondéré d'une affaire : `montant × probabilité / 100`. */
export function weightedValue(deal: DealLike, stage: StageLike | undefined): number {
  return (deal.amount * dealProb(deal, stage)) / 100;
}

export function isOpen(deal: DealLike): boolean {
  return deal.status === "open";
}

/**
 * Générique sur le type d'affaire : un appelant qui passe des `DealRecord`
 * (avec société, contact et étape jointes) récupère des `DealRecord`, pas des
 * `DealLike` appauvris.
 */
export function openDeals<T extends DealLike>(deals: readonly T[]): T[] {
  return deals.filter(isOpen);
}

/** Valeur brute du pipeline : somme des montants des affaires en cours. */
export function pipelineValue(deals: readonly DealLike[]): number {
  return openDeals(deals).reduce((total, deal) => total + deal.amount, 0);
}

/** Pipeline pondéré : somme des montants pondérés des affaires en cours. */
export function weighted(deals: readonly DealLike[], stages: readonly StageLike[]): number {
  return openDeals(deals).reduce(
    (total, deal) => total + weightedValue(deal, resolveStage(stages, deal.stageId)),
    0,
  );
}

/** Date de référence pour la fraîcheur : dernière activité, à défaut création. */
export function lastTouch(deal: DealLike): Date {
  return deal.lastActivityAt ?? deal.createdAt;
}

export function daysSinceLastTouch(deal: DealLike, now: Date): number {
  return daysSince(lastTouch(deal), now);
}

/**
 * Chaleur d'une affaire.
 * `>= coldDays` froide, `>= staleDays` tiède, sinon active — seuils par défaut
 * 14 et 7 jours, configurables dans les réglages.
 */
export function dealHeat(
  deal: DealLike,
  settings: PilotageSettings,
  now: Date,
): DealHeat {
  const elapsed = daysSinceLastTouch(deal, now);
  if (elapsed >= settings.coldDays) return "cold";
  if (elapsed >= settings.staleDays) return "warm";
  return "hot";
}

/** Affaires en cours qui ne sont plus actives, triées par montant décroissant. */
export function stuckDeals<T extends DealLike>(
  deals: readonly T[],
  settings: PilotageSettings,
  now: Date,
): T[] {
  return openDeals(deals)
    .filter((deal) => dealHeat(deal, settings, now) !== "hot")
    .sort((a, b) => b.amount - a.amount);
}

export function averageDealSize(deals: readonly DealLike[]): number {
  if (deals.length === 0) return 0;
  const total = deals.reduce((sum, deal) => sum + deal.amount, 0);
  return total / deals.length;
}
