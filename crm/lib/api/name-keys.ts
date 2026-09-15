import { sortKey } from "../domain/sort-key";

/**
 * Les clés de tri, par modèle — **un seul endroit où l'on décide de quoi elles
 * sont faites**.
 *
 * Le jalon 12 a payé une fois la leçon inverse : `searchText` était composé à la
 * main sur chaque chemin d'écriture, deux d'entre eux l'oubliaient, et les
 * fiches entrées par là restaient introuvables sans que rien ne paraisse
 * anormal. Ici la composition vit dans trois fonctions nommées, et
 * `tests/name-key-source.test.ts` échoue si un chemin écrit un nom sans écrire
 * sa clé.
 */

/** Une société se classe par son nom. */
export function companyNameKey(name: string | null | undefined): string | null {
  return sortKey([name]);
}

/**
 * Un contact se classe par **nom puis prénom**.
 *
 * C'est l'ordre d'un répertoire, et c'est aussi celui qui départage deux
 * personnes d'une même maison — là où le tri principal, la société, les a déjà
 * réunies. Une fiche de marque, sans personne nommée (jalon 50), n'a pas de
 * clé : elle se range en fin de sa maison plutôt qu'en tête.
 */
export function contactNameKey(contact: {
  readonly firstName?: string | null;
  readonly lastName?: string | null;
}): string | null {
  return sortKey([contact.lastName, contact.firstName]);
}

/** Une campagne se classe par son nom. */
export function campaignNameKey(name: string | null | undefined): string | null {
  return sortKey([name]);
}
