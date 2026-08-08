import { dateBounds, VOID, type ColumnFilter, type FilterState } from "./column-filters";

/**
 * Application d'un filtre de colonne à une valeur, en mémoire.
 *
 * Cette fonction sert à **compter les valeurs distinctes** (les facettes du
 * menu déroulant). Les lignes affichées, elles, sont filtrées en SQL — c'est ce
 * qui permet de ne jamais charger la table entière dans le navigateur.
 *
 * Deux chemins pour une même règle, c'est exactement le genre de duplication qui
 * finit par diverger. Le test `column-filters-parity` exécute les deux sur le
 * même jeu de données et échoue si les identifiants retenus diffèrent.
 */

/** Valeur brute d'une cellule filtrable. */
export type CellValue = string | number | Date | null;

/** Représentation d'une cellule dans la liste des valeurs distinctes. */
export function cellKey(value: CellValue): string {
  if (value === null) return VOID;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return String(value);
  return value.trim() === "" ? VOID : value;
}

export function matchesFilter(
  filter: ColumnFilter,
  value: CellValue,
  now: Date,
): boolean {
  if (filter.kind === "text") {
    if (filter.values.length === 0) return true;
    return filter.values.includes(cellKey(value));
  }

  if (filter.kind === "date") {
    const date = value instanceof Date ? value : null;

    if (filter.preset === "empty") return date === null;
    if (filter.preset === "any") return date !== null;

    // Une cellule vide ne tombe dans aucun intervalle : « en retard » ne doit
    // pas ramasser les fiches sans échéance, qui ne sont en retard de rien.
    if (date === null) return false;

    const { from, to } = dateBounds(filter, now);
    if (from !== null && date < from) return false;
    if (to !== null && date >= to) return false;
    return true;
  }

  const amount = typeof value === "number" ? value : null;
  if (amount === null) return false;
  if (filter.min !== null && amount < filter.min) return false;
  if (filter.max !== null && amount > filter.max) return false;
  return true;
}

/** Lecture d'une colonne sur une ligne. */
export interface FacetColumn<T> {
  readonly key: string;
  readonly label: string;
  readonly value: (row: T) => CellValue;
}

/**
 * Les filtres des différentes colonnes se combinent en **ET**, comme dans un
 * tableur : chaque colonne restreint ce que les autres ont laissé passer.
 */
export function matchesAll<T>(
  row: T,
  columns: readonly FacetColumn<T>[],
  state: FilterState,
  now: Date,
  except?: string,
): boolean {
  for (const column of columns) {
    if (column.key === except) continue;
    const filter = state[column.key];
    if (filter === undefined) continue;
    if (!matchesFilter(filter, column.value(row), now)) return false;
  }
  return true;
}

export interface FacetValue {
  readonly value: string;
  readonly count: number;
}

/**
 * Valeurs distinctes proposées par le menu d'une colonne, avec leur nombre de
 * lignes.
 *
 * Comptées sur les lignes retenues par **les autres** colonnes, jamais par
 * elle-même : une colonne qui compterait son propre filtre n'afficherait que
 * les valeurs déjà cochées, et il deviendrait impossible d'en ajouter une.
 * C'est le comportement d'Excel, et la raison du paramètre `except`.
 */
export function facetsFor<T>(
  rows: readonly T[],
  columns: readonly FacetColumn<T>[],
  state: FilterState,
  now: Date,
): Readonly<Record<string, readonly FacetValue[]>> {
  const result: Record<string, FacetValue[]> = {};

  for (const column of columns) {
    const counts = new Map<string, number>();

    for (const row of rows) {
      if (!matchesAll(row, columns, state, now, column.key)) continue;
      const key = cellKey(column.value(row));
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    result[column.key] = [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      // « (vide) » en dernier : c'est une absence, pas une valeur qu'on cherche
      // en premier dans une liste alphabétique.
      .sort((a, b) => {
        if (a.value === VOID) return 1;
        if (b.value === VOID) return -1;
        return a.value.localeCompare(b.value, "fr");
      });
  }

  return result;
}
