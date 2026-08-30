/**
 * Qui est cette fiche, et comment on la nomme.
 *
 * ## Une fiche peut n'avoir pas encore de personne
 *
 * La prospection Instagram trouve **la marque avant le fondateur** : on a le
 * compte, le site, l'adresse générique, et aucun nom. C'est un vrai prospect,
 * simplement anonyme pour l'instant — il doit vivre normalement (cycle de vie,
 * DM, emails, séquences, relances) sans qu'on invente un nom pour lui faire
 * passer un formulaire.
 *
 * ## Le manque est **déduit**, jamais stocké
 *
 * Pas de colonne `unidentified`, pas de drapeau : une fiche est « à identifier »
 * si et seulement si elle ne porte aucun nom de personne. Trois conséquences,
 * et c'est pour elles que ce module existe :
 *
 * 1. **le marqueur disparaît tout seul** quand on saisit enfin le prénom — il
 *    n'y a rien à mettre à jour, donc rien qui puisse rester en retard ;
 * 2. **aucune migration** : `firstName` et `lastName` acceptent déjà la chaîne
 *    vide. Une colonne de plus, c'est une colonne à tenir cohérente avec les
 *    deux qu'elle décrit, et un jour elle les contredirait ;
 * 3. **rien à reprendre sur l'existant** : une fiche importée sans nom est
 *    « à identifier » depuis toujours, sans qu'on ait eu à la retoucher.
 *
 * ## Une seule fonction pour nommer
 *
 * `contactTitle()` est la **seule** façon de nommer une fiche à l'écran ou dans
 * un message. `contact-name-source.test.ts` interdit d'interpoler
 * `${firstName} ${lastName}` ailleurs, parce que c'est exactement ce qui
 * produit le « — » orphelin : chaque endroit qui recompose le nom lui-même est
 * un endroit qui oubliera le cas vide.
 */

/** Ce qu'il faut savoir d'une fiche pour la nommer. */
export interface ContactIdentityLike {
  readonly firstName: string;
  readonly lastName: string;
  readonly company?: { readonly name: string } | null;
  readonly email?: string;
  readonly instagram?: string;
}

/** Le marqueur affiché à côté du nom d'une fiche sans personne nommée. */
export const UNIDENTIFIED_MARKER = "Contact à identifier";

/** Le nom de la personne, ou la chaîne vide s'il n'y en a pas. */
export function personName(contact: ContactIdentityLike): string {
  return `${contact.firstName} ${contact.lastName}`.trim().replace(/\s+/g, " ");
}

/**
 * La fiche porte-t-elle une personne nommée ?
 *
 * Un seul des deux champs suffit : « Caroline » sans nom de famille est une
 * personne, et refuser de la considérer comme identifiée ferait entrer dans la
 * file de recherche des fiches où il n'y a plus rien à chercher.
 */
export function isUnidentified(contact: ContactIdentityLike): boolean {
  return personName(contact) === "";
}

/**
 * Le nom sous lequel la fiche apparaît partout — listes, fiche, file, emails.
 *
 * L'ordre est celui de ce qui identifie le mieux : la personne, à défaut la
 * marque, à défaut ce par quoi on la joint. Le dernier repli est une phrase et
 * non un tiret : une ligne vide dans une liste ne se clique pas, on croit à un
 * défaut d'affichage.
 */
export function contactTitle(contact: ContactIdentityLike): string {
  const person = personName(contact);
  if (person !== "") return person;

  const brand = contact.company?.name.trim() ?? "";
  if (brand !== "") return brand;

  const email = contact.email?.trim() ?? "";
  if (email !== "") return email;

  const instagram = contact.instagram?.trim() ?? "";
  if (instagram !== "") return instagram;

  return "Fiche sans nom";
}

/**
 * L'appel d'un message, décidé sur la donnée et non par le modèle.
 *
 * « Bonjour — » est la faute que ce module existe pour empêcher : elle se voit
 * du premier coup d'œil chez le destinataire, et elle dit « ceci est un
 * publipostage » plus sûrement qu'aucune maladresse de style.
 *
 * Sans prénom, l'appel est **nu** — « Bonjour, » — plutôt qu'adressé à la
 * marque : « Bonjour Maison Vertu, » s'écrit à une entreprise, pas à la
 * personne qui lira. Nu, il fonctionne dans les deux cas.
 */
export function greeting(contact: ContactIdentityLike): string {
  const first = contact.firstName.trim();
  return first === "" ? "Bonjour," : `Bonjour ${first},`;
}

/**
 * La consigne donnée au modèle, exclusive elle aussi.
 *
 * Même règle qu'au jalon 48 pour le DM : une absence de ligne se lit comme une
 * absence d'information, une ligne qui dit « non » se lit comme une règle. Sans
 * cela le modèle comble le vide, et il le comble par un tiret ou par un prénom
 * qu'il déduit de l'adresse.
 */
export function greetingRule(contact: ContactIdentityLike): string {
  const first = contact.firstName.trim();
  if (first !== "") {
    return `Ouvre par « ${greeting(contact)} » — le prénom du destinataire est connu.`;
  }

  const brand = contact.company?.name.trim() ?? "";
  const known =
    brand === ""
      ? "On ne connaît ni son prénom ni sa marque."
      : `On ne connaît pas son prénom ; la marque est « ${brand} ».`;

  return [
    `Ouvre par « Bonjour, » exactement — sans nom, sans tiret, sans « Bonjour l'équipe ».`,
    `${known} N'invente aucun prénom, n'en déduis aucun de l'adresse électronique,`,
    `et n'écris jamais un appel qui laisse un blanc ou un tiret là où un nom manquerait.`,
  ].join(" ");
}

/**
 * Répare l'appel du brouillon, quoi qu'ait rendu le modèle.
 *
 * Le prompt le demande déjà (`greetingRule`). Mais une consigne de prompt est
 * une **intention** : elle tient presque toujours, et « presque » n'est pas
 * assez ici — c'est la première ligne que le destinataire lit, et « Bonjour — »
 * dit « publipostage » avant même le premier argument. Même raisonnement que
 * `enforceSignature()` au jalon 33 : la règle est demandée **et** imposée.
 *
 * La réparation est **étroite par construction** : elle ne touche que la
 * première ligne, et seulement si celle-ci est un appel qui pend — un tiret, un
 * blanc, un gabarit non substitué. Un appel correct, ou une première ligne qui
 * n'est pas un appel, ressort intacte : réécrire plus large mutilerait un texte
 * que quelqu'un vient peut-être de relire.
 */
export function repairGreeting(body: string, contact: ContactIdentityLike): string {
  const lines = body.split("\n");
  const first = lines[0];
  if (first === undefined) return body;

  const trimmed = first.trim();
  if (!/^bonjour\b/i.test(trimmed)) return body;

  const rest = trimmed.replace(/^bonjour/i, "").trim();

  // **Sans prénom connu, l'appel ne peut nommer personne** — et c'est la règle
  // la plus utile des deux, parce que le vrai danger n'est pas le tiret.
  //
  // Trouvé à la vérification : sur une fiche « Maison Vertu » sans personne, le
  // brouillon s'ouvrait sur « Bonjour Maison, ». Le prénom était **fabriqué à
  // partir de la marque** — une faute qui ne se voit pas à la relecture (elle
  // ressemble à un prénom) et qui se lit chez le destinataire comme un
  // publipostage mal fusionné. Le prompt l'interdit déjà ; ici on le sait de
  // source sûre : la fiche ne porte aucun prénom, donc tout nom dans l'appel
  // est inventé, quelle que soit sa vraisemblance.
  if (contact.firstName.trim() === "") {
    // Comparé à la ligne entière, pas au reste : « Bonjour , » porte une espace
    // parasite qui se voit à la réception.
    return trimmed === greeting(contact) ? body : withFirstLine(lines, greeting(contact));
  }

  // Avec un prénom connu, on ne réécrit que ce qui **pend** : rien, une
  // ponctuation seule, un tiret, ou un gabarit resté en place. Tout le reste
  // est un vrai nom, qu'on ne touche pas — réécrire plus large mutilerait un
  // texte que quelqu'un vient peut-être de relire.
  const dangling =
    rest === "" ||
    /^[,;:.!]*$/.test(rest) ||
    /^[-–—]+[,;:.!]*$/.test(rest) ||
    /^[,\s]*[-–—][\s,;:.!]*$/.test(rest) ||
    /\{\{|\[\[|<[a-z_]+>|\bprénom\b|\bfirstname\b/i.test(rest);

  return dangling ? withFirstLine(lines, greeting(contact)) : body;
}

function withFirstLine(lines: readonly string[], first: string): string {
  return [first, ...lines.slice(1)].join("\n");
}
