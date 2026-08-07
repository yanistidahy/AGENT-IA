import { z } from "zod";
import { ACTIVITY_TYPES, TASK_PRIORITIES } from "../domain/types";

/** Schémas de validation des requêtes sur les interactions. */

const dateValue = z.union([z.string(), z.date()]).transform((value, ctx) => {
  if (value instanceof Date) return value;

  const parsed = new Date(value.trim());
  if (Number.isNaN(parsed.getTime())) {
    ctx.addIssue({ code: "custom", message: "Date invalide" });
    return z.NEVER;
  }
  return parsed;
});

const idValue = z.string().trim().min(1).nullable();

/**
 * « Prochaine action » : intitulé et échéance vont ensemble.
 *
 * Accepter l'un sans l'autre produirait soit une tâche sans date, soit une date
 * sans tâche — deux façons de perdre la relance qu'on venait justement de
 * décider.
 */
export const nextActionSchema = z.object({
  title: z.string().trim().min(1, "Décrivez la prochaine action"),
  due: dateValue,
  priority: z.enum(TASK_PRIORITIES, { error: "Priorité inconnue" }).optional(),
});

export const createActivitySchema = z
  .object({
    type: z.enum(ACTIVITY_TYPES, { error: "Type d'interaction inconnu" }),
    date: dateValue,
    owner: z.string().trim().min(1, "Le propriétaire est obligatoire"),
    notes: z.string().optional(),
    duration: z.number().int().min(0).nullable().optional(),
    contactId: idValue.optional(),
    companyId: idValue.optional(),
    dealId: idValue.optional(),
    nextAction: nextActionSchema.nullable().optional(),
  })
  .refine(
    (value) =>
      [value.contactId, value.companyId, value.dealId].some(
        (id) => typeof id === "string" && id !== "",
      ),
    { message: "Rattachez l'interaction à un contact, une société ou une affaire" },
  );

export type CreateActivityInput = z.infer<typeof createActivitySchema>;

export const listActivitiesQuerySchema = z.object({
  contactId: z.string().optional(),
  companyId: z.string().optional(),
  dealId: z.string().optional(),
  type: z.enum(ACTIVITY_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export type ListActivitiesQuery = z.infer<typeof listActivitiesQuerySchema>;

export function parseActivitiesQuery(
  params: URLSearchParams | Record<string, string | undefined>,
) {
  const raw: Record<string, string> = {};
  const entries =
    params instanceof URLSearchParams ? [...params.entries()] : Object.entries(params);

  for (const [key, value] of entries) {
    if (typeof value === "string" && value.trim() !== "") raw[key] = value.trim();
  }

  return listActivitiesQuerySchema.safeParse(raw);
}
