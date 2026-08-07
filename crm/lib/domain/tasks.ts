import { daysSince } from "./dates";
import type { TaskLike } from "./types";

export type TaskTargetType = "contact" | "company" | "deal";

export interface TaskLinks {
  readonly contactId: string | null;
  readonly companyId: string | null;
  readonly dealId: string | null;
}

export interface TaskTarget {
  readonly type: TaskTargetType;
  readonly id: string;
}

/**
 * Lecture du rattachement d'une tâche.
 *
 * Le schéma remplace le couple polymorphe `relType`/`relId` du prototype par
 * trois clés étrangères nullables. Au plus une est renseignée ; en cas de
 * conflit, l'ordre affaire > contact > société tranche, l'affaire étant le
 * rattachement le plus spécifique.
 */
export function taskTarget(links: TaskLinks): TaskTarget | null {
  if (links.dealId !== null) return { type: "deal", id: links.dealId };
  if (links.contactId !== null) return { type: "contact", id: links.contactId };
  if (links.companyId !== null) return { type: "company", id: links.companyId };
  return null;
}

export function isOverdue(task: TaskLike, now: Date): boolean {
  return !task.done && daysSince(task.due, now) > 0;
}

export function isDueToday(task: TaskLike, now: Date): boolean {
  return !task.done && daysSince(task.due, now) === 0;
}

export type TaskBucket = "En retard" | "Aujourd'hui" | "Cette semaine" | "Plus tard" | "Terminées";

/** Regroupement du prototype pour la vue Tâches. */
export function taskBucket(task: TaskLike, now: Date): TaskBucket {
  if (task.done) return "Terminées";
  const elapsed = daysSince(task.due, now);
  if (elapsed > 0) return "En retard";
  if (elapsed === 0) return "Aujourd'hui";
  if (elapsed >= -7) return "Cette semaine";
  return "Plus tard";
}
