import type { ColumnSpec } from "../domain/column-filters";
import type { FacetColumn } from "../domain/column-match";
import type { DbColumn } from "./column-filters";

/** L'étiquette de la facette « le compte est noté ». Une seule source. */
export const INSTAGRAM_PRESENT = "Compte connu";

/**
 * Colonnes filtrables de `/contacts`.
 *
 * Une seule déclaration sert trois consommateurs : la clause Prisma, le comptage
 * des valeurs distinctes, et l'en-tête de tableau qui dessine les icônes. Une
 * colonne ajoutée ici apparaît partout ; il n'y a pas de liste à tenir en
 * parallèle qui finirait par se désaccorder.
 */

/** Projection légère lue pour compter les valeurs distinctes. */
export interface ContactFacetRow {
  readonly id: string;
  readonly lifecycle: string;
  readonly owner: string;
  readonly source: string;
  readonly tag: string;
  readonly lostReason: string;
  /** Statut **saisi**. Vide = le calcul fait foi ; voir lib/domain/status.ts. */
  readonly status: string;
  /** Compte Instagram, brut. La facette n'en garde que la présence. */
  readonly instagram: string;
  readonly companyName: string | null;
  readonly lastContact: Date | null;
  readonly nextReminder: Date | null;
}

export const CONTACT_FILTER_COLUMNS: readonly ColumnSpec[] = [
  { key: "company", label: "Société", kind: "text" },
  { key: "lifecycle", label: "Cycle de vie", kind: "text" },
  { key: "tag", label: "Étiquette", kind: "text" },
  { key: "owner", label: "Propriétaire", kind: "text" },
  { key: "source", label: "Source", kind: "text" },
  { key: "lostReason", label: "Motif de perte", kind: "text" },
  /**
   * Le statut **saisi**, filtrable en SQL parce qu'il est stocké — à la
   * différence du statut calculé, qui n'existe qu'après lecture. C'est ce qui
   * permet d'isoler « Contacté — en attente » pour organiser des relances.
   * Les fiches au statut vide se retrouvent sous « (vide) ».
   */
  { key: "status", label: "Statut saisi", kind: "text" },
  /**
   * Filtrable sur sa **présence**, pas sur sa valeur : les pseudos sont uniques,
   * en lister cent quarante ne filtrerait rien. Deux facettes seulement —
   * « Compte connu » et « (vide) » — ce qui permet de croiser le segment
   * Instagram avec le cycle de vie ou la source, ce que la puce seule ne fait
   * pas.
   */
  { key: "instagram", label: "Instagram", kind: "text" },
  { key: "lastContact", label: "Dernier contact", kind: "date" },
  { key: "nextReminder", label: "Prochaine relance", kind: "date" },
];

export const CONTACT_DB_COLUMNS: readonly DbColumn[] = [
  { key: "company", source: { kind: "relation", path: "company", field: "name" } },
  { key: "lifecycle", source: { kind: "scalar", field: "lifecycle" } },
  { key: "tag", source: { kind: "scalar", field: "tag" } },
  { key: "owner", source: { kind: "scalar", field: "owner" } },
  { key: "source", source: { kind: "scalar", field: "source" } },
  { key: "lostReason", source: { kind: "scalar", field: "lostReason" } },
  { key: "status", source: { kind: "scalar", field: "status" } },
  {
    key: "instagram",
    source: { kind: "presence", field: "instagram", label: INSTAGRAM_PRESENT },
  },
  { key: "lastContact", source: { kind: "scalar", field: "lastContact" } },
  { key: "nextReminder", source: { kind: "scalar", field: "nextReminder" } },
];

export const CONTACT_FACET_COLUMNS: readonly FacetColumn<ContactFacetRow>[] = [
  { key: "company", label: "Société", value: (row) => row.companyName },
  { key: "lifecycle", label: "Cycle de vie", value: (row) => row.lifecycle },
  { key: "tag", label: "Étiquette", value: (row) => row.tag },
  { key: "owner", label: "Propriétaire", value: (row) => row.owner },
  { key: "source", label: "Source", value: (row) => row.source },
  { key: "lostReason", label: "Motif de perte", value: (row) => row.lostReason },
  { key: "status", label: "Statut saisi", value: (row) => row.status },
  {
    key: "instagram",
    label: "Instagram",
    // La facette est binaire : la chaîne vide devient « (vide) » comme partout
    // ailleurs, le reste devient une seule valeur.
    value: (row) => (row.instagram.trim() === "" ? "" : INSTAGRAM_PRESENT),
  },
  { key: "lastContact", label: "Dernier contact", value: (row) => row.lastContact },
  { key: "nextReminder", label: "Prochaine relance", value: (row) => row.nextReminder },
];
