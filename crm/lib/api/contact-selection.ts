import "server-only";
import { parseContactsQuery } from "./contact-schemas";
import { CONTACT_FILTER_COLUMNS } from "./contact-columns";
import { parseFilters } from "../domain/column-filters";
import { listContacts } from "./contacts";
import { getPilotage } from "./reference";

/**
 * **Ce que « la sélection » désigne, résolu à un seul endroit.**
 *
 * Deux surfaces l'utilisent désormais — l'inscription à une campagne (jalon 54)
 * et l'ajout à une liste (jalon 77) — et la règle est délicate : les fiches
 * **cochées** l'emportent sur le filtre quand il y en a. Cocher huit fiches sous
 * un filtre Instagram puis cinq sous un filtre de rôle produit treize personnes
 * qu'**aucune requête unique ne décrit** ; le filtre n'est alors qu'un souvenir
 * de la façon dont on les a trouvées.
 *
 * L'écrire deux fois, c'était garantir que la seconde oublierait la primauté des
 * cases — et alors l'écran aurait montré treize fiches pour en traiter cinq.
 * C'est la leçon du jalon 55 sur l'entonnoir des campagnes, appliquée avant
 * qu'elle ne coûte quoi que ce soit.
 *
 * Le filtre est ré-évalué **avec les mêmes fonctions que /contacts**
 * (`parseContactsQuery` + `parseFilters` + `listContacts`) : pas une copie de la
 * logique, la logique. Ce que l'écran montrait est ce qui est traité.
 */
export async function resolveSelectionIds(
  selection: string,
  contactIds?: readonly string[],
): Promise<{ ok: true; ids: string[] } | { ok: false; message: string }> {
  if (contactIds !== undefined && contactIds.length > 0) {
    return { ok: true, ids: [...new Set(contactIds)] };
  }

  const params = new URLSearchParams(selection);
  const query = parseContactsQuery(params);
  if (!query.success) {
    return { ok: false, message: "La sélection enregistrée n'est plus un filtre valide." };
  }

  // Les filtres de colonne passent par des paramètres **répétés**
  // (`f.lifecycle=Lead&f.lifecycle=Prospect`) : les aplatir à leur première
  // valeur retiendrait moins de fiches que l'écran n'en montrait.
  const record: Record<string, string | string[] | undefined> = {};
  for (const key of new Set(params.keys())) {
    const all = params.getAll(key);
    record[key] = all.length > 1 ? all : all[0];
  }
  const filters = parseFilters(record, CONTACT_FILTER_COLUMNS);

  const contacts = await listContacts(query.data, await getPilotage(), new Date(), filters);
  return { ok: true, ids: contacts.map((contact) => contact.id) };
}
