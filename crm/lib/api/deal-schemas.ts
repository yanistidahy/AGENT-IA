import { z } from "zod";
import { DEAL_STATUSES } from "../domain/types";

/**
 * Schémas de validation des requêtes sur les affaires.
 *
 * `dateValue` valide au lieu de tolérer : une date illisible remonte une erreur
 * de champ plutôt que de devenir silencieusement `null`. Le `.optional()`
 * s'applique **après** la transformation, ce qui préserve la distinction entre
 * « champ absent » (ne rien changer, en PATCH) et « champ à null » (effacer).
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

const idValue = z.string().trim().min(1).nullable();

export const createDealSchema = z.object({
  name: z.string().trim().min(1, "Nommez l'affaire"),
  amount: z.number().int("Le montant doit être un entier").min(0, "Le montant ne peut être négatif"),
  stageId: z.string().trim().min(1, "L'étape est obligatoire"),
  owner: z.string().trim().min(1, "Le propriétaire est obligatoire"),
  offer: z.string().trim().optional(),
  notes: z.string().optional(),
  companyId: idValue.optional(),
  /** Société saisie au clavier : créée dans la même transaction que l'affaire. */
  companyName: z.string().trim().min(1).optional(),
  contactId: idValue.optional(),
  expectedClose: dateValue.optional(),
  prob: z.number().int().min(0).max(100).nullable().optional(),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;

/**
 * En PATCH, tout est facultatif — mais `name`, `amount`, `stageId` et `owner`
 * restent non vides s'ils sont fournis : on autorise l'omission, pas l'effacement.
 */
export const updateDealSchema = z
  .object({
    name: z.string().trim().min(1, "Nommez l'affaire").optional(),
    amount: z.number().int().min(0, "Le montant ne peut être négatif").optional(),
    stageId: z.string().trim().min(1).optional(),
    owner: z.string().trim().min(1).optional(),
    offer: z.string().trim().optional(),
    notes: z.string().optional(),
    companyId: idValue.optional(),
    companyName: z.string().trim().min(1).optional(),
    contactId: idValue.optional(),
    expectedClose: dateValue.optional(),
    prob: z.number().int().min(0).max(100).nullable().optional(),
    status: z.enum(DEAL_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Aucun champ à mettre à jour",
  });

export type UpdateDealInput = z.infer<typeof updateDealSchema>;

export const moveStageSchema = z.object({
  stageId: z.string().trim().min(1, "L'étape cible est obligatoire"),
});

/**
 * Marquer perdue. Le motif est **facultatif au schéma et obligatoire à
 * l'écran** : c'est la même posture que l'issue d'une interaction au jalon 13.
 * Un import ou un agent n'en porte pas, et refuser ces écritures casserait un
 * chemin légitime pour un champ d'ergonomie.
 */
export const markLostSchema = z.object({
  reason: z.string().trim().max(120, "Motif trop long").optional(),
});

export const DEAL_SORT_KEYS = [
  "name",
  "amount",
  "expectedClose",
  "lastActivityAt",
  "createdAt",
  "owner",
] as const;

export const listDealsQuerySchema = z.object({
  stageId: z.string().optional(),
  owner: z.string().optional(),
  status: z.enum([...DEAL_STATUSES, "all"]).optional(),
  q: z.string().optional(),
  sort: z.enum(DEAL_SORT_KEYS).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
});

export type ListDealsQuery = z.infer<typeof listDealsQuerySchema>;

/**
 * `URLSearchParams` ne distingue pas « paramètre absent » de « paramètre vide ».
 * Un filtre vidé par l'utilisateur doit valoir « pas de filtre », pas « filtre
 * sur la chaîne vide » — d'où le nettoyage avant validation.
 */
export function parseDealsQuery(params: URLSearchParams | Record<string, string | undefined>) {
  const raw: Record<string, string> = {};
  const entries =
    params instanceof URLSearchParams ? [...params.entries()] : Object.entries(params);

  for (const [key, value] of entries) {
    if (typeof value === "string" && value.trim() !== "") raw[key] = value.trim();
  }

  return listDealsQuerySchema.safeParse(raw);
}
