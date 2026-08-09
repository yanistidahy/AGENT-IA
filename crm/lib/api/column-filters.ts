import {
  dateBounds,
  VOID,
  type ColumnFilter,
  type FilterState,
} from "../domain/column-filters";

/**
 * Traduction des filtres de colonne en clauses Prisma.
 *
 * Les lignes affichées sont filtrées **en base**, jamais dans le navigateur :
 * c'est la condition pour que la vue tienne à mille lignes comme à cent. Le
 * comptage des valeurs distinctes, lui, se fait en mémoire sur une projection
 * légère (voir `lib/domain/column-match.ts`) — la table n'est donc jamais
 * transportée entière jusqu'au client.
 *
 * Les deux chemins appliquent la même règle et pourraient diverger ; le test
 * `column-filters-parity` les exécute sur le même jeu et compare les
 * identifiants retenus.
 */

/** Clause Prisma générique : un objet de conditions sur un champ. */
type Where = Record<string, unknown>;

/**
 * Description d'une colonne côté base.
 *
 * `field` est le chemin scalaire quand il est direct (`"owner"`), `relation`
 * quand la valeur vit dans une table liée (`{ path: "company", field: "name" }`).
 */
export type ColumnSource =
  | { readonly kind: "scalar"; readonly field: string }
  | { readonly kind: "relation"; readonly path: string; readonly field: string };

export interface DbColumn {
  readonly key: string;
  readonly source: ColumnSource;
  /**
   * `true` quand la colonne ne peut pas être filtrée en SQL parce qu'elle est
   * dérivée (statut de relance, ancienneté). Ces colonnes sont écartées de la
   * clause et appliquées après lecture, comme le statut de relance l'était déjà.
   */
  readonly derived?: boolean;
}

function scalarCondition(
  filter: ColumnFilter,
  now: Date,
): Where | null {
  if (filter.kind === "text") {
    if (filter.values.length === 0) return null;

    const wantsVoid = filter.values.includes(VOID);
    const concrete = filter.values.filter((value) => value !== VOID);

    // « (vide) » recouvre la chaîne vide *et* le nul : selon les colonnes, une
    // absence est stockée de l'une ou l'autre façon, et l'utilisateur ne
    // distingue pas les deux.
    const branches: Where[] = [];
    if (concrete.length > 0) branches.push({ in: concrete });
    if (wantsVoid) branches.push({ in: ["", null] });

    if (branches.length === 1) return branches[0] ?? null;
    // Deux branches sur un même champ : Prisma n'a pas de « ou » scalaire, on
    // le remonte d'un cran via `OR` (traité par l'appelant).
    return null;
  }

  if (filter.kind === "date") {
    if (filter.preset === "empty") return { equals: null };
    if (filter.preset === "any") return { not: null };

    const { from, to } = dateBounds(filter, now);
    const range: Where = { not: null };
    if (from !== null) range.gte = from;
    if (to !== null) range.lt = to;
    return range;
  }

  const range: Where = {};
  if (filter.min !== null) range.gte = filter.min;
  if (filter.max !== null) range.lte = filter.max;
  return Object.keys(range).length === 0 ? null : range;
}

/**
 * Cas particulier : une sélection mêlant des valeurs concrètes et « (vide) ».
 * Elle demande un `OR` au niveau de l'enregistrement, pas une condition de champ.
 */
function mixedTextBranches(
  column: DbColumn,
  values: readonly string[],
): Where[] | null {
  const wantsVoid = values.includes(VOID);
  const concrete = values.filter((value) => value !== VOID);
  if (!wantsVoid || concrete.length === 0) return null;

  return [
    fieldWhere(column, { in: concrete }),
    fieldWhere(column, { in: ["", null] }),
  ];
}

function fieldWhere(column: DbColumn, condition: Where): Where {
  if (column.source.kind === "scalar") return { [column.source.field]: condition };
  return { [column.source.path]: { [column.source.field]: condition } };
}

/**
 * Construit la clause Prisma de l'ensemble des filtres de colonne.
 *
 * Les colonnes se combinent en **ET** : chacune restreint ce que les autres ont
 * laissé passer. C'est le comportement d'un tableur, et le seul qui rende
 * prévisible l'empilement de plusieurs filtres.
 */
export function columnsWhere(
  state: FilterState,
  columns: readonly DbColumn[],
  now: Date,
): Where {
  const and: Where[] = [];

  for (const column of columns) {
    if (column.derived === true) continue;

    const filter = state[column.key];
    if (filter === undefined) continue;

    if (filter.kind === "text") {
      const mixed = mixedTextBranches(column, filter.values);
      if (mixed !== null) {
        and.push({ OR: mixed });
        continue;
      }
    }

    const condition = scalarCondition(filter, now);
    if (condition === null) continue;
    and.push(fieldWhere(column, condition));
  }

  return and.length === 0 ? {} : { AND: and };
}

/** Les colonnes dérivées, à appliquer après lecture. */
export function derivedFilters(
  state: FilterState,
  columns: readonly DbColumn[],
): FilterState {
  const result: Record<string, ColumnFilter> = {};
  for (const column of columns) {
    if (column.derived !== true) continue;
    const filter = state[column.key];
    if (filter !== undefined) result[column.key] = filter;
  }
  return result;
}
