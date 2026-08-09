import { z } from "zod";

/** Schémas de validation des requêtes sur les sociétés. */

export const createCompanySchema = z.object({
  name: z.string().trim().min(1, "Le nom de la société est obligatoire"),
  domain: z.string().trim().optional(),
  size: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  loc: z.string().trim().optional(),
  desc: z.string().optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const updateCompanySchema = z
  .object({
    name: z.string().trim().min(1, "Le nom de la société est obligatoire").optional(),
    domain: z.string().trim().optional(),
    size: z.string().trim().optional(),
    industry: z.string().trim().optional(),
    loc: z.string().trim().optional(),
    desc: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Aucun champ à mettre à jour",
  });

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

export const COMPANY_SORT_KEYS = [
  "name",
  "industry",
  "size",
  "loc",
  "createdAt",
  // Dérivés d'agrégats : triés en mémoire, voir lib/api/companies.ts.
  "contacts",
  "openValue",
  "wonValue",
] as const;

/**
 * Puces de `/societes`. Ce sont des raccourcis vers les trois questions posées
 * le plus souvent à un portefeuille de sociétés : où y a-t-il de l'argent en
 * jeu, qui a déjà signé, et quelles fiches sont restées vides.
 */
export const COMPANY_FILTERS = ["pipeline", "clients", "orphan"] as const;
export type CompanyFilter = (typeof COMPANY_FILTERS)[number];

export const COMPANY_FILTER_LABELS: Record<CompanyFilter, string> = {
  pipeline: "Avec pipeline ouvert",
  clients: "Clients",
  orphan: "Sans contact",
};

export const listCompaniesQuerySchema = z.object({
  q: z.string().optional(),
  industry: z.string().optional(),
  filter: z.enum(COMPANY_FILTERS).optional(),
  sort: z.enum(COMPANY_SORT_KEYS).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
});

export type ListCompaniesQuery = z.infer<typeof listCompaniesQuerySchema>;

export function parseCompaniesQuery(
  params: URLSearchParams | Record<string, string | undefined>,
) {
  const raw: Record<string, string> = {};
  const entries =
    params instanceof URLSearchParams ? [...params.entries()] : Object.entries(params);

  for (const [key, value] of entries) {
    if (typeof value === "string" && value.trim() !== "") raw[key] = value.trim();
  }

  return listCompaniesQuerySchema.safeParse(raw);
}
