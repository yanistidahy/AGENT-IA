import { isLost } from "../domain/lost";
import { prisma } from "../db";
import { lastMonthKeys, monthKey } from "../domain/dates";
import { toActivityType, toDealStatus, toLifecycle } from "../domain/guards";
import {
  averageWonDeal,
  cycle,
  forecast,
  funnel,
  lostDeals,
  retention,
  revenue,
  revenueByMonth,
  winRate,
  withinPeriod,
  wonDeals,
  type FunnelRow,
  type ForecastPoint,
} from "../domain/kpis";
import type { ActivityType, StageLike } from "../domain/types";

/**
 * Données de la page Rapports.
 *
 * Tous les calculs viennent de `lib/domain/kpis.ts`, pur et testé depuis le
 * jalon 0. Ce module lit la base, choisit la fenêtre temporelle, et passe une
 * horloge — il ne recalcule rien lui-même.
 */

export const PERIODS = [30, 90, 365] as const;
export type Period = (typeof PERIODS)[number] | null;

/** `all` vaut « depuis le début » — représenté par `null`, pas par un grand nombre. */
export function parsePeriod(value: string | undefined): Period {
  if (value === "all") return null;
  const parsed = Number(value);
  return PERIODS.find((candidate) => candidate === parsed) ?? 90;
}

export interface OwnerRow {
  readonly owner: string;
  readonly revenue: number;
  readonly won: number;
  readonly calls: number;
  readonly emails: number;
  readonly demos: number;
}

export interface Distribution {
  readonly label: string;
  readonly value: number;
}

export interface ReportData {
  readonly period: Period;
  readonly revenue: number;
  readonly winRate: number;
  readonly cycle: number;
  readonly averageDeal: number;
  readonly wonCount: number;
  readonly lostCount: number;
  readonly retention: number;
  readonly funnel: readonly FunnelRow[];
  readonly forecast: readonly ForecastPoint[];
  readonly revenueByMonth: readonly ForecastPoint[];
  readonly leadsByMonth: readonly Distribution[];
  readonly leadsBySource: readonly Distribution[];
  /**
   * Motifs de perte des contacts « Perdu ». Perdre sur le budget et perdre sur
   * le timing n'appellent pas la même correction : le premier interroge l'offre,
   * le second demande de reprendre contact plus tard.
   */
  readonly lostReasons: readonly Distribution[];
  readonly revenueByOffer: readonly Distribution[];
  readonly owners: readonly OwnerRow[];
  readonly stages: readonly StageLike[];
}

/** Les six prochains mois, du mois courant inclus — fenêtre de la prévision. */
function nextMonthKeys(now: Date, count: number): string[] {
  const keys: string[] = [];
  for (let i = 0; i < count; i += 1) {
    keys.push(monthKey(new Date(now.getFullYear(), now.getMonth() + i, 1)));
  }
  return keys;
}

export async function readReports(period: Period, now: Date = new Date()): Promise<ReportData> {
  const [dealRows, contactRows, activityRows, stages] = await Promise.all([
    prisma.deal.findMany({
      select: {
        id: true,
        name: true,
        amount: true,
        stageId: true,
        status: true,
        prob: true,
        owner: true,
        offer: true,
        createdAt: true,
        expectedClose: true,
        lastActivityAt: true,
        closedAt: true,
      },
    }),
    prisma.contact.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        lifecycle: true,
        source: true,
        owner: true,
        createdAt: true,
        nextReminder: true,
        lostReason: true,
      },
    }),
    prisma.activity.findMany({ select: { type: true, date: true, owner: true } }),
    prisma.stage.findMany({ orderBy: { position: "asc" } }),
  ]);

  const deals = dealRows.map((row) => ({ ...row, status: toDealStatus(row.status) }));
  const contacts = contactRows.map((row) => ({ ...row, lifecycle: toLifecycle(row.lifecycle) }));
  const won = wonDeals(deals, period, now);
  const lost = lostDeals(deals, period, now);

  const months = lastMonthKeys(now, 6);

  // Prospects créés par mois : la source de qualité de l'entonnoir amont.
  const leadsByMonth: Distribution[] = months.map((month) => ({
    label: month.slice(5),
    value: contacts.filter((contact) => monthKey(contact.createdAt) === month).length,
  }));

  const sources = new Map<string, number>();
  for (const contact of contacts) {
    if (!withinPeriod(contact.createdAt, period, now)) continue;
    const key = contact.source === "" ? "Non renseignée" : contact.source;
    sources.set(key, (sources.get(key) ?? 0) + 1);
  }

  const offers = new Map<string, number>();
  for (const deal of won) {
    const row = dealRows.find((candidate) => candidate.id === deal.id);
    const key = row === undefined || row.offer === "" ? "Non renseignée" : row.offer;
    offers.set(key, (offers.get(key) ?? 0) + deal.amount);
  }

  const ownerNames = [...new Set(dealRows.map((row) => row.owner).filter((o) => o !== ""))];
  const countActivities = (owner: string, type: ActivityType) =>
    activityRows.filter(
      (row) =>
        row.owner === owner &&
        toActivityType(row.type) === type &&
        withinPeriod(row.date, period, now),
    ).length;

  const owners: OwnerRow[] = ownerNames
    .map((owner) => {
      const theirs = won.filter((deal) => deal.owner === owner);
      return {
        owner,
        revenue: revenue(theirs),
        won: theirs.length,
        calls: countActivities(owner, "call"),
        emails: countActivities(owner, "email"),
        demos: countActivities(owner, "demo"),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  return {
    period,
    revenue: revenue(won),
    winRate: winRate(won, lost),
    cycle: cycle(won),
    averageDeal: Math.round(averageWonDeal(won)),
    wonCount: won.length,
    lostCount: lost.length,
    retention: retention(contacts),
    funnel: funnel(deals, stages),
    forecast: forecast(deals, stages, nextMonthKeys(now, 6)).map((point) => ({
      ...point,
      month: point.month.slice(5),
    })),
    revenueByMonth: revenueByMonth(deals, months).map((point) => ({
      ...point,
      month: point.month.slice(5),
    })),
    leadsByMonth,
    lostReasons: lostReasonBreakdown(contactRows),
    leadsBySource: [...sources.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    revenueByOffer: [...offers.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
    owners,
    stages,
  };
}

/**
 * Répartition des motifs de perte.
 *
 * Les fiches perdues sans motif renseigné sont comptées à part plutôt
 * qu'écartées : elles disent quelque chose — qu'on ne sait pas pourquoi on a
 * perdu — et les masquer donnerait une lecture faussement nette.
 */
function lostReasonBreakdown(
  contacts: ReadonlyArray<{ lifecycle: string; lostReason: string }>,
): Distribution[] {
  const counts = new Map<string, number>();

  for (const contact of contacts) {
    if (!isLost(toLifecycle(contact.lifecycle))) continue;
    const label = contact.lostReason.trim() === "" ? "Motif non renseigné" : contact.lostReason.trim();
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}
