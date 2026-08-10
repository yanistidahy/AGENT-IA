"use client";

import { EmptyState } from "@/components/ui/primitives";
import type { ContactRecord } from "@/lib/api/contacts";
import { emptyFilterMessage, type ContactFilter } from "@/lib/domain/follow-up";
import type { PilotageSettings } from "@/lib/domain/types";
import type { ColumnFilter, ColumnSpec, FilterState } from "@/lib/domain/column-filters";
import type { FacetValue } from "@/lib/domain/column-match";
import { CONTACT_FILTER_COLUMNS } from "@/lib/api/contact-columns";
import { ColumnFilterMenu } from "@/components/table/column-filter";
import { CONTACT_COLUMNS, type ContactSortKey } from "./contact-table-columns";

export type { ContactSortKey };

/**
 * Le tableau des contacts.
 *
 * Il ne décide plus de ses colonnes : il reçoit celles à rendre et les tire de
 * `CONTACT_COLUMNS`, où chacune porte son libellé, son tri, son filtre et sa
 * cellule. L'ancienne version écrivait les en-têtes dans une liste et les
 * cellules en dur dans le corps — deux endroits qu'il fallait garder alignés à
 * la main, et un obstacle à tout choix de colonnes.
 */
interface ContactsTableProps {
  readonly contacts: readonly ContactRecord[];
  readonly settings: PilotageSettings;
  readonly sort: ContactSortKey | undefined;
  readonly dir: "asc" | "desc";
  readonly onSort: (key: ContactSortKey) => void;
  readonly onSelect: (contact: ContactRecord) => void;
  /** Filtre actif, pour expliquer une liste vide par la règle qui l'a produite. */
  readonly filter: ContactFilter | null;
  readonly facets: Readonly<Record<string, readonly FacetValue[]>>;
  readonly filters: FilterState;
  readonly onFilter: (key: string, filter: ColumnFilter | null) => void;
  /** Clés des colonnes à rendre, dans l'ordre de `CONTACT_COLUMNS`. */
  readonly visible: ReadonlySet<string>;
}

function specFor(key: string | null): ColumnSpec | null {
  if (key === null) return null;
  return CONTACT_FILTER_COLUMNS.find((column) => column.key === key) ?? null;
}

export function ContactsTable({
  contacts,
  settings,
  sort,
  dir,
  onSort,
  onSelect,
  filter,
  facets,
  filters,
  onFilter,
  visible,
}: ContactsTableProps) {
  const now = new Date();
  const columns = CONTACT_COLUMNS.filter((column) => visible.has(column.key));

  if (contacts.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface shadow-card">
        <EmptyState title="Aucun contact ne correspond.">
          <span className="mx-auto block max-w-[52ch] text-[13px] leading-relaxed">
            {filter === null
              ? "Modifiez les filtres, créez un contact, ou importez une liste depuis votre tableur."
              : emptyFilterMessage(filter, settings)}
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
            {columns.map((column) => {
              const spec = specFor(column.filterKey);
              return (
                <th
                  key={column.key}
                  scope="col"
                  className="border-b border-line bg-surface-2 px-3.5 py-2.5 text-left font-mono text-[9.5px] font-medium tracking-[0.12em] whitespace-nowrap text-muted uppercase"
                >
                  <span className="inline-flex items-center">
                    {column.sort === null ? (
                      column.label
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSort(column.sort as ContactSortKey)}
                        className="uppercase transition-colors hover:text-ink"
                      >
                        {column.label}
                        {sort === column.sort && (dir === "desc" ? " ↓" : " ↑")}
                      </button>
                    )}
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
          {contacts.map((contact) => (
            <tr
              key={contact.id}
              onClick={() => onSelect(contact)}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(contact);
                }
              }}
              className="cursor-pointer transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className="border-b border-line-2 px-3.5 py-3 text-[12.5px] first:text-[14px]"
                >
                  {column.cell(contact, now)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
