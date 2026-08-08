import { prisma } from "../db";
import { toActivityType, toDealStatus, toLifecycle, toTaskPriority } from "../domain/guards";
import { addDays, daysSince, monthKey, startOfDay } from "../domain/dates";
import { dealHeat, weighted } from "../domain/pipeline";
import { followUpStatus, idleDays as computeIdleDays, type FollowUpStatus } from "../domain/follow-up";
import type {
  ActivityType,
  DealHeat,
  Lifecycle,
  PilotageSettings,
  StageLike,
  TaskPriority,
} from "../domain/types";
import { getPilotage, listStages } from "./reference";

/**
 * Données du centre de pilotage.
 *
 * Une seule lecture par écran, assemblée ici plutôt que dispersée dans les
 * composants : la page pose ses questions une fois, et chaque bloc reçoit
 * exactement ce qu'il affiche.
 */

export interface StaleContact {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly companyName: string | null;
  readonly lifecycle: Lifecycle;
  readonly owner: string;
  readonly lastContact: Date | null;
  /** Jours depuis la dernière interaction ; `null` si aucune n'a jamais eu lieu. */
  readonly idleDays: number | null;
  readonly nextAction: { readonly title: string; readonly due: Date } | null;
  readonly nextReminder: Date | null;
  /** Même calcul que /contacts et /clients — voir lib/domain/follow-up.ts. */
  readonly followUp: FollowUpStatus;
}

export interface UpcomingItem {
  readonly id: string;
  readonly title: string;
  readonly due: Date;
  readonly owner: string;
  readonly priority: TaskPriority;
  readonly targetLabel: string | null;
  readonly targetHref: string | null;
  /** Tâche datée, ou relance programmée sur une fiche contact. */
  readonly kind: "task" | "reminder";
}

export interface FeedItem {
  readonly id: string;
  readonly type: ActivityType;
  readonly date: Date;
  readonly owner: string;
  readonly notes: string;
  readonly label: string | null;
}

export interface RiskDeal {
  readonly id: string;
  readonly name: string;
  readonly amount: number;
  readonly companyName: string | null;
  readonly stageName: string;
  readonly stageColor: string;
  readonly heat: DealHeat;
  readonly idleDays: number;
}

export interface DashboardData {
  readonly settings: PilotageSettings;
  readonly stages: readonly StageLike[];
  readonly pipelineValue: number;
  readonly weightedValue: number;
  readonly monthRevenue: number;
  readonly openCount: number;
  readonly staleContacts: readonly StaleContact[];
  readonly upcoming: readonly UpcomingItem[];
  readonly feed: readonly FeedItem[];
  readonly risks: readonly RiskDeal[];
}

/**
 * « Qui avons-nous oublié ? »
 *
 * Les anciens clients sont exclus : ils ne sont pas oubliés, ils sont partis.
 * Un contact jamais touché remonte en tête (`idleDays: null` trié en premier) —
 * c'est le cas le plus préoccupant, pas le moins.
 */
async function readStaleContacts(
  settings: PilotageSettings,
  now: Date,
): Promise<StaleContact[]> {
  const rows = await prisma.contact.findMany({
    where: { NOT: { lifecycle: "Ancien Client" } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      lifecycle: true,
      owner: true,
      lastContact: true,
      nextReminder: true,
      company: { select: { name: true } },
      _count: { select: { activities: true } },
      tasks: {
        where: { done: false },
        select: { title: true, due: true },
        orderBy: { due: "asc" },
        take: 1,
      },
    },
  });

  return rows
    .map((row) => {
      const next = row.tasks[0];
      const followUpInput = {
        lastContact: row.lastContact,
        nextReminder: row.nextReminder,
        activityCount: row._count.activities,
      };
      return {
        id: row.id,
        firstName: row.firstName,
        lastName: row.lastName,
        companyName: row.company?.name ?? null,
        lifecycle: toLifecycle(row.lifecycle),
        owner: row.owner,
        lastContact: row.lastContact,
        idleDays: computeIdleDays(followUpInput, now),
        nextAction: next === undefined ? null : { title: next.title, due: next.due },
        nextReminder: row.nextReminder,
        followUp: followUpStatus(followUpInput, settings, now),
      };
    })
    .sort((a, b) => (b.idleDays ?? Number.MAX_SAFE_INTEGER) - (a.idleDays ?? Number.MAX_SAFE_INTEGER));
}

/**
 * Relances des sept prochains jours, aujourd'hui compris.
 *
 * Deux sources, et il faut les deux : les **tâches** datées, et les **relances
 * programmées** sur les fiches contact (`Contact.nextReminder`). Ne lire que les
 * tâches faisait mentir le titre du bloc — un contact relançable dans trois
 * jours apparaissait sous « À relancer » dans /contacts et nulle part ici, alors
 * que les deux écrans emploient le même mot.
 */
async function readUpcoming(now: Date): Promise<UpcomingItem[]> {
  const from = startOfDay(now);
  const to = addDays(from, 8);

  const [taskRows, reminderRows] = await Promise.all([
    prisma.task.findMany({
    where: { done: false, due: { gte: from, lt: to } },
      select: {
        id: true,
        title: true,
        due: true,
        owner: true,
        priority: true,
        contact: { select: { id: true, firstName: true, lastName: true } },
        company: { select: { id: true, name: true } },
        deal: { select: { id: true, name: true } },
      },
      orderBy: [{ due: "asc" }, { createdAt: "asc" }],
    }),
    prisma.contact.findMany({
      where: { nextReminder: { gte: from, lt: to } },
      select: { id: true, firstName: true, lastName: true, owner: true, nextReminder: true },
      orderBy: { nextReminder: "asc" },
    }),
  ]);

  const reminders: UpcomingItem[] = reminderRows.flatMap((row) =>
    row.nextReminder === null
      ? []
      : [
          {
            id: `reminder-${row.id}`,
            title: "Relance programmée",
            due: row.nextReminder,
            owner: row.owner,
            priority: "normale" as const,
            targetLabel: `${row.firstName} ${row.lastName}`,
            targetHref: `/contacts?lifecycle=all&fiche=${row.id}`,
            kind: "reminder" as const,
          },
        ],
  );

  const tasks = taskRows.map((row) => {
    const target =
      row.deal !== null
        ? { label: row.deal.name, href: `/affaires?status=all&fiche=${row.deal.id}` }
        : row.contact !== null
          ? {
              label: `${row.contact.firstName} ${row.contact.lastName}`,
              href: `/contacts?lifecycle=all&fiche=${row.contact.id}`,
            }
          : row.company !== null
            ? { label: row.company.name, href: `/societes?fiche=${row.company.id}` }
            : null;

    return {
      id: row.id,
      title: row.title,
      due: row.due,
      owner: row.owner,
      priority: toTaskPriority(row.priority),
      targetLabel: target?.label ?? null,
      targetHref: target?.href ?? null,
      kind: "task" as const,
    };
  });

  return [...tasks, ...reminders].sort((a, b) => a.due.getTime() - b.due.getTime());
}

export async function readDashboard(now: Date = new Date()): Promise<DashboardData> {
  // Les réglages sont lus d'abord : le statut de relance en dépend, et le
  // reste de l'assemblage les reçoit plutôt que de retomber sur les défauts.
  const settings = await getPilotage();

  const [stages, dealRows, staleContacts, upcoming, activityRows] = await Promise.all([
    listStages(),
    prisma.deal.findMany({
      select: {
        id: true,
        name: true,
        amount: true,
        stageId: true,
        status: true,
        prob: true,
        owner: true,
        createdAt: true,
        expectedClose: true,
        lastActivityAt: true,
        closedAt: true,
        company: { select: { name: true } },
      },
    }),
    readStaleContacts(settings, now),
    readUpcoming(now),
    prisma.activity.findMany({
      where: { date: { gte: addDays(startOfDay(now), -2) } },
      select: {
        id: true,
        type: true,
        date: true,
        owner: true,
        notes: true,
        contact: { select: { firstName: true, lastName: true } },
        deal: { select: { name: true } },
        company: { select: { name: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 12,
    }),
  ]);

  const deals = dealRows.map((row) => ({ ...row, status: toDealStatus(row.status) }));
  const open = deals.filter((deal) => deal.status === "open");
  const thisMonth = monthKey(now);

  const risks = open
    .map((deal) => {
      const stage = stages.find((candidate) => candidate.id === deal.stageId);
      return {
        id: deal.id,
        name: deal.name,
        amount: deal.amount,
        companyName: deal.company?.name ?? null,
        stageName: stage?.name ?? "—",
        stageColor: stage?.color ?? "#6E8B86",
        heat: dealHeat(deal, settings, now),
        idleDays: daysSince(deal.lastActivityAt ?? deal.createdAt, now),
      };
    })
    .filter((deal) => deal.heat !== "hot")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 6);

  return {
    settings,
    stages,
    pipelineValue: open.reduce((total, deal) => total + deal.amount, 0),
    weightedValue: weighted(deals, stages),
    monthRevenue: deals
      .filter(
        (deal) =>
          deal.status === "won" && deal.closedAt !== null && monthKey(deal.closedAt) === thisMonth,
      )
      .reduce((total, deal) => total + deal.amount, 0),
    openCount: open.length,
    staleContacts,
    upcoming,
    feed: activityRows.map((row) => ({
      id: row.id,
      type: toActivityType(row.type),
      date: row.date,
      owner: row.owner,
      notes: row.notes,
      label:
        row.deal?.name ??
        (row.contact === null ? null : `${row.contact.firstName} ${row.contact.lastName}`) ??
        row.company?.name ??
        null,
    })),
    risks,
  };
}

/** Regroupement par jour des relances à venir, pour l'affichage. */
export function groupByDay(items: readonly UpcomingItem[]): Array<[string, UpcomingItem[]]> {
  const groups = new Map<string, UpcomingItem[]>();
  for (const item of items) {
    const key = item.due.toISOString().slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}
