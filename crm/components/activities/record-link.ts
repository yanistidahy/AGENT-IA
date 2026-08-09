/**
 * Rattachement d'une interaction ou d'une tâche à une fiche.
 *
 * Un seul des trois identifiants est renseigné. Le type le dit en le rendant
 * exclusif : impossible de construire un lien qui en nomme deux, ce que l'API
 * refuserait de toute façon.
 */
export type RecordLink =
  | { readonly contactId: string; readonly companyId?: never; readonly dealId?: never }
  | { readonly companyId: string; readonly contactId?: never; readonly dealId?: never }
  | { readonly dealId: string; readonly contactId?: never; readonly companyId?: never };

/** Paramètres de requête correspondants, pour lire la chronologie d'une fiche. */
export function linkQuery(link: RecordLink): string {
  if (link.contactId !== undefined) return `contactId=${encodeURIComponent(link.contactId)}`;
  if (link.companyId !== undefined) return `companyId=${encodeURIComponent(link.companyId)}`;
  return `dealId=${encodeURIComponent(link.dealId)}`;
}
