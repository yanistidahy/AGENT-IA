/**
 * Une affaire rattachée à quelqu'un appartient à la société de ce quelqu'un.
 *
 * ## Le trou
 *
 * `resolveCompanyLink()` ne connaît que ce que le formulaire lui envoie :
 * `companyId` ou `companyName`. Le formulaire d'affaire, lui, laisse choisir un
 * contact **et** une société séparément — remplir l'un sans l'autre est le
 * geste le plus naturel du monde, et l'affaire naît alors sans société alors
 * que la réponse est à un pas, sur la fiche du contact.
 *
 * La conséquence n'est pas cosmétique. Une affaire sans société sort des
 * totaux de `/societes` (pipeline ouvert, CA signé) et de la chronologie de la
 * fiche société : la maison cliente paraît plus petite qu'elle n'est, sans que
 * rien ne signale l'écart. Seule la carte du kanban le dit, en petit, par
 * « Sans société ».
 *
 * ## La règle, et ses deux bornes
 *
 * On hérite **seulement pour combler un vide**, et **seulement depuis le
 * contact principal de l'affaire**.
 *
 * - Une société déjà renseignée n'est jamais écrasée : elle peut différer
 *   volontairement de celle du contact — un intermédiaire, une filiale, un
 *   acheteur qui n'appartient pas à la maison qui signe. C'est le même
 *   raisonnement qu'au jalon 3, où gagner une affaire *propose* la promotion du
 *   contact en client sans la faire : l'acheteur n'est pas forcément le client.
 * - Sans contact, ou avec un contact sans société, il n'y a rien à hériter et
 *   la fonction rend `null` — elle ne devine pas depuis le nom de l'affaire.
 */
export interface CompanyInheritanceInput {
  /** Société portée par l'affaire, telle qu'elle est (ou serait) écrite. */
  readonly dealCompanyId: string | null | undefined;
  /** Société du contact principal de l'affaire. */
  readonly contactCompanyId: string | null | undefined;
}

/**
 * Rend la société à écrire, ou `null` s'il n'y a rien à combler.
 *
 * `null` veut dire « ne touche à rien » — jamais « efface » : le seul chemin
 * qui détache une société est un `companyId: null` explicite venu du
 * formulaire, et il passe par `resolveCompanyLink`, pas par ici.
 */
export function inheritedCompanyId(input: CompanyInheritanceInput): string | null {
  const own = input.dealCompanyId ?? null;
  if (own !== null && own !== "") return null;
  const fromContact = input.contactCompanyId ?? null;
  if (fromContact === null || fromContact === "") return null;
  return fromContact;
}
