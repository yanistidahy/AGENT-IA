"use client";

import { EmptyState } from "@/components/ui/primitives";
import { ColumnFilterMenu } from "@/components/table/column-filter";
import type { CompanyRecord } from "@/lib/api/companies";
import { COMPANY_FILTER_COLUMNS } from "@/lib/api/company-columns";
import type { ColumnFilter, FilterState } from "@/lib/domain/column-filters";
import type { FacetValue } from "@/lib/domain/column-match";
import { externalLabel, externalUrl } from "@/lib/domain/links";
import { moneyShort } from "@/lib/format";

/**
 * Tableau des sociétés.
 *
 * Il remplace la grille de cartes : à 133 sociétés réelles, comparer et trier
 * l'emporte sur la lecture d'une fiche isolée — et des colonnes sont la seule
 * forme sur laquelle des filtres de colonne ont un sens.
 */
export type CompanySortKey =
  | "name"
  | "industry"
  | "size"
  | "loc"
  | "contacts"
  | "openValue"
  | "wonValue";

interface CompaniesTableProps {
  readonly companies: readonly CompanyRecord[];
  readonly sort: CompanySortKey | undefined;
  readonly dir: "asc" | "desc";
  readonly onSort: (key: CompanySortKey) => void;
  readonly onSelect: (company: CompanyRecord) => void;
  readonly facets: Readonly<Record<string, readonly FacetValue[]>>;
  readonly filters: FilterState;
  readonly onFilter: (key: string, filter: ColumnFilter | null) => void;
  readonly emptyReason: string;
}

const COLUMNS: ReadonlyArray<{
  key: CompanySortKey;
  label: string;
  filter: string | null;
  numeric?: boolean;
}> = [
  { key: "name", label: "Société", filter: null },
  { key: "industry", label: "Secteur", filter: "industry" },
  { key: "size", label: "Taille", filter: "size" },
  { key: "loc", label: "Localisation", filter: "loc" },
  { key: "contacts", label: "Contacts", filter: "contacts", numeric: true },
  { key: "openValue", label: "Pipeline ouvert", filter: "openValue", numeric: true },
  { key: "wonValue", label: "CA signé", filter: "wonValue", numeric: true },
];

export function CompaniesTable({
  companies,
  sort,
  dir,
  onSort,
  onSelect,
  facets,
  filters,
  onFilter,
  emptyReason,
}: CompaniesTableProps) {
  if (companies.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface shadow-card">
        <EmptyState title="Aucune société ne correspond.">
          <span className="mx-auto block max-w-[52ch] text-[13px] leading-relaxed">
            {emptyReason}
          </span>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {COLUMNS.map((column) => {
              const spec =
                column.filter === null
                  ? null
                  : (COMPANY_FILTER_COLUMNS.find((item) => item.key === column.filter) ?? null);

              return (
                <th
                  key={column.key}
                  scope="col"
                  className={`border-b border-line bg-surface-2 px-3.5 py-2.5 font-mono text-[9.5px] font-medium tracking-[0.12em] whitespace-nowrap text-muted uppercase ${
                    column.numeric === true ? "text-right" : "text-left"
                  }`}
                >
                  <span className="inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      className="uppercase transition-colors hover:text-ink"
                    >
                      {column.label}
                      {sort === column.key && (dir === "desc" ? " ↓" : " ↑")}
                    </button>
                    {spec !== null && (
                      <ColumnFilterMenu
                        column={spec}
                        facets={facets[spec.key] ?? []}
                        value={filters[spec.key] ?? null}
                        onChange={(next) => onFilter(spec.key, next)}
                      />
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => {
            const site = externalUrl(company.domain);

            return (
              <tr
                key={company.id}
                onClick={() => onSelect(company)}
                className="cursor-pointer border-b border-line last:border-b-0 hover:bg-surface-2"
              >
                <td className="px-3.5 py-2.5 text-[13px]">
                  <b className="block font-semibold">{company.name}</b>
                  {site !== null && (
                    // `stopPropagation` : cliquer le lien ouvre le site, pas la
                    // fiche — deux actions distinctes sur la même ligne.
                    <a
                      href={site}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="text-[12px] text-muted hover:text-flux-d hover:underline"
                    >
                      {externalLabel(company.domain)}
                    </a>
                  )}
                </td>
                <td className="px-3.5 py-2.5 text-[13px]">{company.industry || "—"}</td>
                <td className="px-3.5 py-2.5 text-[13px]">{company.size || "—"}</td>
                <td className="px-3.5 py-2.5 text-[13px]">{company.loc || "—"}</td>
                <td className="px-3.5 py-2.5 text-right font-mono text-[12.5px]">
                  {company.contacts.length}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono text-[12.5px]">
                  {company.openValue === 0 ? "—" : moneyShort(company.openValue)}
                </td>
                <td className="px-3.5 py-2.5 text-right font-mono text-[12.5px] font-semibold">
                  {company.wonValue === 0 ? "—" : moneyShort(company.wonValue)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
