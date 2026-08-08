import type { ColumnSpec } from "../domain/column-filters";
import type { FacetColumn } from "../domain/column-match";
import type { DbColumn } from "./column-filters";

/** Colonnes filtrables de `/affaires` — même contrat que contact-columns.ts. */
export interface DealFacetRow {
  readonly id: string;
  readonly stage: string;
  readonly owner: string;
  readonly offer: string;
  readonly companyName: string | null;
  readonly amount: number;
  readonly expectedClose: Date | null;
  readonly lastActivityAt: Date | null;
}

export const DEAL_FILTER_COLUMNS: readonly ColumnSpec[] = [
  { key: "company", label: "Société", kind: "text" },
  { key: "stage", label: "Étape", kind: "text" },
  { key: "owner", label: "Propriétaire", kind: "text" },
  { key: "offer", label: "Offre", kind: "text" },
  { key: "amount", label: "Montant", kind: "number" },
  { key: "expectedClose", label: "Clôture prévue", kind: "date" },
  { key: "lastActivityAt", label: "Fraîcheur", kind: "date" },
];

export const DEAL_DB_COLUMNS: readonly DbColumn[] = [
  { key: "company", source: { kind: "relation", path: "company", field: "name" } },
  { key: "stage", source: { kind: "relation", path: "stage", field: "name" } },
  { key: "owner", source: { kind: "scalar", field: "owner" } },
  { key: "offer", source: { kind: "scalar", field: "offer" } },
  { key: "amount", source: { kind: "scalar", field: "amount" } },
  { key: "expectedClose", source: { kind: "scalar", field: "expectedClose" } },
  { key: "lastActivityAt", source: { kind: "scalar", field: "lastActivityAt" } },
];

export const DEAL_FACET_COLUMNS: readonly FacetColumn<DealFacetRow>[] = [
  { key: "company", label: "Société", value: (row) => row.companyName },
  { key: "stage", label: "Étape", value: (row) => row.stage },
  { key: "owner", label: "Propriétaire", value: (row) => row.owner },
  { key: "offer", label: "Offre", value: (row) => row.offer },
  { key: "amount", label: "Montant", value: (row) => row.amount },
  { key: "expectedClose", label: "Clôture prévue", value: (row) => row.expectedClose },
  { key: "lastActivityAt", label: "Fraîcheur", value: (row) => row.lastActivityAt },
];
