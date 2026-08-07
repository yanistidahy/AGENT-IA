import { prisma } from "../db";
import { getAlerts } from "../domain/alerts";
import { toDealStatus, toLifecycle, toTaskPriority } from "../domain/guards";
import type { Alert } from "../domain/types";
import { getPilotage, listStages } from "./reference";

/**
 * Assemblage des alertes.
 *
 * Toute la règle vit dans `lib/domain/alerts.ts`, pur et testé. Ce module ne
 * fait que lire les quatre jeux de données dont les six générateurs ont besoin
 * et leur passer une horloge — d'où le paramètre `now` : les alertes sont
 * calculées à l'instant du rendu, jamais à partir d'un cache.
 */
export async function readAlerts(now: Date = new Date()): Promise<Alert[]> {
  const [taskRows, dealRows, contactRows, stages, settings] = await Promise.all([
    prisma.task.findMany({
      where: { done: false },
      select: { id: true, title: true, due: true, done: true, priority: true, owner: true },
    }),
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
      },
    }),
    prisma.contact.findMany({
      where: { nextReminder: { not: null } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        lifecycle: true,
        source: true,
        owner: true,
        createdAt: true,
        nextReminder: true,
      },
    }),
    listStages(),
    getPilotage(),
  ]);

  return getAlerts({
    tasks: taskRows.map((row) => ({ ...row, priority: toTaskPriority(row.priority) })),
    deals: dealRows.map((row) => ({ ...row, status: toDealStatus(row.status) })),
    contacts: contactRows.map((row) => ({ ...row, lifecycle: toLifecycle(row.lifecycle) })),
    stages,
    settings,
    now,
  });
}

/**
 * Alertes concernant une fiche précise, pour l'encart d'avertissement du tiroir.
 * Le filtrage se fait après coup plutôt qu'en requête : les générateurs sont
 * conçus pour tourner sur l'ensemble, et le volume ne justifie pas de les
 * spécialiser.
 */
export function alertsFor(
  alerts: readonly Alert[],
  targetType: Alert["targetType"],
  targetId: string,
): Alert[] {
  return alerts.filter(
    (alert) => alert.targetType === targetType && alert.targetId === targetId,
  );
}
