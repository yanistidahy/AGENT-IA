import { describe, expect, it } from "vitest";
import {
  columnsWhere,
  derivedFilters,
  type DbColumn,
} from "../column-filters";
import {
  VOID,
  type ColumnFilter,
  type ColumnSpec,
  type FilterState,
} from "../../domain/column-filters";
import { matchesAll, type FacetColumn } from "../../domain/column-match";

/**
 * Les deux chemins d'un même filtre doivent retenir exactement les mêmes lignes.
 *
 * Un filtre de colonne est appliqué **deux fois** dans l'application : en SQL
 * pour les lignes affichées (`columnsWhere`), et en mémoire pour compter les
 * valeurs distinctes (`matchesAll`). C'est la duplication qui avait déjà produit
 * une divergence au jalon 7 — trois tableaux recalculaient un seuil chacun de
 * leur côté, et le même contact s'affichait bleu dans une colonne et rouge dans
 * la suivante.
 *
 * Ce test exécute les deux sur le **même** jeu de données et compare les
 * identifiants retenus. La clause Prisma n'est pas envoyée à une base : elle est
 * interprétée ici par un évaluateur minuscule (`evaluate`), dont le seul rôle est
 * de dire ce que PostgreSQL ferait de cette clause. L'évaluateur ne connaît que
 * les formes que `columnsWhere` produit — s'il en rencontre une autre, il jette,
 * plutôt que de « passer » en silence et de rendre le test complaisant.
 */

interface Row {
  readonly id: string;
  readonly lifecycle: string;
  readonly owner: string;
  readonly amount: number;
  readonly nextReminder: Date | null;
  readonly company: { readonly name: string } | null;
  /** Colonne filtrée sur sa **présence** et non sur sa valeur (jalon 49). */
  readonly instagram: string;
}

/** L'étiquette de la facette de présence, comme dans `contact-columns.ts`. */
const PRESENT = "Compte connu";

const NOW = new Date("2026-08-12T09:00:00Z");

const ROWS: readonly Row[] = [
  { id: "1", lifecycle: "Lead", owner: "Yanis", amount: 1000, nextReminder: new Date("2026-08-01"), company: { name: "ACME" }, instagram: "@acme" },
  { id: "2", lifecycle: "Prospect", owner: "Sacha", amount: 5000, nextReminder: new Date("2026-08-12"), company: { name: "Zénith" }, instagram: "" },
  { id: "3", lifecycle: "Lead", owner: "", amount: 0, nextReminder: null, company: null, instagram: "zenith_labs" },
  { id: "4", lifecycle: "Perdu", owner: "Yanis", amount: 12000, nextReminder: new Date("2026-09-30"), company: { name: "ACME" }, instagram: "" },
  { id: "5", lifecycle: "Client", owner: "Sacha", amount: 300, nextReminder: new Date("2026-08-14"), company: { name: "" }, instagram: "" },
];

const SPECS: readonly ColumnSpec[] = [
  { key: "lifecycle", label: "Cycle de vie", kind: "text" },
  { key: "owner", label: "Propriétaire", kind: "text" },
  { key: "company", label: "Société", kind: "text" },
  { key: "amount", label: "Montant", kind: "number" },
  { key: "nextReminder", label: "Prochaine relance", kind: "date" },
  { key: "instagram", label: "Instagram", kind: "text" },
];

const DB: readonly DbColumn[] = [
  { key: "lifecycle", source: { kind: "scalar", field: "lifecycle" } },
  { key: "owner", source: { kind: "scalar", field: "owner" } },
  { key: "company", source: { kind: "relation", path: "company", field: "name" } },
  { key: "amount", source: { kind: "scalar", field: "amount" } },
  { key: "nextReminder", source: { kind: "scalar", field: "nextReminder" } },
  { key: "instagram", source: { kind: "presence", field: "instagram", label: PRESENT } },
];

const FACETS: readonly FacetColumn<Row>[] = [
  { key: "lifecycle", label: "Cycle de vie", value: (row) => row.lifecycle },
  { key: "owner", label: "Propriétaire", value: (row) => row.owner },
  { key: "company", label: "Société", value: (row) => row.company?.name ?? null },
  { key: "amount", label: "Montant", value: (row) => row.amount },
  { key: "nextReminder", label: "Prochaine relance", value: (row) => row.nextReminder },
  { key: "instagram", label: "Instagram", value: (row) => (row.instagram === "" ? "" : PRESENT) },
];

/** Valeur d'un champ, en suivant éventuellement une relation. */
function read(row: Row, key: string): unknown {
  if (key === "company") return row.company === null ? null : row.company.name;
  return (row as unknown as Record<string, unknown>)[key];
}

/**
 * Interprète une clause telle que `columnsWhere` la produit.
 *
 * Volontairement strict : toute forme inconnue lève. Un évaluateur permissif
 * renverrait `true` par défaut et le test cesserait de démontrer quoi que ce
 * soit le jour où la traduction Prisma changerait de forme.
 */
function evaluate(where: Record<string, unknown>, row: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") {
      if (!Array.isArray(value)) throw new Error("AND attendu comme tableau");
      return value.every((clause) => evaluate(clause as Record<string, unknown>, row));
    }
    if (key === "OR") {
      if (!Array.isArray(value)) throw new Error("OR attendu comme tableau");
      return value.some((clause) => evaluate(clause as Record<string, unknown>, row));
    }

    // Relation : { company: { name: <condition> } }
    if (key === "company") {
      const nested = value as Record<string, unknown>;
      const condition = nested.name;
      if (condition === undefined) throw new Error("relation sans champ");
      return test(condition as Record<string, unknown>, read(row, "company"));
    }

    return test(value as Record<string, unknown>, read(row, key));
  });
}

function test(condition: unknown, value: unknown): boolean {
  // Prisma accepte la forme abrégée `{ champ: "valeur" }` pour l'égalité. Elle
  // arrivait ici comme une « condition » sans opérateur : `Object.entries("")`
  // est vide, `.every` renvoie donc **vrai pour toutes les lignes**, et
  // l'évaluateur soi-disant strict validait en silence une clause qui filtre.
  // C'est exactement le faux positif que ce test existe pour interdire.
  if (typeof condition !== "object" || condition === null) {
    if (typeof condition !== "string" && condition !== null) {
      throw new Error(`condition non interprétée : ${String(condition)}`);
    }
    return value === condition;
  }

  const entries = Object.entries(condition as Record<string, unknown>);
  if (entries.length === 0) throw new Error("condition vide");

  return entries.every(([operator, operand]) => {
    switch (operator) {
      case "in": {
        if (!Array.isArray(operand)) throw new Error("in attendu comme tableau");
        // `{ in: ["", null] }` : PostgreSQL ne fait pas correspondre NULL par
        // `IN`, mais Prisma traduit `null` en `IS NULL`. On reproduit ce
        // comportement, sans quoi le test validerait une requête qui échoue.
        return operand.some((candidate) =>
          candidate === null ? value === null : value === candidate,
        );
      }
      case "equals":
        return value === operand;
      case "not":
        return operand === null ? value !== null : value !== operand;
      case "gte":
        return compare(value, operand) >= 0;
      case "lte":
        return compare(value, operand) <= 0;
      case "lt":
        return compare(value, operand) < 0;
      case "gt":
        return compare(value, operand) > 0;
      default:
        throw new Error(`opérateur non interprété : ${operator}`);
    }
  });
}

function compare(left: unknown, right: unknown): number {
  if (left === null || left === undefined) return Number.NaN;
  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime();
  }
  if (typeof left === "number" && typeof right === "number") return left - right;
  throw new Error("comparaison de types inattendus");
}

function bySql(state: FilterState): string[] {
  const where = columnsWhere(state, DB, NOW);
  return ROWS.filter((row) => evaluate(where, row)).map((row) => row.id);
}

function byMemory(state: FilterState): string[] {
  return ROWS.filter((row) => matchesAll(row, FACETS, state, NOW)).map((row) => row.id);
}

/** Les cas qui couvrent chaque forme que `columnsWhere` sait produire. */
const CASES: ReadonlyArray<[string, FilterState]> = [
  ["aucun filtre", {}],
  ["une valeur", { lifecycle: { kind: "text", values: ["Lead"] } }],
  ["plusieurs valeurs", { lifecycle: { kind: "text", values: ["Lead", "Perdu"] } }],
  ["valeur absente du jeu", { lifecycle: { kind: "text", values: ["Inexistant"] } }],
  ["(vide) seul", { owner: { kind: "text", values: [VOID] } }],
  ["(vide) mêlé à une valeur", { owner: { kind: "text", values: [VOID, "Yanis"] } }],
  // Colonne de **présence** (jalon 49) : le menu n'y propose que deux entrées,
  // et les deux cochées ensemble ne contraignent rien — comme aucune cochée.
  ["présence : compte connu", { instagram: { kind: "text", values: [PRESENT] } }],
  ["présence : (vide)", { instagram: { kind: "text", values: [VOID] } }],
  ["présence : les deux états, donc aucune contrainte", {
    instagram: { kind: "text", values: [PRESENT, VOID] },
  }],
  ["présence croisée avec une autre colonne", {
    instagram: { kind: "text", values: [PRESENT] },
    lifecycle: { kind: "text", values: ["Lead"] },
  }],
  ["relation", { company: { kind: "text", values: ["ACME"] } }],
  ["relation vide — société absente ou sans nom", { company: { kind: "text", values: [VOID] } }],
  ["deux colonnes en ET", {
    lifecycle: { kind: "text", values: ["Lead"] },
    owner: { kind: "text", values: ["Yanis"] },
  }],
  ["nombre, plage fermée", { amount: { kind: "number", min: 1000, max: 5000 } }],
  ["nombre, borne basse seule", { amount: { kind: "number", min: 1000, max: null } }],
  ["nombre, borne haute seule", { amount: { kind: "number", min: null, max: 300 } }],
  ["date, en retard", { nextReminder: { kind: "date", preset: "late", from: null, to: null } }],
  ["date, aujourd'hui", { nextReminder: { kind: "date", preset: "today", from: null, to: null } }],
  ["date, cette semaine", { nextReminder: { kind: "date", preset: "week", from: null, to: null } }],
  ["date, ce mois", { nextReminder: { kind: "date", preset: "month", from: null, to: null } }],
  ["date, vide", { nextReminder: { kind: "date", preset: "empty", from: null, to: null } }],
  ["date, renseignée", { nextReminder: { kind: "date", preset: "any", from: null, to: null } }],
  ["date, intervalle explicite", {
    nextReminder: { kind: "date", preset: null, from: "2026-08-01", to: "2026-08-12" },
  }],
  ["date et nombre combinés", {
    nextReminder: { kind: "date", preset: "any", from: null, to: null },
    amount: { kind: "number", min: 1000, max: null },
  }],
];

describe("filtres de colonne — SQL et mémoire retiennent les mêmes lignes", () => {
  for (const [name, state] of CASES) {
    it(name, () => {
      expect(bySql(state)).toEqual(byMemory(state));
    });
  }

  /**
   * Garde-fou du garde-fou : si tous les cas retenaient tout, l'égalité serait
   * vraie sans rien démontrer. Au moins un cas doit filtrer réellement, et au
   * moins un doit ne rien retenir.
   */
  it("les cas couvrent bien du filtrage réel", () => {
    const sizes = CASES.map(([, state]) => byMemory(state).length);
    expect(Math.max(...sizes)).toBe(ROWS.length);
    expect(Math.min(...sizes)).toBe(0);
    expect(new Set(sizes).size).toBeGreaterThan(2);
  });

  /** Les colonnes dérivées sont hors SQL : elles ne doivent pas s'y glisser. */
  it("une colonne dérivée n'entre pas dans la clause SQL", () => {
    const derivedColumns: readonly DbColumn[] = [
      { key: "amount", source: { kind: "scalar", field: "amount" }, derived: true },
    ];
    const state: FilterState = { amount: { kind: "number", min: 1000, max: null } };

    expect(columnsWhere(state, derivedColumns, NOW)).toEqual({});
    expect(Object.keys(derivedFilters(state, derivedColumns))).toEqual(["amount"]);
  });

  /**
   * L'évaluateur doit refuser ce qu'il ne connaît pas. Sans cette vérification,
   * une traduction Prisma qui changerait de forme passerait inaperçue et le test
   * deviendrait complaisant.
   */
  it("l'évaluateur rejette une clause qu'il ne sait pas interpréter", () => {
    expect(() => evaluate({ owner: { contains: "yan" } }, ROWS[0] as Row)).toThrow(
      /opérateur non interprété/,
    );
  });
});

/** Rappel de typage : un filtre inconnu du jeu de colonnes est simplement ignoré. */
const _unused: ColumnFilter = { kind: "text", values: [] };
void _unused;
void SPECS;
