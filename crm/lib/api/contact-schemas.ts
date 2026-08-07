import { z } from "zod";
import { LIFECYCLES } from "../domain/types";

/**
 * Schémas de validation des requêtes sur les contacts.
 *
 * Même règle que pour les affaires : la transformation de date valide au lieu de
 * tolérer, et `.optional()` s'applique après, ce qui préserve la distinction
 * entre « champ absent » (ne rien changer) et « champ à null » (effacer).
 */
const dateValue = z
  .union([z.string(), z.date(), z.null()])
  .transform((value, ctx) => {
    if (value === null) return null;
    if (value instanceof Date) return value;

    const trimmed = value.trim();
    if (trimmed === "") return null;

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      ctx.addIssue({ code: "custom", message: "Date invalide" });
      return z.NEVER;
    }
    return parsed;
  });

/**
 * L'adresse électronique est facultative — beaucoup de contacts entrent dans le
 * CRM avec un nom et une société, rien de plus. Mais si elle est renseignée, elle
 * doit être plausible : un import silencieusement rempli d'adresses fausses est
 * pire qu'un import qui signale ses lignes douteuses.
 */
const emailValue = z
  .string()
  .trim()
  .refine((value) => value === "" || z.email().safeParse(value).success, {
    message: "Adresse électronique invalide",
  });

const idValue = z.string().trim().min(1).nullable();

export const createContactSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est obligatoire"),
  lastName: z.string().trim().min(1, "Le nom est obligatoire"),
  lifecycle: z.enum(LIFECYCLES, { error: "Cycle de vie inconnu" }),
  title: z.string().trim().optional(),
  dep: z.string().trim().optional(),
  email: emailValue.optional(),
  phone: z.string().trim().optional(),
  linkedin: z.string().trim().optional(),
  source: z.string().trim().optional(),
  owner: z.string().trim().optional(),
  notes: z.string().optional(),
  companyId: idValue.optional(),
  lastContact: dateValue.optional(),
  nextReminder: dateValue.optional(),
});

export type CreateContactInput = z.infer<typeof createContactSchema>;

export const updateContactSchema = z
  .object({
    firstName: z.string().trim().min(1, "Le prénom est obligatoire").optional(),
    lastName: z.string().trim().min(1, "Le nom est obligatoire").optional(),
    lifecycle: z.enum(LIFECYCLES, { error: "Cycle de vie inconnu" }).optional(),
    title: z.string().trim().optional(),
    dep: z.string().trim().optional(),
    email: emailValue.optional(),
    phone: z.string().trim().optional(),
    linkedin: z.string().trim().optional(),
    source: z.string().trim().optional(),
    owner: z.string().trim().optional(),
    notes: z.string().optional(),
    companyId: idValue.optional(),
    lastContact: dateValue.optional(),
    nextReminder: dateValue.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Aucun champ à mettre à jour",
  });

export type UpdateContactInput = z.infer<typeof updateContactSchema>;

export const CONTACT_SORT_KEYS = [
  "lastName",
  "firstName",
  "company",
  "lifecycle",
  "owner",
  "lastContact",
  "createdAt",
] as const;

export const listContactsQuerySchema = z.object({
  q: z.string().optional(),
  lifecycle: z.enum([...LIFECYCLES, "all"]).optional(),
  owner: z.string().optional(),
  source: z.string().optional(),
  companyId: z.string().optional(),
  sort: z.enum(CONTACT_SORT_KEYS).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
});

export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>;

/** Ligne d'import : les champs sont libres, la validation se fait ligne par ligne. */
export const importContactsSchema = z.object({
  text: z.string().min(1, "Collez au moins une ligne"),
});

/**
 * `URLSearchParams` ne distingue pas « paramètre absent » de « paramètre vide » :
 * un filtre vidé par l'utilisateur vaut « pas de filtre ».
 */
export function parseContactsQuery(
  params: URLSearchParams | Record<string, string | undefined>,
) {
  const raw: Record<string, string> = {};
  const entries =
    params instanceof URLSearchParams ? [...params.entries()] : Object.entries(params);

  for (const [key, value] of entries) {
    if (typeof value === "string" && value.trim() !== "") raw[key] = value.trim();
  }

  return listContactsQuerySchema.safeParse(raw);
}
