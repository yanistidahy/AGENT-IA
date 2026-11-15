import { z } from "zod";

/** Schémas de validation des requêtes sur les sociétés. */

/**
 * **Le collage de trafics** : un texte, et le choix entre simuler et appliquer.
 *
 * `apply: false` est le défaut et c'est le motif du jalon 12 : on lit le
 * rapport, puis on écrit. Une seule route sert les deux, parce que deux routes
 * finiraient par rapprocher différemment — et le rapport ne vaudrait plus rien.
 */
export const importVisitorsSchema = z.object({
  text: z.string().min(1, "Collez au moins une ligne."),
  apply: z.boolean().optional(),
});

export type ImportVisitorsInput = z.infer<typeof importVisitorsSchema>;

export const createCompanySchema = z.object({
  name: z.string().trim().min(1, "Le nom de la société est obligatoire"),
  domain: z.string().trim().optional(),
  size: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  loc: z.string().trim().optional(),
  desc: z.string().optional(),
  /**
   * Visiteurs mensuels du site de la marque — la seule donnée qui décide du
   * segment (`segmentOf`, jalon 109). `null` vaut « non renseigné », et ce
   * n'est pas zéro : zéro affirmerait un site sans visite.
   */
  monthlyVisitors: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  /**
   * **La niche de la marque**, en texte libre — « bijoux », « soins visage ».
   *
   * Rognée et bornée à 60 caractères : au-delà c'est une phrase, pas une
   * niche, et une phrase ferait une ligne de tableau par fiche. Vide vaut
   * « non renseignée », que l'onglet Segments nomme au lieu de la masquer.
   */
  niche: z.string().trim().max(60).optional(),
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
    /**
     * Visiteurs mensuels du site de la marque — la seule donnée qui décide du
     * segment (`segmentOf`, jalon 109). `null` vaut « non renseigné », et ce
     * n'est pas zéro : zéro affirmerait un site sans visite.
     */
    monthlyVisitors: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  /**
   * **La niche de la marque**, en texte libre — « bijoux », « soins visage ».
   *
   * Rognée et bornée à 60 caractères : au-delà c'est une phrase, pas une
   * niche, et une phrase ferait une ligne de tableau par fiche. Vide vaut
   * « non renseignée », que l'onglet Segments nomme au lieu de la masquer.
   */
  niche: z.string().trim().max(60).optional(),
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
  // Le trafic est un scalaire : il se trie en SQL, les absents en fin de liste
  // dans les deux sens — « non renseigné » n'est ni le plus petit ni le plus
  // grand, il n'est rien (la règle des relances sans date, jalon 30).
  "monthlyVisitors",
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
export const COMPANY_FILTERS = ["pipeline", "clients", "orphan", "sansTrafic"] as const;
export type CompanyFilter = (typeof COMPANY_FILTERS)[number];

export const COMPANY_FILTER_LABELS: Record<CompanyFilter, string> = {
  pipeline: "Avec pipeline ouvert",
  clients: "Clients",
  orphan: "Sans contact",
  /*
    **La quatrième puce est celle du jalon 115**, et c'est la liste de travail
    du trafic : les marques dont le segment ne peut pas se calculer. Elle porte
    son compte, et ce compte est **le même nombre** que le bandeau de l'onglet
    Segments — tous deux viennent de `countCompaniesWithoutVisitors`.
  */
  sansTrafic: "Trafic non renseigné",
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
