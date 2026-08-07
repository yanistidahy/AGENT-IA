import {
  ACTIVITY_TYPES,
  DEAL_STATUSES,
  LIFECYCLES,
  TASK_PRIORITIES,
  type ActivityType,
  type DealStatus,
  type Lifecycle,
  type TaskPriority,
} from "./types";

/**
 * Gardes de type à la sortie de Prisma.
 *
 * La base stocke ces valeurs en `String` (voir schema.prisma). Ces fonctions
 * sont le passage de `string` vers les unions du domaine, sans assertion.
 * Une valeur inattendue retombe sur une valeur sûre plutôt que de propager un
 * type mensonger : la donnée vient de notre propre base, une divergence signale
 * une corruption, pas une entrée utilisateur.
 */

export function isDealStatus(value: string): value is DealStatus {
  return DEAL_STATUSES.some((candidate) => candidate === value);
}

export function toDealStatus(value: string): DealStatus {
  return isDealStatus(value) ? value : "open";
}

export function isTaskPriority(value: string): value is TaskPriority {
  return TASK_PRIORITIES.some((candidate) => candidate === value);
}

export function toTaskPriority(value: string): TaskPriority {
  return isTaskPriority(value) ? value : "normale";
}

export function isActivityType(value: string): value is ActivityType {
  return ACTIVITY_TYPES.some((candidate) => candidate === value);
}

export function toActivityType(value: string): ActivityType {
  return isActivityType(value) ? value : "note";
}

export function isLifecycle(value: string): value is Lifecycle {
  return LIFECYCLES.some((candidate) => candidate === value);
}

export function toLifecycle(value: string): Lifecycle {
  return isLifecycle(value) ? value : "Lead";
}
