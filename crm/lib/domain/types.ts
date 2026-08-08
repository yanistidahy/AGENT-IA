/**
 * Types du domaine.
 *
 * Ces formes sont volontairement indépendantes du client Prisma : les fonctions
 * de `lib/domain/` sont pures et testables sans base ni `prisma generate`.
 * Prisma renvoie `status: string` ; la conversion vers `DealStatus` se fait à la
 * frontière via les schémas Zod de `lib/domain/schemas.ts`.
 */

export const DEAL_STATUSES = ["open", "won", "lost"] as const;
export type DealStatus = (typeof DEAL_STATUSES)[number];

export const DEAL_HEATS = ["hot", "warm", "cold"] as const;
export type DealHeat = (typeof DEAL_HEATS)[number];

export const ACTIVITY_TYPES = ["call", "email", "meeting", "demo", "note"] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Libellés d'affichage des types d'interaction. Une seule table pour tout l'app. */
export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  call: "Appel",
  email: "Email",
  meeting: "Réunion",
  demo: "Démo",
  note: "Note",
};

export const TASK_PRIORITIES = ["haute", "normale", "basse"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const LIFECYCLES = ["Lead", "Prospect", "Client", "Ancien Client"] as const;
export type Lifecycle = (typeof LIFECYCLES)[number];

export const SEQUENCE_CHANNELS = ["email", "call", "linkedin"] as const;
export type SequenceChannel = (typeof SEQUENCE_CHANNELS)[number];

export const SETTINGS_LIST_KINDS = ["owners", "offers", "sources", "lifecycles"] as const;
export type SettingsListKind = (typeof SETTINGS_LIST_KINDS)[number];

/** Niveaux d'alerte, du plus urgent au moins urgent. L'ordre du tableau est l'ordre de tri. */
export const ALERT_LEVELS = ["hi", "md", "low"] as const;
export type AlertLevel = (typeof ALERT_LEVELS)[number];

export const ALERT_KINDS = [
  "task-overdue",
  "deal-cold",
  "deal-stale",
  "close-date-passed",
  "contact-reminder",
  "post-win-checkin",
] as const;
export type AlertKind = (typeof ALERT_KINDS)[number];

export interface StageLike {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly prob: number;
  readonly position: number;
}

export interface DealLike {
  readonly id: string;
  readonly name: string;
  readonly amount: number;
  readonly stageId: string;
  readonly status: DealStatus;
  readonly prob: number | null;
  readonly owner: string;
  readonly createdAt: Date;
  readonly expectedClose: Date | null;
  readonly lastActivityAt: Date | null;
  readonly closedAt: Date | null;
}

export interface TaskLike {
  readonly id: string;
  readonly title: string;
  readonly due: Date;
  readonly done: boolean;
  readonly priority: TaskPriority;
  readonly owner: string;
}

export interface ContactLike {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly lifecycle: Lifecycle;
  readonly source: string;
  readonly owner: string;
  readonly createdAt: Date;
  readonly nextReminder: Date | null;
}

export interface SequenceStepLike {
  readonly day: number;
  readonly channel: SequenceChannel;
  readonly label: string;
}

export interface SequenceLike {
  readonly id: string;
  readonly name: string;
  readonly trigger: string;
  readonly active: boolean;
  readonly steps: readonly SequenceStepLike[];
}

/** Seuils de pilotage. Valeurs par défaut du prototype : 7 / 14 / 15 000 €. */
export interface PilotageSettings {
  readonly staleDays: number;
  readonly coldDays: number;
  readonly objectifMensuel: number;
}

export const DEFAULT_PILOTAGE: PilotageSettings = {
  staleDays: 7,
  coldDays: 14,
  objectifMensuel: 15000,
};

export interface Alert {
  readonly kind: AlertKind;
  readonly level: AlertLevel;
  readonly title: string;
  readonly detail: string;
  /** Cible cliquable : identifiant de l'entité concernée. */
  readonly targetType: "task" | "deal" | "contact";
  readonly targetId: string;
}
