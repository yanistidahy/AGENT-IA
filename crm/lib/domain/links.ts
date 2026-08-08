/**
 * Normalisation des adresses externes **à l'affichage**.
 *
 * Les valeurs importées d'un tableur sont écrites comme on les lit :
 * `linkedin.com/in/pascal-charpentier`, `zenithlabs.fr`. Sans schéma, un
 * navigateur interprète la valeur comme un chemin *relatif* — le lien menait
 * donc à `https://mon-crm/linkedin.com/in/…`, une 404.
 *
 * La correction se fait au rendu, jamais en base. Réécrire la donnée stockée
 * rendrait l'export infidèle à la source : ce qui est ressorti du CRM ne serait
 * plus ce qui y est entré, et un aller-retour tableur → CRM → tableur
 * modifierait le fichier de l'utilisateur sans qu'il l'ait demandé.
 */

/** Schémas acceptés tels quels. Tout le reste est préfixé `https://`. */
const ABSOLUTE = /^https?:\/\//i;

/**
 * Repère ce qui n'est pas une adresse web du tout : `mailto:`, `tel:`,
 * `javascript:` — ce dernier étant le seul dangereux, puisqu'un `href` qui le
 * porte exécute du code au clic. On ne devine pas : ces valeurs ne produisent
 * pas de lien.
 */
const OTHER_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Adresse cliquable, ou `null` si la valeur n'en produit pas.
 *
 * `null` plutôt qu'une chaîne vide : l'appelant doit décider quoi afficher
 * quand il n'y a pas de lien, et un `href=""` recharge la page courante.
 */
export function externalUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed === "") return null;

  if (ABSOLUTE.test(trimmed)) return trimmed;
  // Un schéma autre que http(s) — `javascript:` compris — n'est jamais préfixé
  // ni rendu cliquable.
  if (OTHER_SCHEME.test(trimmed)) return null;

  // Un chemin seul (`/quelque-chose`) n'est pas une adresse externe.
  if (trimmed.startsWith("/")) return null;

  return `https://${trimmed}`;
}

/**
 * Texte affiché pour un lien : la valeur telle qu'elle est stockée, sans le
 * `https://` qu'on vient d'ajouter. L'utilisateur reconnaît ce qu'il a importé.
 */
export function externalLabel(value: string): string {
  return value.trim().replace(ABSOLUTE, "").replace(/\/$/, "");
}
