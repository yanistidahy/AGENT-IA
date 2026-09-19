import "server-only";
import { z } from "zod";

import { prisma } from "../db";
import { resolveSelectionIds } from "./contact-selection";
import {
  cleanListName,
  listSortKey,
  type AddOutcome,
} from "../domain/contact-lists";

/**
 * **Des listes nommées, et rien qui les modifie tout seul.**
 *
 * C'est la seule promesse du module, et elle décide de tout le reste : aucune
 * fonction ici n'est appelée par une lecture d'écran, par le passage quotidien,
 * ni par l'envoi d'un message. Une liste ne bouge que quand quelqu'un clique —
 * la règle « aucune écriture sans clic » du jalon 8, appliquée à une donnée
 * dont la valeur *est* d'avoir été choisie à la main.
 *
 * Ce que ce module ne fait jamais, et c'est la moitié du jalon :
 *
 * - **il ne touche pas aux fiches.** Retirer quelqu'un d'une liste, ou
 *   supprimer la liste entière, n'écrit rien sur `contacts` — ni cycle de vie,
 *   ni statut, ni relance. Seule l'appartenance disparaît ;
 * - **il n'inscrit personne à une campagne.** Ajouter à une liste et inscrire à
 *   une campagne sont deux gestes, et les lier ferait partir des messages
 *   depuis un geste de rangement.
 */

export interface ContactListSummary {
  readonly id: string;
  readonly name: string;
  readonly members: number;
  readonly createdAt: Date;
}

/** Les listes, alphabétiques — c'est une liste de référence (jalon 72). */
export async function listContactLists(): Promise<ContactListSummary[]> {
  const rows = await prisma.contactList.findMany({
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

export async function readContactList(id: string): Promise<ContactListSummary | null> {
  const row = await prisma.contactList.findUnique({
    where: { id },
    select: { id: true, name: true, createdAt: true, _count: { select: { members: true } } },
  });
  return row === null
    ? null
    : { id: row.id, name: row.name, members: row._count.members, createdAt: row.createdAt };
}

export const createListSchema = z.object({ name: z.string() });
export const renameListSchema = z.object({ id: z.string().min(1), name: z.string() });

/**
 * Crée une liste vide.
 *
 * **Deux listes peuvent porter le même nom**, et ce n'est pas un oubli : le nom
 * est une étiquette humaine, pas une clé. Refuser un homonyme obligerait à
 * inventer « Salon 2026 (2) » là où l'utilisateur sait très bien ce qu'il fait —
 * et les deux listes restent distinctes par leur contenu, qui est ce qui compte.
 */
export async function createContactList(
  input: z.infer<typeof createListSchema>,
): Promise<{ ok: true; id: string; name: string } | { ok: false; message: string }> {
  const name = cleanListName(input.name);
  if (name === null) return { ok: false, message: "Donnez un nom à la liste." };

  const row = await prisma.contactList.create({
    data: { name, nameKey: listSortKey(name) },
    select: { id: true, name: true },
  });
  return { ok: true, id: row.id, name: row.name };
}

export async function renameContactList(
  input: z.infer<typeof renameListSchema>,
): Promise<{ ok: true; name: string } | { ok: false; message: string }> {
  const name = cleanListName(input.name);
  if (name === null) return { ok: false, message: "Donnez un nom à la liste." };

  const exists = await prisma.contactList.findUnique({ where: { id: input.id } });
  if (exists === null) return { ok: false, message: "Liste introuvable." };

  // La clé de tri suit le nom dans la **même** écriture : la laisser derrière
  // rangerait la liste renommée d'après son ancien nom, sans que rien ne le
  // dise (jalon 72).
  await prisma.contactList.update({
    where: { id: input.id },
    data: { name, nameKey: listSortKey(name) },
  });
  return { ok: true, name };
}

/**
 * Supprime la liste, et **seulement** la liste.
 *
 * Les appartenances partent avec elle par cascade de la base ; les fiches, leur
 * historique, leurs envois et leurs inscriptions de campagne ne sont pas
 * touchés. Il n'y a donc **aucune friction de confirmation côté serveur** — pas
 * de nom à retaper comme pour une campagne qui a envoyé (jalon 61) : rien
 * d'irremplaçable ne disparaît, et exiger une cérémonie pour un rangement
 * apprendrait à cliquer sans lire les vraies confirmations.
 */
export async function deleteContactList(
  id: string,
): Promise<{ ok: true; removed: number } | { ok: false; message: string }> {
  const list = await prisma.contactList.findUnique({
    where: { id },
    select: { _count: { select: { members: true } } },
  });
  if (list === null) return { ok: false, message: "Liste introuvable." };

  await prisma.contactList.delete({ where: { id } });
  return { ok: true, removed: list._count.members };
}

export const addToListSchema = z.object({
  listId: z.string().min(1),
  /** Le filtre courant de /contacts, tel que l'écran l'affichait. */
  selection: z.string().default(""),
  /** Les fiches cochées — elles l'emportent quand il y en a. */
  contactIds: z.array(z.string()).max(2000).optional(),
});

/**
 * Ajoute à la liste ce que la sélection désigne **maintenant**.
 *
 * `createMany` avec `skipDuplicates` plutôt qu'une lecture préalable : la
 * contrainte d'unicité `(listId, contactId)` fait le travail, et une
 * vérification applicative se ferait contourner par deux onglets ouverts en
 * même temps. Le nombre de doublons est déduit de l'écart entre ce qu'on a
 * demandé et ce que la base a écrit — un fait, pas une estimation.
 */
export async function addToContactList(
  input: z.infer<typeof addToListSchema>,
): Promise<{ ok: true; outcome: AddOutcome } | { ok: false; message: string }> {
  const list = await prisma.contactList.findUnique({ where: { id: input.listId } });
  if (list === null) return { ok: false, message: "Liste introuvable." };

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

  const written = await prisma.contactListMember.createMany({
    data: alive.map((contact) => ({ listId: input.listId, contactId: contact.id })),
    skipDuplicates: true,
  });

  return {
    ok: true,
    outcome: { added: written.count, already: alive.length - written.count },
  };
}

export const removeFromListSchema = z.object({
  listId: z.string().min(1),
  contactIds: z.array(z.string()).min(1).max(2000),
});

/**
 * Retire des fiches de la liste, **sans toucher au CRM**.
 *
 * Même discipline que le retrait d'un inscrit de campagne (jalon 70) : la
 * personne sort de la liste, tout le reste — sa fiche, ses interactions, ses
 * envois, ses autres listes — est exactement dans l'état où elle était.
 */
export async function removeFromContactList(
  input: z.infer<typeof removeFromListSchema>,
): Promise<{ ok: true; removed: number } | { ok: false; message: string }> {
  const list = await prisma.contactList.findUnique({ where: { id: input.listId } });
  if (list === null) return { ok: false, message: "Liste introuvable." };

  const deleted = await prisma.contactListMember.deleteMany({
    where: { listId: input.listId, contactId: { in: input.contactIds } },
  });
  return { ok: true, removed: deleted.count };
}
