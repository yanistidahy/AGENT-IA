import "server-only";
import { prisma } from "../db";
import { CORRECTION_OWNER } from "./real-activity";
import { ANSWERED_OUTCOMES } from "../domain/status";
import { rate, type Rate } from "../domain/email-stats";
import type { FunnelStep } from "../domain/email-funnel";
import { toActivityType } from "../domain/guards";
import { ACTIVITY_TYPES, type ActivityType } from "../domain/types";
import {
  consistency,
  dailyStacks,
  delta,
  inPeriod,
  previousPeriod,
  resolvePeriod,
  targetProgress,
  type ActivityLike,
  type Consistency,
  type DayStack,
  type Delta,
  type Period,
  type PeriodKind,
  type TargetProgress,
} from "../domain/performance";

/**
 * « Ma performance » — l'assemblage.
 *
 * **Une seule source : les interactions consignées.** Les envois d'emails y
 * figurent déjà — chaque envoi consigne une interaction de type `email` depuis
 * le jalon 32 — donc les compter aussi depuis `email_sends` les compterait
 * deux fois. L'attribution suit le propriétaire de l'interaction : c'est la
 * personne qui a fait le geste, et c'est elle que cet écran mesure.
 *
 * **Les notes de correction ne sont pas du travail** (`CORRECTION_OWNER`,
 * jalon 27) : les compter ferait apparaître les reports de feuille comme des
 * semaines de prospection. Même exclusion que les rapports.
 */

export interface PerformanceQuery {
  readonly period: PeriodKind;
  readonly owner?: string;
  readonly from?: Date;
  readonly to?: Date;
}

export interface ChannelVolume {
  readonly channel: ActivityType;
  readonly count: Delta;
  /** Réponses obtenues sur ce canal, et le taux sur les issues connues. */
  readonly answered: number;
  readonly known: number;
  readonly rate: Rate;
}

export interface OwnerLine {
  readonly owner: string;
  readonly interactions: number;
  readonly calls: number;
  readonly emails: number;
  readonly meetings: number;
  readonly replies: number;
  readonly replyRate: Rate;
  readonly booked: number;
  readonly qualified: number;
}

export interface Performance {
  readonly period: Period;
  readonly previous: Period;
  readonly owner: string | null;
  readonly owners: readonly string[];
  /** Volume total de la période, comparé à la précédente. */
  readonly total: Delta;
  readonly channels: readonly ChannelVolume[];
  /** Issues des appels : pas de réponse / parlé / mauvais interlocuteur… */
  readonly callOutcomes: ReadonlyArray<{ readonly outcome: string; readonly count: number }>;
  readonly perDay: readonly DayStack[];
  /* — ce que ça a produit — */
  readonly firstReached: Delta;
  readonly booked: Delta;
  readonly qualified: Delta;
  readonly dealsWon: number;
  readonly funnel: readonly FunnelStep[];
  /* — régularité — */
  readonly consistency: Consistency;
  readonly callTarget: TargetProgress | null;
  readonly emailTarget: TargetProgress | null;
  readonly discipline: { readonly honoured: number; readonly missed: number };
  readonly perOwner: readonly OwnerLine[];
}

interface Row extends ActivityLike {
  readonly contactId: string | null;
}

function matches(row: { owner: string }, owner: string | null): boolean {
  return owner === null || row.owner === owner;
}

export async function readPerformance(
  query: PerformanceQuery,
  now = new Date(),
): Promise<Performance> {
  const period = resolvePeriod(
    query.period,
    now,
    query.from !== undefined && query.to !== undefined
      ? { from: query.from, to: query.to }
      : undefined,
  );
  const previous = previousPeriod(period, now);
  const owner = query.owner?.trim() === "" ? null : (query.owner ?? null);

  const [activityRows, firstTouches, deals, reminderTasks, settings] = await Promise.all([
    prisma.activity.findMany({
      where: {
        date: { gte: previous.from, lt: period.to },
        NOT: { owner: CORRECTION_OWNER },
      },
      select: { date: true, type: true, outcome: true, owner: true, contactId: true },
      orderBy: { date: "asc" },
    }),
    // La **première** interaction réelle de chaque fiche, quelle que soit sa
    // date : « atteint pour la première fois » se juge sur toute l'histoire,
    // pas sur la fenêtre chargée.
    prisma.activity.findMany({
      where: { NOT: { owner: CORRECTION_OWNER }, contactId: { not: null } },
      select: { contactId: true, date: true, owner: true },
      orderBy: { date: "asc" },
      distinct: ["contactId"],
    }),
    // `createdAt` d'une affaire est sa date de qualification depuis le
    // jalon 22 : c'est le fait le plus proche de « passé à Qualifié ».
    prisma.deal.findMany({
      where: { createdAt: { gte: previous.from } },
      select: { createdAt: true, closedAt: true, status: true, owner: true },
    }),
    prisma.task.findMany({
      where: { auto: true, due: { gte: period.from, lt: period.to } },
      select: { due: true, done: true, doneAt: true, owner: true },
    }),
    prisma.settings.findUnique({
      where: { id: "singleton" },
      select: { objectifAppelsSemaine: true, objectifEmailsSemaine: true },
    }),
  ]);

  const all: Row[] = activityRows.map((row) => ({
    date: row.date,
    type: toActivityType(row.type),
    outcome: row.outcome,
    owner: row.owner,
    contactId: row.contactId,
  }));

  const owners = [...new Set(all.map((row) => row.owner).filter((name) => name.trim() !== ""))]
    .sort((a, b) => a.localeCompare(b));

  const mine = all.filter((row) => matches(row, owner));
  const current = mine.filter((row) => inPeriod(row.date, period));
  const before = mine.filter((row) => inPeriod(row.date, previous));

  /* ------------------------------------------------------------- volume */

  const channels: ChannelVolume[] = ACTIVITY_TYPES.map((channel) => {
    const nowRows = current.filter((row) => row.type === channel);
    const known = nowRows.filter((row) => (row.outcome ?? "").trim() !== "");
    const answered = known.filter((row) =>
      ANSWERED_OUTCOMES.some((outcome) => outcome === row.outcome),
    ).length;
    return {
      channel,
      count: delta(nowRows.length, before.filter((row) => row.type === channel).length),
      answered,
      known: known.length,
      rate: rate(answered, known.length),
    };
  });

  const callOutcomes = countOutcomes(current.filter((row) => row.type === "call"));

  /* ------------------------------------------------------------ produit */

  const firstNow = firstTouches.filter(
    (row) => inPeriod(row.date, period) && matches(row, owner),
  ).length;
  const firstBefore = firstTouches.filter(
    (row) => inPeriod(row.date, previous) && matches(row, owner),
  ).length;

  const bookedNow = peopleBooked(current);

  const qualifiedNow = deals.filter(
    (deal) => inPeriod(deal.createdAt, period) && matches(deal, owner),
  ).length;
  const qualifiedBefore = deals.filter(
    (deal) => inPeriod(deal.createdAt, previous) && matches(deal, owner),
  ).length;
  const dealsWon = deals.filter(
    (deal) =>
      deal.status === "won" &&
      deal.closedAt !== null &&
      inPeriod(deal.closedAt, period) &&
      matches(deal, owner),
  ).length;

  /* --------------------------------------------------------- régularité */

  const week = resolvePeriod("semaine", now);
  const thisWeek = mine.filter((row) => inPeriod(row.date, week));

  let honoured = 0;
  let missed = 0;
  for (const task of reminderTasks) {
    if (!matches(task, owner)) continue;
    if (task.done && task.doneAt !== null) {
      // « Tenue » veut dire terminée au plus tard le jour de l'échéance —
      // règle du jalon 22, reprise telle quelle.
      if (dayFloor(task.doneAt) <= dayFloor(task.due)) honoured += 1;
      else missed += 1;
    } else if (task.due < dayFloor(now)) {
      missed += 1;
    }
  }

  /* --------------------------------------------------------- par personne */

  const perOwner: OwnerLine[] = owners.map((name) => {
    const rows = all.filter((row) => row.owner === name && inPeriod(row.date, period));
    const replies = peopleAnswered(rows);
    const contacted = contactedPeople(rows);
    return {
      owner: name,
      interactions: rows.length,
      calls: rows.filter((row) => row.type === "call").length,
      emails: rows.filter((row) => row.type === "email").length,
      meetings: rows.filter((row) => row.type === "meeting" || row.type === "demo").length,
      replies,
      // Par personne contactée, comme partout : trois relances sur la même
      // fiche ne divisent pas le taux par trois.
      replyRate: rate(replies, contacted),
      booked: peopleBooked(rows),
      qualified: deals.filter((deal) => inPeriod(deal.createdAt, period) && deal.owner === name)
        .length,
    };
  });

  return {
    period,
    previous,
    owner,
    owners,
    total: delta(current.length, before.length),
    channels,
    callOutcomes,
    perDay: dailyStacks(current, period, now),
    firstReached: delta(firstNow, firstBefore),
    booked: delta(bookedNow, peopleBooked(before)),
    qualified: delta(qualifiedNow, qualifiedBefore),
    dealsWon,
    funnel: crossChannelFunnel(current, qualifiedNow),
    consistency: consistency(
      current.map((row) => row.date),
      period,
      now,
    ),
    callTarget: targetProgress(
      thisWeek.filter((row) => row.type === "call").length,
      settings?.objectifAppelsSemaine ?? 0,
    ),
    emailTarget: targetProgress(
      thisWeek.filter((row) => row.type === "email").length,
      settings?.objectifEmailsSemaine ?? 0,
    ),
    discipline: { honoured, missed },
    perOwner,
  };
}

/* ------------------------------------------------------------- aides */

function dayFloor(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function countOutcomes(
  rows: readonly Row[],
): ReadonlyArray<{ outcome: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const outcome = (row.outcome ?? "").trim();
    if (outcome === "") continue;
    counts.set(outcome, (counts.get(outcome) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([outcome, count]) => ({ outcome, count }))
    .sort((a, b) => b.count - a.count);
}

/** Personnes distinctes touchées par au moins une interaction du jeu. */
function contactedPeople(rows: readonly Row[]): number {
  return new Set(rows.filter((row) => row.contactId !== null).map((row) => row.contactId)).size;
}

/** Personnes distinctes dont au moins une issue vaut réponse. */
function peopleAnswered(rows: readonly Row[]): number {
  const people = new Set<string>();
  for (const row of rows) {
    if (row.contactId === null) continue;
    if (ANSWERED_OUTCOMES.some((outcome) => outcome === row.outcome)) people.add(row.contactId);
  }
  return people.size;
}

function peopleBooked(rows: readonly Row[]): number {
  const people = new Set<string>();
  for (const row of rows) {
    if (row.contactId !== null && row.outcome === "meeting") people.add(row.contactId);
  }
  return people.size;
}

/**
 * L'entonnoir inter-canaux : contactés → répondu → RDV → qualifiés.
 *
 * Même logique que celui des emails — des **personnes**, la chute visible, le
 * dénominateur nommé — étendue à tous les canaux. La dernière étape compte des
 * affaires ouvertes, pas des personnes : c'est le fait que la base enregistre
 * (une qualification crée une affaire, jalon 22), et le renommer « personnes
 * qualifiées » prétendrait une précision qu'on n'a pas.
 */
function crossChannelFunnel(rows: readonly Row[], qualified: number): readonly FunnelStep[] {
  const contacted = contactedPeople(rows);
  const replied = peopleAnswered(rows);
  const booked = peopleBooked(rows);

  return [
    {
      key: "contacted",
      label: "Personnes contactées",
      count: contacted,
      kind: "fact",
      rate: null,
      rateOf: `${rows.length} interaction${rows.length > 1 ? "s" : ""} consignée${rows.length > 1 ? "s" : ""}`,
      drop: null,
    },
    {
      key: "replied",
      label: "Ont répondu",
      count: replied,
      kind: "fact",
      rate: rate(replied, contacted),
      rateOf: "des personnes contactées",
      drop: contacted - replied,
    },
    {
      key: "booked",
      label: "RDV obtenus",
      count: booked,
      kind: "fact",
      rate: rate(booked, replied),
      rateOf: "de celles qui ont répondu",
      drop: replied - booked,
    },
    {
      key: "qualified",
      label: "Affaires qualifiées",
      count: qualified,
      kind: "fact",
      rate: rate(qualified, booked),
      rateOf: "des RDV obtenus",
      drop: booked - qualified,
    },
  ];
}
