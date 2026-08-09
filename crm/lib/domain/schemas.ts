import { z } from "zod";
import {
  ACTIVITY_TYPES,
  ALERT_LEVELS,
  DEAL_STATUSES,
  LIFECYCLES,
  SEQUENCE_CHANNELS,
  SETTINGS_LIST_KINDS,
  TASK_PRIORITIES,
} from "./types";

/**
 * Frontière de typage.
 *
 * Prisma renvoie `String` pour toutes les valeurs contraintes (voir le commentaire
 * en tête de schema.prisma). Ces schémas sont le seul endroit où l'on passe de
 * `string` aux unions du domaine : tout ce qui les traverse est typé, sans `any`
 * ni assertion.
 */

export const dealStatusSchema = z.enum(DEAL_STATUSES);
export const activityTypeSchema = z.enum(ACTIVITY_TYPES);
export const taskPrioritySchema = z.enum(TASK_PRIORITIES);
export const lifecycleSchema = z.enum(LIFECYCLES);
export const sequenceChannelSchema = z.enum(SEQUENCE_CHANNELS);
export const settingsListKindSchema = z.enum(SETTINGS_LIST_KINDS);
export const alertLevelSchema = z.enum(ALERT_LEVELS);

export const stageSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  prob: z.number().int().min(0).max(100),
  position: z.number().int(),
});

export const dealSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.number().int(),
  stageId: z.string(),
  status: dealStatusSchema,
  prob: z.number().int().min(0).max(100).nullable(),
  owner: z.string(),
  createdAt: z.date(),
  expectedClose: z.date().nullable(),
  lastActivityAt: z.date().nullable(),
  closedAt: z.date().nullable(),
});

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  due: z.date(),
  done: z.boolean(),
  priority: taskPrioritySchema,
  owner: z.string(),
});

export const contactSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  lifecycle: lifecycleSchema,
  source: z.string(),
  owner: z.string(),
  createdAt: z.date(),
  nextReminder: z.date().nullable(),
});

export const pilotageSettingsSchema = z.object({
  staleDays: z.number().int().positive(),
  coldDays: z.number().int().positive(),
  objectifMensuel: z.number().int().nonnegative(),
});

export const sequenceStepSchema = z.object({
  day: z.number().int().nonnegative(),
  channel: sequenceChannelSchema,
  label: z.string(),
});

export const sequenceSchema = z.object({
  id: z.string(),
  name: z.string(),
  trigger: z.string(),
  active: z.boolean(),
  steps: z.array(sequenceStepSchema),
});

/** Parseurs de collections, utilisés par la couche d'accès aux données. */
export const stagesSchema = z.array(stageSchema);
export const dealsSchema = z.array(dealSchema);
export const tasksSchema = z.array(taskSchema);
export const contactsSchema = z.array(contactSchema);
export const sequencesSchema = z.array(sequenceSchema);
