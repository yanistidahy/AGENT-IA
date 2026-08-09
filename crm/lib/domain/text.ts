/**
 * Normalisation de texte pour la recherche.
 *
 * « zenith » doit trouver « Zénith ». `mode: "insensitive"` de PostgreSQL ne
 * couvre que la casse, jamais les accents — la limitation était signalée depuis
 * le jalon 3, et avec 133 sociétés réelles elle mord.
 *
 * Deux chemins étaient possibles. L'extension `unaccent` fait le travail en SQL,
 * mais dépend d'un privilège que le service de base peut refuser, et une
 * recherche qui marche en développement et pas en production est pire qu'une
 * recherche limitée. On maintient donc une **colonne miroir normalisée**,
 * écrite par l'application à chaque écriture : la règle vit ici, en TypeScript,
 * testable sans base, et la requête redevient un simple `contains`.
 *
 * Le prix est explicite : une colonne à tenir à jour. Il est payé une fois dans
 * `searchTextFor*()`, appelé par les trois services d'écriture.
 */

/**
 * Retire les diacritiques et passe en minuscules.
 *
 * `normalize("NFD")` décompose « é » en « e » + accent combinant ; la plage
 * U+0300–U+036F est celle de ces accents combinants. Ce qui reste est le
 * caractère de base. La méthode couvre tout l'alphabet latin, pas seulement le français —
 * « Skłodowska » et « Ångström » se cherchent aussi.
 */
export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Assemble les champs cherchables d'un enregistrement en une seule chaîne.
 *
 * Les valeurs vides sont écartées et un espace sépare les autres : sans lui,
 * « Marie » suivi de « Durand » produirait « mariedurand », où « ried » se
 * trouverait par accident.
 */
export function searchText(parts: ReadonlyArray<string | null | undefined>): string {
  return fold(
    parts
      .filter((part): part is string => typeof part === "string" && part.trim() !== "")
      .join(" "),
  );
}

/** Terme de recherche prêt pour un `contains`. Vide = pas de filtre. */
export function searchTerm(value: string | null | undefined): string {
  return typeof value === "string" ? fold(value) : "";
}
