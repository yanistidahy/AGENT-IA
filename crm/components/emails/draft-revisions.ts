/**
 * L'historique des versions d'un brouillon — pur, donc testable.
 *
 * « Demander une reprise et perdre une bonne phrase » est la frustration à
 * éviter : on accepte une révision parce qu'elle améliore trois lignes, et on
 * découvre après coup qu'elle en a abîmé une quatrième. Sans pile, il ne reste
 * qu'à réécrire de mémoire.
 *
 * La pile est **bornée** : au-delà, elle grossirait indéfiniment pendant une
 * séance de réécriture, pour des versions que personne ne remonte. Cinq est
 * au-dessus des trois demandés — assez pour revenir sur une série de reprises,
 * assez peu pour que le bouton reste lisible.
 */
export const MAX_VERSIONS = 5;

export interface DraftVersion {
  readonly subject: string;
  readonly body: string;
}

/**
 * Empile une version, en écartant les répétitions.
 *
 * Une version identique à la précédente n'apprend rien et consommerait un cran
 * de la pile : demander deux fois la même chose ne doit pas faire perdre une
 * version utile.
 */
export function pushVersion(
  history: readonly DraftVersion[],
  version: DraftVersion,
): DraftVersion[] {
  const last = history[history.length - 1];
  if (last !== undefined && last.subject === version.subject && last.body === version.body) {
    return [...history];
  }
  return [...history, version].slice(-MAX_VERSIONS);
}

/** Dépile la dernière version. Rend `null` s'il n'y a rien à restaurer. */
export function popVersion(
  history: readonly DraftVersion[],
): { readonly restored: DraftVersion; readonly rest: DraftVersion[] } | null {
  const restored = history[history.length - 1];
  if (restored === undefined) return null;
  return { restored, rest: history.slice(0, -1) };
}

/** Le texte courant diffère-t-il de la dernière version empilée ? */
export function isEdited(
  history: readonly DraftVersion[],
  current: DraftVersion,
): boolean {
  const last = history[history.length - 1];
  if (last === undefined) return false;
  return last.subject !== current.subject || last.body !== current.body;
}
