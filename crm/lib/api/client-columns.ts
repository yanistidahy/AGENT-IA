import type { ColumnSpec } from "../domain/column-filters";
import type { FacetColumn } from "../domain/column-match";
import type { ClientRow } from "./clients";

/**
 * Colonnes filtrables de `/clients`.
 *
 * Toutes **dérivées** : le portefeuille est un agrégat d'affaires gagnées, pas
 * une table. Les filtres s'appliquent donc après lecture, sur les valeurs
 * exactement telles qu'elles sont affichées — un filtre « CA signé ≥ 5 000 »
 * retient précisément les lignes dont la colonne montre ≥ 5 000.
 *
 * Le volume est celui d'un portefeuille de clients, pas d'une base de
 * prospection : quelques dizaines de lignes, déjà toutes chargées pour être
 * affichées. Filtrer en mémoire ne coûte rien de plus ici.
 */
export const CLIENT_FILTER_COLUMNS: readonly ColumnSpec[] = [
  { key: "company", label: "Société", kind: "text" },
  { key: "followUp", label: "Statut", kind: "text" },
  { key: "wonValue", label: "CA signé", kind: "number" },
  { key: "openValue", label: "Pipeline ouvert", kind: "number" },
  { key: "signedAt", label: "Signé le", kind: "date" },
  { key: "lastContact", label: "Dernière interaction", kind: "date" },
  { key: "nextReminder", label: "Prochaine relance", kind: "date" },
];

export const CLIENT_FACET_COLUMNS: readonly FacetColumn<ClientRow>[] = [
  { key: "company", label: "Société", value: (row) => row.companyName },
  { key: "followUp", label: "Statut", value: (row) => row.followUp },
  { key: "wonValue", label: "CA signé", value: (row) => row.wonValue },
  { key: "openValue", label: "Pipeline ouvert", value: (row) => row.openValue },
  { key: "signedAt", label: "Signé le", value: (row) => row.signedAt },
  { key: "lastContact", label: "Dernière interaction", value: (row) => row.lastContact },
  { key: "nextReminder", label: "Prochaine relance", value: (row) => row.nextReminder },
];
