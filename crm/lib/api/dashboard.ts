import { TERMINAL_LIFECYCLES } from "../domain/lost";
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
import { REAL_ACTIVITY } from "./real-activity";
import { contactTitle } from "../domain/contact-identity";

/**
 * Données du centre de pilotage.
 *
 * Une seule lecture par écran, assemblée ici plutôt que dispersée dans les
 * composants : la page pose ses questions une fois, et chaque bloc reçoit
 * exactement ce qu'il affiche.
 */

export interface StaleContact {
  /** Statut saisi, pour que la pastille résolve comme sur /contacts. */
  readonly status: string;
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
    where: { NOT: { lifecycle: { in: [...TERMINAL_LIFECYCLES] } } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      lifecycle: true,
      owner: true,
      lastContact: true,
      nextReminder: true,
      company: { select: { name: true } },
      status: true,
      _count: { select: { activities: { where: REAL_ACTIVITY } } },
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
        // Le statut **saisi** voyage avec la ligne : sans lui, l'accueil
        // affichait le calcul pendant que /contacts affichait la saisie — 110
        // fiches en désaccord sur la base de vérification.
        status: row.status,
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
        // Les **deux** cycles terminaux, pas seulement « Perdu » : un ancien
        // client dont une relance dort encore en base remontait dans « Relances
        // à venir » alors que sa colonne Statut le dit clos. Une fiche close
        // n'entre dans aucune liste de travail.
        NOT: { lifecycle: { in: [...TERMINAL_LIFECYCLES] } },
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
            targetLabel: contactTitle(row),
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
              label: contactTitle(row.contact),
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
        (row.contact === null ? null : contactTitle(row.contact)) ??
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
      // Taille du jour : elle doit compter le même périmètre que la file, sinon
      // l'anneau annonce un dénominateur que la liste ne contient pas.
      where: {
        nextReminder: { gte: from, lt: to },
        NOT: { lifecycle: { in: [...TERMINAL_LIFECYCLES] } },
      },
    }),
  ]);

  return tasks + reminders;
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
        // La file d'accueil est la liste de travail du jour : aucune fiche close
        // n'y entre, « Perdu » comme « Ancien Client ».
        NOT: { lifecycle: { in: [...TERMINAL_LIFECYCLES] } },
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
      title: contactTitle(contact),
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
