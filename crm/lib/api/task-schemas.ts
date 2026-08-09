import { z } from "zod";
import { TASK_PRIORITIES } from "../domain/types";

/** Schémas de validation des requêtes sur les tâches. */

const dueValue = z.union([z.string(), z.date()]).transform((value, ctx) => {
  if (value instanceof Date) return value;

  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) {
    ctx.addIssue({ code: "custom", message: "Échéance invalide" });
    return z.NEVER;
  }
  return parsed;
});

const idValue = z.string().trim().min(1).nullable();

/**
 * Une tâche porte au plus un rattachement. Le refus est explicite plutôt que
 * silencieux : `taskTarget()` trancherait bien par ordre de priorité, mais une
 * charge utile qui nomme deux cibles traduit un bug d'appelant, pas une
 * intention.
 */
const atMostOneTarget = <T extends { contactId?: unknown; companyId?: unknown; dealId?: unknown }>(
  value: T,
): boolean => {
  const named = [value.contactId, value.companyId, value.dealId].filter(
    (id) => typeof id === "string" && id !== "",
  );
  return named.length <= 1;
};

const TARGET_MESSAGE = "Une tâche ne peut être rattachée qu'à une seule fiche";

export const createTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Décrivez la tâche"),
    due: dueValue,
    priority: z.enum(TASK_PRIORITIES, { error: "Priorité inconnue" }).optional(),
    owner: z.string().trim().min(1, "Le propriétaire est obligatoire"),
    contactId: idValue.optional(),
    companyId: idValue.optional(),
    dealId: idValue.optional(),
  })
  .refine(atMostOneTarget, { message: TARGET_MESSAGE });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1, "Décrivez la tâche").optional(),
    due: dueValue.optional(),
    priority: z.enum(TASK_PRIORITIES, { error: "Priorité inconnue" }).optional(),
    owner: z.string().trim().min(1).optional(),
    done: z.boolean().optional(),
    contactId: idValue.optional(),
    companyId: idValue.optional(),
    dealId: idValue.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Aucun champ à mettre à jour",
  })
  .refine(atMostOneTarget, { message: TARGET_MESSAGE });

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const listTasksQuerySchema = z.object({
  owner: z.string().optional(),
  /** `open` masque les tâches terminées — le défaut de la vue. */
  scope: z.enum(["open", "done", "all"]).optional(),
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  dealId: z.string().optional(),
  q: z.string().optional(),
});

export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

export function parseTasksQuery(
  params: URLSearchParams | Record<string, string | undefined>,
) {
  const raw: Record<string, string> = {};
  const entries =
    params instanceof URLSearchParams ? [...params.entries()] : Object.entries(params);

  for (const [key, value] of entries) {
    if (typeof value === "string" && value.trim() !== "") raw[key] = value.trim();
  }

  return listTasksQuerySchema.safeParse(raw);
}
