import { z } from "zod";
import { ACCOUNT_STATES, DM_STATES } from "../domain/instagram-filter";
import { CONTACT_FILTERS } from "../domain/follow-up";
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

/**
 * Nom facultatif — mais pas gratuitement.
 *
 * La prospection Instagram trouve la marque avant le fondateur : imposer un nom
 * fait inventer « — » ou « Contact », qui atterrit ensuite dans les listes. Le
 * champ est donc facultatif, et c'est `withIdentity` ci-dessous qui exige
 * qu'une fiche porte **quelque chose** : une personne, ou une marque.
 */
const nameValue = z.string().trim().optional();

export const createContactSchema = z.object({
  firstName: nameValue,
  lastName: nameValue,
  lifecycle: z.enum(LIFECYCLES, { error: "Cycle de vie inconnu" }),
  title: z.string().trim().optional(),
  dep: z.string().trim().optional(),
  email: emailValue.optional(),
  phone: z.string().trim().optional(),
  linkedin: z.string().trim().optional(),
  /** Site du contact. Stocké tel qu'il est saisi — voir lib/domain/links.ts. */
  website: z.string().trim().optional(),
  instagram: z.string().trim().optional(),
  source: z.string().trim().optional(),
  owner: z.string().trim().optional(),
  /** Étiquette libre. Vide = sans étiquette. */
  tag: z.string().trim().max(60, "Étiquette trop longue").optional(),
  /** Motif de perte. N'a de sens que si `lifecycle` vaut « Perdu ». */
  lostReason: z.string().trim().max(120, "Motif trop long").optional(),
  notes: z.string().optional(),
  companyId: idValue.optional(),
  /**
   * Société saisie au clavier plutôt que choisie dans la liste : elle est créée
   * dans la même transaction que le contact. Prime sur `companyId`.
   */
  companyName: z.string().trim().min(1).optional(),
  lastContact: dateValue.optional(),
  nextReminder: dateValue.optional(),
})
  /**
   * Une fiche doit porter **quelque chose** : une personne, ou une marque.
   *
   * Sans cette contrainte, « nom facultatif » deviendrait « fiche vide
   * autorisée », et une liste de contacts anonymes qu'on ne sait ni nommer ni
   * joindre n'est pas un vivier, c'est du bruit. L'erreur porte sur
   * `companyName` parce que c'est le champ que la bascule rend obligatoire à
   * l'écran — l'utilisateur doit être renvoyé là où il peut agir.
   */
  .refine(
    (value) =>
      (value.firstName ?? "") !== "" ||
      (value.lastName ?? "") !== "" ||
      (value.companyName ?? "") !== "" ||
      (value.companyId ?? null) !== null,
    {
      path: ["companyName"],
      message: "Sans nom de personne, le nom de la marque est obligatoire",
    },
  );

export type CreateContactInput = z.infer<typeof createContactSchema>;

export const updateContactSchema = z
  .object({
    // Vider un nom est autorisé : on peut s'être trompé de personne sur une
    // marque, et la fiche redevient alors « à identifier ».
    firstName: nameValue,
    lastName: nameValue,
    lifecycle: z.enum(LIFECYCLES, { error: "Cycle de vie inconnu" }).optional(),
    title: z.string().trim().optional(),
    dep: z.string().trim().optional(),
    email: emailValue.optional(),
    phone: z.string().trim().optional(),
    linkedin: z.string().trim().optional(),
    website: z.string().trim().optional(),
  instagram: z.string().trim().optional(),
    source: z.string().trim().optional(),
    owner: z.string().trim().optional(),
    tag: z.string().trim().max(60, "Étiquette trop longue").optional(),
    lostReason: z.string().trim().max(120, "Motif trop long").optional(),
    notes: z.string().optional(),
    companyId: idValue.optional(),
    companyName: z.string().trim().min(1).optional(),
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
  "tag",
  // Dénormalisés sur la fiche à l'envoi, donc triables en SQL — contrairement
  // aux agrégats du jalon 22, qui restent volontairement non triables.
  "emailCount",
  "lastEmailAt",
  // Dérivés : triés en mémoire, voir lib/api/contacts.ts.
  "followUp",
  "nextReminder",
] as const;

export const listContactsQuerySchema = z.object({
  q: z.string().optional(),
  lifecycle: z.enum([...LIFECYCLES, "all"]).optional(),
  followUp: z.enum(CONTACT_FILTERS).optional(),
  /**
   * Les deux axes du segment Instagram, **indépendants** : leur croisement
   * donne les quatre lectures sans qu'aucune ait été énumérée. `account` porte
   * sur le champ de la fiche, `dm` sur les interactions — voir
   * lib/domain/instagram-filter.ts.
   */
  account: z.enum(ACCOUNT_STATES).optional(),
  dm: z.enum(DM_STATES).optional(),
  owner: z.string().optional(),
  source: z.string().optional(),
  companyId: z.string().optional(),
  /** Chaîne vide = « sans étiquette », qui est une sélection, pas une absence. */
  tag: z.string().optional(),
  /**
   * Fiches qu'on ne sait pas joindre. Booléen porté par l'URL : `?incomplete=1`.
   */
  incomplete: z
    .union([z.boolean(), z.string()])
    .transform((value) => value === true || value === "1" || value === "true")
    .optional(),
  sort: z.enum(CONTACT_SORT_KEYS).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
});

export type ListContactsQuery = z.infer<typeof listContactsQuerySchema>;

/** Ligne d'import : les champs sont libres, la validation se fait ligne par ligne. */
export const importContactsSchema = z.object({
  text: z.string().min(1, "Collez au moins une ligne"),
  /**
   * Mise à jour des fiches existantes. **Décochée par défaut** : un import qui
   * modifie l'existant sans qu'on l'ait demandé est une perte de données qui ne
   * dit pas son nom.
   */
  update: z.boolean().optional(),
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
