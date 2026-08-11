import { LOST_LIFECYCLE } from "../domain/lost";
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
import { ANSWERED_OUTCOMES } from "../domain/status";
import type { FunnelInput } from "../domain/funnel";

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
    // « Ancien Client » et « Perdu » sont hors du quotidien : l'un a cessé
    // d'acheter, l'autre a dit non. Les faire figurer dans « dernière touche »
    // remplirait la liste de fiches sur lesquelles il n'y a rien à faire.
    where: { NOT: { lifecycle: { in: ["Ancien Client", LOST_LIFECYCLE] } } },
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
      where: {
        nextReminder: { gte: from, lt: to },
        NOT: { lifecycle: LOST_LIFECYCLE },
      },
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
        stageColor: stage?.color ?? "#6B7192",
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

/**
 * Indicateurs de prospection, quand il n'y a pas encore d'affaire.
 *
 * Trois cartes de chiffre d'affaires à 0 € n'apprennent rien à quelqu'un qui
 * n'a pas encore créé d'affaire : elles occupent la place de ce qu'il fait
 * réellement, qui est de la prospection. Les cartes de revenu reviennent seules
 * dès qu'une affaire existe — l'écran suit l'état, il ne demande pas de réglage.
 */
export interface ProspectingMetrics {
  readonly byLifecycle: ReadonlyArray<{ label: string; value: number }>;
  readonly contactedThisWeek: number;
  /** Même mesure sur les sept jours précédents. Sert à la comparaison des cartes. */
  readonly contactedPreviousWeek: number;
  /** Interactions ayant reçu une réponse, sur celles dont l'issue est connue. */
  readonly responseRate: number | null;
  /** Le même taux sur les trente jours d'avant ; `null` si rien n'était renseigné. */
  readonly responseRatePrevious: number | null;
  readonly neverContacted: number;
  readonly total: number;
  /** Fiches créées sur les sept derniers jours, et sur les sept d'avant. */
  readonly createdThisWeek: number;
  readonly createdPreviousWeek: number;
}

/** Taux de réponse sur une fenêtre : réponses sur échanges dont l'issue est connue. */
async function responseRateBetween(from: Date, to: Date): Promise<number | null> {
  const outcomes = await prisma.activity.groupBy({
    by: ["outcome"],
    where: { NOT: { outcome: "" }, date: { gte: from, lt: to } },
    _count: { _all: true },
  });

  // Le taux ne porte que sur les échanges dont l'issue est **connue** : compter
  // les interactions sans issue comme des non-réponses gonflerait l'échec avec
  // de la donnée manquante.
  const known = outcomes.reduce((sum, row) => sum + row._count._all, 0);
  if (known === 0) return null;

  const answered = outcomes
    .filter((row) => row.outcome !== "no-answer")
    .reduce((sum, row) => sum + row._count._all, 0);
  return Math.round((answered / known) * 100);
}

export async function readProspecting(now: Date = new Date()): Promise<ProspectingMetrics> {
  const today = startOfDay(now);
  const weekAgo = addDays(today, -7);
  const twoWeeksAgo = addDays(today, -14);
  const monthAgo = addDays(today, -30);
  const twoMonthsAgo = addDays(today, -60);
  const soon = addDays(today, 1);

  const [
    byLifecycle,
    total,
    contactedThisWeek,
    contactedPreviousWeek,
    neverContacted,
    createdThisWeek,
    createdPreviousWeek,
    responseRate,
    responseRatePrevious,
  ] = await Promise.all([
    prisma.contact.groupBy({ by: ["lifecycle"], _count: { _all: true } }),
    prisma.contact.count(),
    prisma.contact.count({ where: { activities: { some: { date: { gte: weekAgo } } } } }),
    prisma.contact.count({
      where: { activities: { some: { date: { gte: twoWeeksAgo, lt: weekAgo } } } },
    }),
    prisma.contact.count({ where: { lastContact: null, activities: { none: {} } } }),
    prisma.contact.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.contact.count({ where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
    responseRateBetween(monthAgo, soon),
    responseRateBetween(twoMonthsAgo, monthAgo),
  ]);

  return {
    byLifecycle: byLifecycle
      .map((row) => ({ label: row.lifecycle, value: row._count._all }))
      .sort((a, b) => b.value - a.value),
    contactedThisWeek,
    contactedPreviousWeek,
    responseRate,
    responseRatePrevious,
    neverContacted,
    total,
    createdThisWeek,
    createdPreviousWeek,
  };
}

/**
 * Ce qui attend demain.
 *
 * Sert l'état de fin de journée : une file vidée doit dire ce qui vient, sinon
 * elle ne dit rien de plus qu'un vide. Compté sur les deux sources de relance —
 * tâches datées et relances programmées — comme le bloc « Relances à venir »,
 * pour que les deux écrans ne donnent pas deux chiffres.
 */
export async function readTomorrow(now: Date = new Date()): Promise<number> {
  const from = addDays(startOfDay(now), 1);
  const to = addDays(from, 1);

  const [tasks, reminders] = await Promise.all([
    prisma.task.count({ where: { done: false, due: { gte: from, lt: to } } }),
    prisma.contact.count({
      where: { nextReminder: { gte: from, lt: to }, NOT: { lifecycle: LOST_LIFECYCLE } },
    }),
  ]);

  return tasks + reminders;
}

/**
 * Les cinq nombres de l'entonnoir.
 *
 * Comptés en base plutôt que dérivés d'une liste chargée en mémoire : la page
 * n'a besoin que des totaux, et rapatrier cent trente-neuf fiches pour en
 * compter cinq nombres serait payer une lecture pour un affichage.
 */
export async function readFunnel(now: Date = new Date()): Promise<FunnelInput> {
  const weekAgo = addDays(startOfDay(now), -7);

  const [total, contacted, thisWeek, answered, deals] = await Promise.all([
    prisma.contact.count(),
    prisma.contact.count({ where: { activities: { some: {} } } }),
    prisma.contact.count({ where: { activities: { some: { date: { gte: weekAgo } } } } }),
    prisma.contact.count({
      where: { activities: { some: { outcome: { in: [...ANSWERED_OUTCOMES] } } } },
    }),
    prisma.deal.count(),
  ]);

  return { total, contacted, thisWeek, answered, deals };
}

/**
 * Bilan de la semaine : ce qui a été fait, et ce qui était prévu et ne l'a pas
 * été. C'est la seule mesure qui dise si on a prospecté — un compteur
 * d'interactions seul ne distingue pas l'activité de la discipline.
 */
export interface WeekReview {
  readonly byType: ReadonlyArray<{ label: string; value: number }>;
  readonly remindersHonoured: number;
  readonly remindersMissed: number;
}

export async function readWeek(now: Date = new Date()): Promise<WeekReview> {
  const from = addDays(startOfDay(now), -7);

  const [byType, honoured, missed] = await Promise.all([
    prisma.activity.groupBy({
      by: ["type"],
      where: { date: { gte: from } },
      _count: { _all: true },
    }),
    // Relance honorée : une tâche automatique de relance terminée cette semaine.
    prisma.task.count({ where: { auto: true, done: true, doneAt: { gte: from } } }),
    // Manquée : encore ouverte, et son échéance est passée.
    prisma.task.count({ where: { auto: true, done: false, due: { lt: startOfDay(now) } } }),
  ]);

  return {
    byType: byType
      .map((row) => ({ label: row.type, value: row._count._all }))
      .sort((a, b) => b.value - a.value),
    remindersHonoured: honoured,
    remindersMissed: missed,
  };
}

/**
 * File d'action de l'accueil : ce qu'on peut traiter sans quitter la page.
 *
 * Remplace une liste d'alertes qui répétait dix fois la même phrase. Chaque
 * ligne porte de quoi décider **et** de quoi agir : le nom, la société, le
 * téléphone, le silence en jours, et le dernier mot échangé. Une ligne qui ne
 * dit rien de spécifique à son enregistrement n'aide pas à choisir laquelle
 * traiter en premier.
 */
export type ActionGroup = "reminders" | "tasks" | "deals";

export interface ActionRow {
  readonly id: string;
  readonly group: ActionGroup;
  readonly title: string;
  readonly company: string | null;
  readonly phone: string;
  readonly idleDays: number | null;
  /** Dernier mot échangé, tronqué : le contexte qui évite de rouvrir la fiche. */
  readonly lastNote: string;
  readonly due: Date | null;
  /** Cible du tiroir et des actions en ligne. */
  readonly contactId: string | null;
  readonly taskId: string | null;
  readonly dealId: string | null;
}

const NOTE_MAX = 90;

function truncate(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length <= NOTE_MAX ? clean : `${clean.slice(0, NOTE_MAX - 1)}…`;
}

export async function readActionQueue(
  settings: PilotageSettings,
  now: Date = new Date(),
): Promise<readonly ActionRow[]> {
  const today = startOfDay(now);

  const [dueContacts, lateTasks, staleDeals] = await Promise.all([
    prisma.contact.findMany({
      where: {
        nextReminder: { lte: today },
        NOT: { lifecycle: LOST_LIFECYCLE },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        lastContact: true,
        nextReminder: true,
        company: { select: { name: true } },
        activities: { select: { notes: true }, orderBy: { date: "desc" }, take: 1 },
      },
      orderBy: { nextReminder: "asc" },
    }),
    prisma.task.findMany({
      where: { done: false, due: { lt: today } },
      select: {
        id: true,
        title: true,
        due: true,
        contactId: true,
        dealId: true,
        contact: { select: { phone: true, lastContact: true, company: { select: { name: true } } } },
        deal: { select: { name: true } },
      },
      orderBy: { due: "asc" },
    }),
    prisma.deal.findMany({
      where: {
        status: "open",
        OR: [
          { lastActivityAt: { lt: addDays(today, -settings.staleDays) } },
          { lastActivityAt: null },
        ],
      },
      select: { id: true, name: true, lastActivityAt: true, company: { select: { name: true } } },
      orderBy: { lastActivityAt: "asc" },
    }),
  ]);

  const rows: ActionRow[] = [];

  for (const contact of dueContacts) {
    rows.push({
      id: `reminder-${contact.id}`,
      group: "reminders",
      title: `${contact.firstName} ${contact.lastName}`.trim(),
      company: contact.company?.name ?? null,
      phone: contact.phone,
      idleDays: contact.lastContact === null ? null : daysSince(contact.lastContact, now),
      lastNote: truncate(contact.activities[0]?.notes ?? ""),
      due: contact.nextReminder,
      contactId: contact.id,
      taskId: null,
      dealId: null,
    });
  }

  for (const task of lateTasks) {
    rows.push({
      id: `task-${task.id}`,
      group: "tasks",
      title: task.title,
      company: task.contact?.company?.name ?? task.deal?.name ?? null,
      phone: task.contact?.phone ?? "",
      idleDays:
        task.contact?.lastContact == null ? null : daysSince(task.contact.lastContact, now),
      lastNote: "",
      due: task.due,
      contactId: task.contactId,
      taskId: task.id,
      dealId: task.dealId,
    });
  }

  for (const deal of staleDeals) {
    rows.push({
      id: `deal-${deal.id}`,
      group: "deals",
      title: deal.name,
      company: deal.company?.name ?? null,
      phone: "",
      idleDays: deal.lastActivityAt === null ? null : daysSince(deal.lastActivityAt, now),
      lastNote: "",
      due: null,
      contactId: null,
      taskId: null,
      dealId: deal.id,
    });
  }

  return rows;
}
