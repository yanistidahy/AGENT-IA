import "server-only";

import { prisma } from "../db";
import { sortKey } from "../domain/sort-key";

/**
 * Les onglets personnalisés de l'écran Tâches.
 *
 * **Un onglet enregistré est une requête nommée, pas un groupe de tâches.**
 * C'est ce qui le sépare des filtres personnalisés de `/contacts` (jalon 79),
 * qui retiennent des fiches choisies une à une : ici, rien n'est rangé — la
 * recherche et les filtres courants sont mémorisés sous un nom, et l'onglet
 * rend ce qu'ils rendent aujourd'hui. Les six onglets fixes du jalon 92 sont
 * calculés à la lecture, et un onglet enregistré ne fait pas exception : il
 * n'existe **aucune table de tâches rangées**, donc rien qui puisse contredire
 * la liste.
 *
 * Le geste, lui, est le même que celui des filtres personnalisés, et l'écran le
 * dit : un « + » à côté des onglets, un nom, et la vue revient telle quelle
 * après un rechargement parce que la requête est écrite dans l'URL.
 */

export interface TaskTabRecord {
  readonly id: string;
  readonly name: string;
  /** La requête enregistrée, sous sa forme d'URL (`onglet=appels&q=…`). */
  readonly query: string;
}

/** Les onglets enregistrés, alphabétiques — c'est une liste de référence (jalon 72). */
export async function listTaskTabs(): Promise<TaskTabRecord[]> {
  const rows = await prisma.taskTab.findMany({
    orderBy: [{ nameKey: { sort: "asc", nulls: "last" } }, { name: "asc" }],
    select: { id: true, name: true, query: true },
  });
  return rows.map((row) => ({ id: row.id, name: row.name, query: row.query }));
}

export type SaveTabResult =
  | { readonly ok: true; readonly tab: TaskTabRecord }
  | { readonly ok: false; readonly message: string };

/**
 * Enregistre la recherche et les filtres courants sous un nom.
 *
 * Le nom est nettoyé de ses bords et **rien d'autre** : c'est une étiquette
 * humaine, pas une clé. Deux onglets peuvent donc porter le même nom, comme
 * deux filtres personnalisés (jalon 79) — refuser un homonyme obligerait à
 * inventer « Appels (2) » là où quelqu'un sait ce qu'il fait.
 */
export async function saveTaskTab(name: string, query: string): Promise<SaveTabResult> {
  const clean = name.trim();
  if (clean === "") return { ok: false, message: "Donnez un nom à cet onglet." };

  const row = await prisma.taskTab.create({
    data: { name: clean, nameKey: sortKey([clean]), query: query.trim() },
    select: { id: true, name: true, query: true },
  });
  return { ok: true, tab: { id: row.id, name: row.name, query: row.query } };
}

/**
 * Supprime un onglet enregistré.
 *
 * **Aucune tâche n'est touchée** : un onglet n'est qu'une requête, et ce qu'il
 * montrait reste exactement là où c'était. C'est la même promesse que la
 * suppression d'un filtre personnalisé, et elle est plus facile à tenir ici,
 * puisqu'il n'y a aucune appartenance à effacer.
 */
export async function deleteTaskTab(id: string): Promise<void> {
  await prisma.taskTab.deleteMany({ where: { id } });
}
