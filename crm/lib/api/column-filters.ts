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
  | { readonly kind: "relation"; readonly path: string; readonly field: string }
  /**
   * **Une colonne dont on filtre la présence, pas la valeur.**
   *
   * Le compte Instagram est un pseudo : proposer ses valeurs distinctes
   * listerait cent quarante pseudos, dont aucun ne sert de filtre. Ce qu'on
   * veut demander est binaire — « le compte est-il noté ? » — et c'est ce que
   * la facette rend : `label` d'un côté, « (vide) » de l'autre.
   *
   * La traduction SQL ne peut donc pas passer par le `in` des colonnes texte,
   * puisque la base stocke des pseudos et non l'étiquette : elle devient
   * `{ not: "" }` ou `{ in: ["", null] }`.
   */
  | {
      readonly kind: "presence";
      readonly field: string;
      readonly label: string;
      /** La colonne accepte-t-elle NULL ? Sans quoi le vide est la chaîne vide. */
      readonly nullable?: boolean;
    };

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
  if (column.source.kind === "presence") return { [column.source.field]: condition };
  return { [column.source.path]: { [column.source.field]: condition } };
}

/**
 * La clause d'une colonne de présence.
 *
 * `null` quand les deux états sont cochés : demander « rempli ou vide » ne
 * restreint rien, et poser la contrainte quand même produirait un `OR` inutile
 * qui ne changerait que le plan de requête.
 */
function presenceCondition(
  column: DbColumn,
  values: readonly string[],
): Where | null {
  if (column.source.kind !== "presence") return null;
  const wantsFilled = values.includes(column.source.label);
  const wantsVoid = values.includes(VOID);
  if (wantsFilled === wantsVoid) return null;
  if (wantsFilled) return { [column.source.field]: { not: "" } };

  // `{ in: ["", null] }` — l'idiome des autres colonnes — est **refusé par
  // Prisma sur une colonne non nulle** : « Expected ListStringFieldRefInput,
  // provided (String, Null) ». La page tombait en erreur là où l'API répondait,
  // parce que seule la page passe par les facettes. D'où le drapeau, porté par
  // la déclaration de colonne plutôt que deviné ici.
  return column.source.nullable === true
    ? { [column.source.field]: { in: ["", null] } }
    : { [column.source.field]: "" };
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

    if (filter.kind === "text" && column.source.kind === "presence") {
      const condition = presenceCondition(column, filter.values);
      if (condition !== null) and.push(condition);
      continue;
    }

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
