import type { ColumnSpec } from "../domain/column-filters";
import type { FacetColumn } from "../domain/column-match";
import type { DbColumn } from "./column-filters";

/**
 * Colonnes filtrables de `/societes`.
 *
 * Même contrat que `contact-columns.ts` : une seule déclaration nourrit la
 * clause Prisma, le comptage des valeurs distinctes et l'en-tête du tableau.
 *
 * Les trois colonnes chiffrées sont marquées `derived` : elles viennent de
 * sommes sur les affaires liées, pas d'un champ de la table, et se filtrent
 * donc après lecture.
 */
export interface CompanyFacetRow {
  readonly id: string;
  readonly industry: string;
  readonly size: string;
  readonly loc: string;
  readonly contacts: number;
  readonly openValue: number;
  readonly wonValue: number;
}

export const COMPANY_FILTER_COLUMNS: readonly ColumnSpec[] = [
  { key: "industry", label: "Secteur", kind: "text" },
  { key: "size", label: "Taille", kind: "text" },
  { key: "loc", label: "Localisation", kind: "text" },
  { key: "contacts", label: "Contacts", kind: "number" },
  { key: "openValue", label: "Pipeline ouvert", kind: "number" },
  { key: "wonValue", label: "CA signé", kind: "number" },
];

export const COMPANY_DB_COLUMNS: readonly DbColumn[] = [
  { key: "industry", source: { kind: "scalar", field: "industry" } },
  { key: "size", source: { kind: "scalar", field: "size" } },
  { key: "loc", source: { kind: "scalar", field: "loc" } },
  { key: "contacts", source: { kind: "scalar", field: "contacts" }, derived: true },
  { key: "openValue", source: { kind: "scalar", field: "openValue" }, derived: true },
  { key: "wonValue", source: { kind: "scalar", field: "wonValue" }, derived: true },
];

export const COMPANY_FACET_COLUMNS: readonly FacetColumn<CompanyFacetRow>[] = [
  { key: "industry", label: "Secteur", value: (row) => row.industry },
  { key: "size", label: "Taille", value: (row) => row.size },
  { key: "loc", label: "Localisation", value: (row) => row.loc },
  { key: "contacts", label: "Contacts", value: (row) => row.contacts },
  { key: "openValue", label: "Pipeline ouvert", value: (row) => row.openValue },
  { key: "wonValue", label: "CA signé", value: (row) => row.wonValue },
];
