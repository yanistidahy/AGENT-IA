import "server-only";
import { prisma } from "../db";
import { toActivityType } from "../domain/guards";
import { addDays, daysSince, startOfDay } from "../domain/dates";
import { QUALIFIED } from "../domain/qualification";
import {
  firstTouchDelay,
  poolAging,
  qualificationBySource,
  reminderDiscipline,
  responseByChannel,
  weeklyRhythm,
  type AgeBracket,
  type ChannelRate,
  type FirstTouch,
  type ReminderWeek,
  type SourceRate,
  type WeekBucket,
} from "../domain/prospecting";
import { noShowRate, stageFlow, velocityDays, type StageFlow } from "../domain/sales-flow";
import { listStages } from "./reference";

/**
 * Les données du bloc Prospection, et du parcours de vente.
 *
 * Toutes les décisions de calcul vivent dans `lib/domain/prospecting.ts` et
 * `lib/domain/sales-flow.ts` — purs et testés. Ce module lit la base, borne la
 * fenêtre et passe une horloge.
 */

/** Douze semaines : un trimestre, assez pour voir une tendance sans la noyer. */
export const RHYTHM_WEEKS = 12;

/**
 * Propriétaire des interactions écrites par les corrections de données.
 *
 * Elles racontent ce que le CRM s'est fait à lui-même, pas ce que quelqu'un a
 * fait à un prospect. Toute mesure d'activité les exclut.
 */
export const CORRECTION_OWNER = "Correction";

export interface ProspectingReport {
  readonly rhythm: readonly WeekBucket[];
  readonly channels: readonly ChannelRate[];
  readonly firstTouch: FirstTouch;
  readonly discipline: readonly ReminderWeek[];
  readonly aging: readonly AgeBracket[];
  readonly sources: readonly SourceRate[];
  /** Totaux, pour que les états vides puissent dire ce qui manque. */
  readonly totals: {
    readonly contacts: number;
    readonly activities: number;
    readonly qualified: number;
  };
}

export async function readProspectingReport(
  now: Date = new Date(),
): Promise<ProspectingReport> {
  const from = addDays(startOfDay(now), -RHYTHM_WEEKS * 7);

  const [activityRows, contactRows, reminderRows] = await Promise.all([
    prisma.activity.findMany({
      // Les notes écrites par les corrections de données ne sont pas de la
      // prospection : ce sont nos écritures à nous. Les compter gonflerait le
      // rythme d'une semaine entière de « travail » que personne n'a fait —
      // sur la base vérifiée, 148 des 149 interactions venaient de là.
      // Même exclusion que pour « la fiche a-t-elle été travaillée » au
      // jalon 21, et pour la même raison.
      where: { date: { gte: from }, NOT: { owner: CORRECTION_OWNER } },
      select: { date: true, type: true, outcome: true },
    }),
    prisma.contact.findMany({
      select: {
        createdAt: true,
        source: true,
        lifecycle: true,
        activities: {
          where: { NOT: { owner: CORRECTION_OWNER } },
          select: { date: true },
          orderBy: { date: "asc" },
          take: 1,
        },
      },
    }),
    // Les tâches automatiques de relance : ce sont elles qui portent la
    // discipline, pas les tâches créées à la main pour autre chose.
    prisma.task.findMany({
      where: { auto: true, due: { gte: from } },
      select: { due: true, done: true, doneAt: true },
    }),
  ]);

  const activities = activityRows.map((row) => ({
    date: row.date,
    type: toActivityType(row.type),
    outcome: row.outcome,
  }));

  const untouchedAges = contactRows
    .filter((row) => row.activities.length === 0)
    .map((row) => daysSince(row.createdAt, now));

  return {
    rhythm: weeklyRhythm(activities, RHYTHM_WEEKS, now),
    channels: responseByChannel(activities),
    firstTouch: firstTouchDelay(
      contactRows.map((row) => ({
        createdAt: row.createdAt,
        firstActivityAt: row.activities[0]?.date ?? null,
      })),
      now,
    ),
    discipline: reminderDiscipline(reminderRows, RHYTHM_WEEKS, now),
    aging: poolAging(untouchedAges),
    sources: qualificationBySource(
      contactRows.map((row) => ({
        source: row.source,
        // « Client » a forcément été qualifié un jour, même si le CRM n'a pas
        // vu passer l'étape : l'ignorer ferait chuter le taux de toute source
        // ayant déjà converti, ce qui est exactement l'inverse du vrai.
        qualified: row.lifecycle === QUALIFIED || row.lifecycle === "Client",
      })),
    ),
    totals: {
      contacts: contactRows.length,
      activities: activityRows.length,
      qualified: contactRows.filter(
        (row) => row.lifecycle === QUALIFIED || row.lifecycle === "Client",
      ).length,
    },
  };
}

export interface SalesFlowReport {
  readonly stages: readonly StageFlow[];
  readonly noShow: { readonly planned: number; readonly held: number; readonly rate: number | null } | null;
  readonly velocity: { readonly medianDays: number | null; readonly measured: number };
  readonly deals: number;
  /** Passages enregistrés, pour dire sur quoi les durées reposent. */
  readonly visits: number;
}

export async function readSalesFlow(now: Date = new Date()): Promise<SalesFlowReport> {
  const [stages, visits, deals] = await Promise.all([
    listStages(),
    prisma.dealStageVisit.findMany({ select: { dealId: true, stageId: true, enteredAt: true } }),
    prisma.deal.findMany({ select: { createdAt: true, closedAt: true, status: true } }),
  ]);

  const flows = stageFlow(visits, stages, now);

  return {
    stages: flows,
    noShow: noShowRate(flows, "Démo planifiée", "Démo réalisée"),
    velocity: velocityDays(deals),
    deals: deals.length,
    visits: visits.length,
  };
}
