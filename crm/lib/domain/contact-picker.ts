import { personName, type ContactIdentityLike } from "./contact-identity";
import { searchText } from "./text";

/**
 * **Choisir un contact : une seule liste, un seul ordre, un seul libellé.**
 *
 * ## Le défaut qu'on ferme
 *
 * Les sélecteurs de contact affichaient « Prénom Nom » et triaient sur le
 * **nom de famille** : `orderBy: [{ lastName: "asc" }]` sur `/affaires` et
 * `/pipeline`, la clé `nameKey` — qui est `sortKey([lastName, firstName])` —
 * ailleurs. À cent soixante-quinze fiches, une liste rangée sur une valeur
 * qu'elle **ne montre pas** se lit comme une liste non rangée : on la parcourt
 * entièrement à chaque fois. Deux conséquences visibles s'ajoutaient à la
 * première : la chaîne vide étant le plus petit préfixe de tout, les fiches
 * sans nom montaient **en tête**, toutes libellées « Fiche sans nom », donc
 * indiscernables ; et les noms importés d'un tableur arrivaient en « aguilera »
 * ou « BAKHKHAR », ce qui achevait de rendre l'ordre illisible.
 *
 * ## Ce que ce module décide, et pourquoi il est seul à le décider
 *
 * Trois règles, qui doivent tenir ensemble ou ne servent à rien :
 *
 * 1. **l'ordre** est celui du prénom, puis du nom — c'est-à-dire l'ordre de ce
 *    qu'on lit ;
 * 2. **le libellé** est le nom rangé, à défaut ce par quoi on distingue la
 *    fiche ;
 * 3. **la clé de recherche** couvre prénom, nom, adresse et société.
 *
 * Les trois sortent de `contactOptions()`, qui rend une liste **déjà triée**.
 * Un appelant qui trierait de son côté, ou qui recomposerait un libellé,
 * ferait diverger deux écrans sur les mêmes fiches : `contact-picker-source`
 * échoue si cela se reproduit.
 *
 * ## `localeCompare("fr")` ici, et non la clé pliée de `sort-key.ts`
 *
 * `compareKeys()` compare des clés pliées parce qu'il doit rendre **exactement**
 * l'ordre d'un `ORDER BY` sur une colonne miroir : une liste lue en SQL et un
 * agrégat trié en mémoire ne peuvent pas se contredire. Ce n'est pas le cas
 * ici — la liste d'un sélecteur est triée en mémoire, et rien en base ne porte
 * « prénom puis nom ».
 *
 * L'objection du jalon 72 contre `localeCompare` visait l'appel **sans
 * locale**, qui suit celle du processus : celle du conteneur Railway, donc une
 * décision d'affichage qui change avec l'hébergeur. Avec la locale écrite —
 * `"fr"` — et `sensitivity: "base"`, le résultat est celui du français partout
 * où les données ICU existent, et il est meilleur que la table de lettres de
 * `sort-key.ts` : « Ødegaard » se classe en O et « Œuvrard » en OE, là où leur
 * point de code les enverrait après « Z ».
 *
 * `sensitivity: "base"` rend **0** pour « Élodie » et « Elodie » : elles sont
 * voisines, ce que le test d'acceptation demande. Deux valeurs égales laissent
 * l'ordre d'entrée décider — celui d'une requête SQL, donc instable. Le
 * comparateur départage donc au nom, puis à l'identifiant : total, déterministe,
 * et jamais dépendant de l'ordre de lecture.
 */

/** Ce qu'il faut savoir d'une fiche pour la proposer au choix. */
export interface ContactPickerLike extends ContactIdentityLike {
  readonly id: string;
}

/** Une entrée de la liste : ce qui s'affiche, et ce sur quoi on cherche. */
export interface ContactPickerOption {
  readonly id: string;
  readonly label: string;
  /** Prénom, nom, adresse et société, pliés : la frappe n'a plus qu'à comparer. */
  readonly search: string;
}

/** Le libellé d'une fiche qui ne porte aucune personne et rien pour la joindre. */
export const NO_LABEL = "Fiche sans nom";

/**
 * Le nom **rangé pour l'affichage**, jamais pour la base.
 *
 * Les noms viennent d'un tableur rempli à la main : « aguilera », « BAKHKHAR »,
 * « marc andré lacarelle ». Une casse au hasard dans une liste alphabétique
 * coûte une hésitation par ligne, et les corriger en base serait rendre
 * l'export infidèle à sa source — la règle du jalon 10 sur les liens, appliquée
 * aux noms : **on répare au rendu, on ne réécrit pas la donnée.**
 *
 * La règle ne touche que ce dont on est sûr : un nom **entièrement** en
 * minuscules ou **entièrement** en majuscules ne porte aucune intention de
 * casse, il porte la façon dont quelqu'un a tapé sa ligne. Dès que les deux
 * casses cohabitent, c'est une orthographe — « de La Fontaine », « McDonald »,
 * « van der Berg » — et on n'y touche pas. Deviner les particules serait une
 * seconde règle, qui se tromperait sur « De Niro » comme sur « de Gaulle ».
 *
 * Chaque morceau séparé par une espace, un trait d'union ou une apostrophe est
 * capitalisé : « jean-luc » → « Jean-Luc », « o'brien » → « O'Brien ».
 *
 * **Elle s'applique champ par champ, pas au nom assemblé**, et c'est le cas
 * réel qui l'impose : un tableur rempli à la main écrit « Nadia BAKHKHAR » —
 * prénom en casse normale, nom de famille crié. Assemblés, les deux casses
 * cohabitent, et la règle du paragraphe précédent laisserait la ligne telle
 * quelle, c'est-à-dire exactement celle dont on se plaint. Jugée séparément,
 * chaque moitié dit ce qu'elle est.
 */
export function tidyName(raw: string): string {
  const value = raw.trim().replace(/\s+/g, " ");
  if (value === "") return "";

  // `toLowerCase`/`toUpperCase` plutôt qu'une classe `[a-z]` : « é » et « É »
  // sont des lettres, et une fiche sur dix en porte une.
  const hasLower = value !== value.toUpperCase();
  const hasUpper = value !== value.toLowerCase();
  if (hasLower && hasUpper) return value;

  return value.replace(/[^\s\-'’]+/g, (part) =>
    part.length === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase(),
  );
}

/**
 * Sous quel nom la fiche se propose au choix.
 *
 * L'ordre des replis **n'est pas celui de `contactTitle()`**, et c'est une
 * décision : `contactTitle()` nomme une fiche *pour la lire* et préfère la
 * marque, qui dit à qui l'on parle. Un sélecteur, lui, sert à **distinguer** :
 * cinq fiches anonymes de la même marque y porteraient cinq fois le même
 * libellé, et choisir deviendrait un tirage au sort. L'adresse passe donc
 * devant la marque, parce qu'elle est propre à la ligne.
 */
export function pickerLabel(contact: ContactIdentityLike): string {
  // `personName()` reste la seule fonction qui assemble un nom (jalon 50) : on
  // lui passe les deux champs rangés, on ne recompose pas à côté d'elle.
  const person = personName({
    ...contact,
    firstName: tidyName(contact.firstName),
    lastName: tidyName(contact.lastName),
  });
  if (person !== "") return person;

  const email = contact.email?.trim() ?? "";
  if (email !== "") return email;

  const brand = contact.company?.name.trim() ?? "";
  if (brand !== "") return brand;

  const instagram = contact.instagram?.trim() ?? "";
  if (instagram !== "") return instagram;

  return NO_LABEL;
}

/** La clé sur laquelle la frappe filtre : « gio » et « ami » trouvent Giovanni Amico. */
export function pickerSearch(contact: ContactIdentityLike): string {
  return searchText([
    contact.firstName,
    contact.lastName,
    contact.email,
    contact.company?.name,
    contact.instagram,
  ]);
}

/** `-1`, `0` ou `1` sur deux textes, en français, accents et casse absorbés. */
function compareText(a: string, b: string): number {
  const verdict = a.localeCompare(b, "fr", { sensitivity: "base" });
  return verdict < 0 ? -1 : verdict > 0 ? 1 : 0;
}

/**
 * Prénom, puis nom — et les fiches sans personne **en fin de liste**.
 *
 * Une fiche sans nom n'est ni avant « A » ni après « Z », elle n'est rien :
 * c'est la règle du jalon 30 sur les relances sans date, et celle de
 * `compareKeys()`. En tête, elles poussaient les vraies entrées hors de l'écran.
 */
export function compareContacts(a: ContactPickerLike, b: ContactPickerLike): number {
  const nameA = personName(a);
  const nameB = personName(b);
  if (nameA === "" || nameB === "") {
    if (nameA === nameB) return compareText(pickerLabel(a), pickerLabel(b)) || idOrder(a, b);
    return nameA === "" ? 1 : -1;
  }

  return (
    compareText(a.firstName.trim(), b.firstName.trim()) ||
    compareText(a.lastName.trim(), b.lastName.trim()) ||
    // Deux homonymes exacts : l'identifiant tranche, pour que l'ordre ne dépende
    // pas de celui dans lequel la base a rendu les lignes.
    idOrder(a, b)
  );
}

function idOrder(a: ContactPickerLike, b: ContactPickerLike): number {
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/**
 * La liste à donner à un sélecteur : **déjà triée, déjà libellée**.
 *
 * `note` ajoute une mention après le libellé — l'éditeur d'étape manuelle s'en
 * sert pour dire « — sans prénom », qui est ce qui rend un échantillon
 * intéressant à prévisualiser. Elle n'entre pas dans la clé de recherche : on
 * cherche une personne, pas une annotation.
 */
export function contactOptions<T extends ContactPickerLike>(
  contacts: readonly T[],
  note?: (contact: T) => string,
): ContactPickerOption[] {
  return [...contacts].sort(compareContacts).map((contact) => {
    const suffix = note?.(contact) ?? "";
    return {
      id: contact.id,
      label: `${pickerLabel(contact)}${suffix}`,
      search: pickerSearch(contact),
    };
  });
}
