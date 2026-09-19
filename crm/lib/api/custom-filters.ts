import "server-only";
import { z } from "zod";

import { prisma } from "../db";
import { resolveSelectionIds } from "./contact-selection";
import { cleanFilterName, filterSortKey, type AddOutcome } from "../domain/custom-filters";

/**
 * **Des groupes nommés, et rien qui les modifie tout seul.**
 *
 * C'est la seule promesse du module, et elle décide de tout le reste : aucune
 * fonction ici n'est appelée par une lecture d'écran, par le passage quotidien,
 * ni par l'envoi d'un message. Un filtre personnalisé ne bouge que quand
 * quelqu'un clique — la règle « aucune écriture sans clic » du jalon 8,
 * appliquée à une donnée dont la valeur *est* d'avoir été choisie à la main.
 *
 * Ce que ce module ne fait jamais, et c'est la moitié du jalon :
 *
 * - **il ne touche pas aux fiches.** Retirer quelqu'un d'un filtre, ou
 *   supprimer le filtre entier, n'écrit rien sur `contacts` — ni cycle de vie,
 *   ni statut, ni relance. Seule l'appartenance disparaît ;
 * - **il n'inscrit personne à une campagne.** Ajouter à un filtre et inscrire à
 *   une campagne sont deux gestes, et les lier ferait partir des messages
 *   depuis un geste de rangement.
 */

export interface CustomFilterSummary {
  readonly id: string;
  readonly name: string;
  readonly members: number;
  readonly createdAt: Date;
}

/** Les filtres, alphabétiques — c'est une liste de référence (jalon 72). */
export async function listCustomFilters(): Promise<CustomFilterSummary[]> {
  const rows = await prisma.customFilter.findMany({
    orderBy: [{ nameKey: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { members: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    members: row._count.members,
    createdAt: row.createdAt,
  }));
}

export async function readCustomFilter(id: string): Promise<CustomFilterSummary | null> {
  const row = await prisma.customFilter.findUnique({
    where: { id },
    select: { id: true, name: true, createdAt: true, _count: { select: { members: true } } },
  });
  return row === null
    ? null
    : { id: row.id, name: row.name, members: row._count.members, createdAt: row.createdAt };
}

export const createFilterSchema = z.object({ name: z.string() });
export const renameFilterSchema = z.object({ id: z.string().min(1), name: z.string() });

/**
 * Crée un filtre vide.
 *
 * **Deux filtres peuvent porter le même nom**, et ce n'est pas un oubli : le
 * nom est une étiquette humaine, pas une clé. Refuser un homonyme obligerait à
 * inventer « Salon Paris (2) » là où l'utilisateur sait très bien ce qu'il
 * fait — et les deux restent distincts par leur contenu, qui est ce qui compte.
 */
export async function createCustomFilter(
  input: z.infer<typeof createFilterSchema>,
): Promise<{ ok: true; id: string; name: string } | { ok: false; message: string }> {
  const name = cleanFilterName(input.name);
  if (name === null) return { ok: false, message: "Donnez un nom au filtre." };

  const row = await prisma.customFilter.create({
    data: { name, nameKey: filterSortKey(name) },
    select: { id: true, name: true },
  });
  return { ok: true, id: row.id, name: row.name };
}

export async function renameCustomFilter(
  input: z.infer<typeof renameFilterSchema>,
): Promise<{ ok: true; name: string } | { ok: false; message: string }> {
  const name = cleanFilterName(input.name);
  if (name === null) return { ok: false, message: "Donnez un nom au filtre." };

  const exists = await prisma.customFilter.findUnique({ where: { id: input.id } });
  if (exists === null) return { ok: false, message: "Filtre introuvable." };

  // La clé de tri suit le nom dans la **même** écriture : la laisser derrière
  // rangerait le filtre renommé d'après son ancien nom, sans que rien ne le
  // dise (jalon 72).
  await prisma.customFilter.update({
    where: { id: input.id },
    data: { name, nameKey: filterSortKey(name) },
  });
  return { ok: true, name };
}

/**
 * Supprime le filtre, et **seulement** le filtre.
 *
 * Les appartenances partent avec lui par cascade de la base ; les fiches, leur
 * historique, leurs envois et leurs inscriptions de campagne ne sont pas
 * touchés. Il n'y a donc **aucune friction de confirmation côté serveur** — pas
 * de nom à retaper comme pour une campagne qui a envoyé (jalon 61) : rien
 * d'irremplaçable ne disparaît, et exiger une cérémonie pour un rangement
 * apprendrait à cliquer sans lire les vraies confirmations.
 */
export async function deleteCustomFilter(
  id: string,
): Promise<{ ok: true; removed: number } | { ok: false; message: string }> {
  const filter = await prisma.customFilter.findUnique({
    where: { id },
    select: { _count: { select: { members: true } } },
  });
  if (filter === null) return { ok: false, message: "Filtre introuvable." };

  await prisma.customFilter.delete({ where: { id } });
  return { ok: true, removed: filter._count.members };
}

export const addToFilterSchema = z.object({
  filterId: z.string().min(1),
  /** Le filtre courant de /contacts, tel que l'écran l'affichait. */
  selection: z.string().default(""),
  /** Les fiches cochées — elles l'emportent quand il y en a. */
  contactIds: z.array(z.string()).max(2000).optional(),
});

/**
 * Ajoute au filtre ce que la sélection désigne **maintenant**.
 *
 * `createMany` avec `skipDuplicates` plutôt qu'une lecture préalable : la
 * contrainte d'unicité `(filterId, contactId)` fait le travail, et une
 * vérification applicative se ferait contourner par deux onglets ouverts en
 * même temps. Le nombre de doublons est déduit de l'écart entre ce qu'on a
 * demandé et ce que la base a écrit — un fait, pas une estimation.
 */
export async function addToCustomFilter(
  input: z.infer<typeof addToFilterSchema>,
): Promise<{ ok: true; outcome: AddOutcome } | { ok: false; message: string }> {
  const filter = await prisma.customFilter.findUnique({ where: { id: input.filterId } });
  if (filter === null) return { ok: false, message: "Filtre introuvable." };

  const resolved = await resolveSelectionIds(input.selection, input.contactIds);
  if (!resolved.ok) return { ok: false, message: resolved.message };

  // Les identifiants viennent d'un écran : une fiche supprimée entre
  // l'affichage et le clic ferait échouer l'insertion entière sur une clé
  // étrangère. On ne garde donc que ce qui existe encore, sans le compter comme
  // un doublon — ce serait deux causes sous un seul nombre.
  const alive = await prisma.contact.findMany({
    where: { id: { in: resolved.ids } },
    select: { id: true },
  });

  const written = await prisma.customFilterMember.createMany({
    data: alive.map((contact) => ({ filterId: input.filterId, contactId: contact.id })),
    skipDuplicates: true,
  });

  return {
    ok: true,
    outcome: { added: written.count, already: alive.length - written.count },
  };
}

export const removeFromFilterSchema = z.object({
  filterId: z.string().min(1),
  contactIds: z.array(z.string()).min(1).max(2000),
});

/**
 * Retire des fiches du filtre, **sans toucher au CRM**.
 *
 * Même discipline que le retrait d'un inscrit de campagne (jalon 70) : la
 * personne sort du groupe, tout le reste — sa fiche, ses interactions, ses
 * envois, ses autres filtres — est exactement dans l'état où elle était.
 */
export async function removeFromCustomFilter(
  input: z.infer<typeof removeFromFilterSchema>,
): Promise<{ ok: true; removed: number } | { ok: false; message: string }> {
  const filter = await prisma.customFilter.findUnique({ where: { id: input.filterId } });
  if (filter === null) return { ok: false, message: "Filtre introuvable." };

  const deleted = await prisma.customFilterMember.deleteMany({
    where: { filterId: input.filterId, contactId: { in: input.contactIds } },
  });
  return { ok: true, removed: deleted.count };
}
