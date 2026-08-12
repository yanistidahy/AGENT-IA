/**
 * Champs structurés échoués dans les Notes à l'import.
 *
 * L'import du jalon 3 a versé toute colonne non reconnue dans `Notes` — c'est
 * ce qui a préservé la donnée plutôt que de la perdre, mais ça l'a rendue
 * inutilisable : pas de lien, pas de filtre, illisible pour les outils du
 * conseil. `SITE :` est le premier cas traité (voir `lib/api/maintenance.ts`) ;
 * les autres motifs connus sont seulement **repérés**, pas extraits — voir
 * `describeOtherPatterns()`.
 */

const SITE_LINE = /^\s*site\s*:\s*(.+)$/i;

/**
 * Adresse ou domaine repérable dans une ligne. Le motif est volontairement
 * étroit : « 100% gourmand » ne doit pas ressembler à un domaine, et une URL
 * complète prime sur un simple nom de domaine trouvé plus loin dans la ligne.
 */
const URL_OR_DOMAIN =
  /https?:\/\/\S+|\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/i;

export interface WebsiteExtraction {
  /** Domaine ou URL extrait, tel qu'il apparaît dans la note. */
  readonly value: string;
  /** La ligne source complète, pour que la simulation montre sa preuve. */
  readonly line: string;
}

/**
 * Cherche une ligne `SITE :` (et ses variantes `SITE:`, `Site :`) dans les
 * notes, et tente d'en extraire un domaine ou une URL.
 *
 * Rend `undefined` si aucune ligne de ce type n'existe. Rend une extraction
 * avec `value: null` si la ligne existe mais ne contient rien qui ressemble à
 * un domaine — « SITE : Shopify » ne doit pas être deviné, il doit être
 * signalé comme non résolu.
 */
export function findSiteLine(
  notes: string,
): { readonly line: string; readonly value: string | null } | undefined {
  for (const rawLine of notes.split(/\r?\n/)) {
    const match = SITE_LINE.exec(rawLine.trim());
    if (match === null) continue;

    const rest = match[1] ?? "";
    const found = URL_OR_DOMAIN.exec(rest);
    return { line: rawLine.trim(), value: found === null ? null : found[0] };
  }
  return undefined;
}

/**
 * Extraction complète : `undefined` si aucune ligne `SITE :`, `null` si la
 * ligne existe sans domaine exploitable, sinon la valeur et sa preuve.
 */
export function extractWebsiteFromNotes(notes: string): WebsiteExtraction | null | undefined {
  const found = findSiteLine(notes);
  if (found === undefined) return undefined;
  if (found.value === null) return null;
  return { value: found.value, line: found.line };
}

/**
 * D'autres motifs structurés vus dans les mêmes Notes, comptés mais jamais
 * extraits ici — cette correction ne fait que `SITE :`. Sert à faire un
 * rapport à l'écran de ce qui reste récupérable.
 */
export interface OtherPatternCounts {
  readonly canal: number;
  readonly reponse: number;
  readonly numero: number;
}

const CANAL_LINE = /^\s*canal\s*:/im;
const REPONSE_LINE = /^\s*r[ée]ponse\s*\?\s*:/im;
const NUMERO_LINE = /^\s*n[°o]\s*:/im;

export function countOtherPatterns(notes: readonly string[]): OtherPatternCounts {
  let canal = 0;
  let reponse = 0;
  let numero = 0;
  for (const note of notes) {
    if (CANAL_LINE.test(note)) canal += 1;
    if (REPONSE_LINE.test(note)) reponse += 1;
    if (NUMERO_LINE.test(note)) numero += 1;
  }
  return { canal, reponse, numero };
}
