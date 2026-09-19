import { sortKey } from "./sort-key";

/**
 * **Un filtre personnalisé : un groupe nommé, constitué à la main.**
 *
 * Ce module ne porte que ce qui se décide sans base : le nom, ce qu'une
 * suppression emporte, et ce qu'un ajout vient de faire. Le reste — qui est
 * dedans, combien — est une lecture, et vit dans `lib/api/custom-filters.ts`.
 *
 * ### Ce qu'un filtre personnalisé n'est pas
 *
 * | | Ce que ça décrit | Quand ça change |
 * |---|---|---|
 * | une **puce** existante | une question (« les Lead sans DM ») | à chaque écriture du CRM |
 * | un **filtre personnalisé** | un choix (« les vingt marques du salon ») | quand quelqu'un le change |
 * | une **inscription** de campagne | ce qu'on envoie, et où on en est | à chaque étape envoyée |
 *
 * Les trois cohabitent volontairement. Un groupe qui se recalculerait serait
 * une puce portant un nom, donc un second vocabulaire pour une chose qui existe
 * déjà ; et l'inverse — enregistrer une puce sous un nom — ne saurait pas
 * décrire « ces vingt-là », qu'aucune requête unique ne retient.
 *
 * **Le mot « filtre » est celui de l'écran**, pas une confusion : il se pose et
 * se retire exactement comme les autres puces de /contacts, et se croise avec
 * elles. Ce qui le distingue, c'est ce qu'il désigne — un choix, pas une
 * question — et le produit le dit partout où il se crée ou se supprime.
 */

/** Longueur maximale d'un nom. Assez pour une phrase, pas pour un paragraphe. */
export const FILTER_NAME_MAX = 80;

/**
 * Le nom retenu, ou `null` si ce n'en est pas un.
 *
 * Les espaces de bord sont retirés — un nom qui ne diffère d'un autre que par
 * une espace finale est un doublon qu'on ne voit pas — mais la casse et les
 * accents sont **conservés** : c'est le nom que l'utilisateur a écrit. Le tri,
 * lui, passe par `nameKey` (jalon 72), qui est fait pour ça.
 */
export function cleanFilterName(raw: string): string | null {
  const name = raw.trim().replace(/\s+/g, " ");
  if (name === "") return null;
  return name.slice(0, FILTER_NAME_MAX);
}

/** La clé de tri — la même règle que les sociétés et les campagnes. */
export function filterSortKey(name: string): string | null {
  return sortKey([name]);
}

export interface AddOutcome {
  /** Fiches réellement ajoutées. */
  readonly added: number;
  /** Fiches déjà présentes — ni une erreur, ni un ajout. */
  readonly already: number;
}

/**
 * « 8 ajoutées · 2 déjà dans le filtre », chaque raison accordée sur son compte.
 *
 * Deux nombres plutôt qu'un : « 10 traitées » ne dit pas si l'on vient de
 * gagner dix fiches ou de recliquer sur les mêmes. C'est la règle de
 * `describeBulkOutcome` du jalon 26.
 */
export function describeAddOutcome(outcome: AddOutcome): string {
  const parts: string[] = [`${outcome.added} ajoutée${outcome.added > 1 ? "s" : ""}`];
  if (outcome.already > 0) {
    parts.push(`${outcome.already} déjà dans le filtre`);
  }
  return parts.join(" · ");
}

/**
 * Ce que supprimer un filtre emporte — et surtout ce qu'il n'emporte pas.
 *
 * La phrase est composée ici plutôt qu'à l'écran parce qu'elle est une
 * **promesse** : les fiches restent. Une confirmation qui ne le dit pas laisse
 * croire qu'on efface des contacts, et personne ne clique alors ; une qui le
 * dit à deux endroits finit par le dire de deux façons (jalons 55, 64 et 66).
 */
export function describeFilterDeletion(name: string, members: number): string {
  const count =
    members === 0
      ? "Il ne contient aucune fiche."
      : members === 1
        ? "Sa fiche reste dans le CRM avec tout son historique : seule l'appartenance à ce filtre disparaît."
        : `Ses ${members} fiches restent dans le CRM avec tout leur historique : seule l'appartenance à ce filtre disparaît.`;
  return `Supprimer le filtre « ${name} » ? ${count}`;
}
