"use client";

import { EmptyState } from "@/components/ui/primitives";
import type { ContactRecord } from "@/lib/api/contacts";
import { emptyFilterMessage, type ContactFilter } from "@/lib/domain/follow-up";
import type { PilotageSettings } from "@/lib/domain/types";
import type { ColumnFilter, ColumnSpec, FilterState } from "@/lib/domain/column-filters";
import type { FacetValue } from "@/lib/domain/column-match";
import { CONTACT_FILTER_COLUMNS } from "@/lib/api/contact-columns";
import { ColumnFilterMenu } from "@/components/table/column-filter";
import { CardCallLink, CardList } from "@/components/table/card-list";
import { ContactStatusTag } from "@/components/ui/primitives";
import { describeReminder } from "@/lib/domain/follow-up";
import { CONTACT_COLUMNS, type ContactSortKey } from "./contact-table-columns";
import { contactTitle } from "@/lib/domain/contact-identity";

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
  /**
   * Mode sélection : une case par ligne, plus une en tête.
   *
   * Absent (le cas ordinaire), le tableau ne rend aucune case — la sélection
   * n'existe que quand on compose une campagne, et une colonne de cases
   * permanente serait une invitation à un geste sans destination.
   */
  readonly selection?: {
    readonly selected: ReadonlySet<string>;
    /** Déjà inscrits : montrés comme tels, jamais re-sélectionnables. */
    readonly enrolled: ReadonlySet<string>;
    readonly onToggle: (id: string) => void;
    /** Coche ou décoche **tout le filtre courant**, hors déjà inscrits. */
    readonly onToggleAll: (ids: readonly string[], checked: boolean) => void;
  };
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
  selection,
}: ContactsTableProps) {
  const now = new Date();
  const columns = CONTACT_COLUMNS.filter((column) => visible.has(column.key));
  // Les fiches que la case d'en-tête peut réellement cocher : celles qui sont
  // affichées **et** pas déjà inscrites.
  const selectableIds =
    selection === undefined
      ? []
      : contacts.filter((contact) => !selection.enrolled.has(contact.id)).map((contact) => contact.id);

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
    <>
      {/* Sur téléphone, le tableau se replie en cartes : nom et société en
          tête, l'état et l'échéance dessous, l'appel au bord — le reste à un
          tap, dans la fiche. Mêmes lignes, même tri, même filtre. */}
      <CardList
        rows={contacts}
        rowKey={(contact) => contact.id}
        title={(contact) => contactTitle(contact)}
        subtitle={(contact) => contact.company?.name ?? ""}
        onSelect={onSelect}
        trailing={(contact) => (
          <CardCallLink
            phone={contact.phone}
            name={contactTitle(contact)}
          />
        )}
        facts={(contact) => {
          const reminder =
            contact.nextReminder === null
              ? null
              : describeReminder(contact.nextReminder, now);
          return [
            {
              label: "Statut",
              value: (
                <ContactStatusTag
                  status={contact.status}
                  followUp={contact.followUp}
                  lifecycle={contact.lifecycle}
                />
              ),
            },
            ...(reminder === null
              ? []
              : [{ label: "Relance", value: reminder.label }]),
          ];
        }}
      />

      <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card max-lg:hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {selection !== undefined && (
              <th
                scope="col"
                className="w-11 border-b border-line bg-surface-2 px-3 py-2.5 text-left"
              >
                {/*
                  Coche **tout ce que le filtre courant affiche**, jamais toute
                  la base : ce qu'on voit est ce qu'on sélectionne. Les fiches
                  déjà inscrites sont hors du compte des deux côtés — les
                  recocher ne ferait rien, et une case qui ne fait rien laisse
                  croire qu'elle a fait quelque chose.
                */}
                <input
                  type="checkbox"
                  aria-label="Sélectionner toutes les fiches affichées"
                  className="h-5 w-5"
                  checked={selectableIds.length > 0 && selectableIds.every((id) => selection.selected.has(id))}
                  onChange={(event) =>
                    selection.onToggleAll(selectableIds, event.target.checked)
                  }
                />
              </th>
            )}
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
              {selection !== undefined && (
                <td
                  className="border-b border-line-2 px-3 py-3"
                  // Cocher n'ouvre pas la fiche : deux gestes distincts sur la
                  // même ligne, et c'est le clic sur la case qui gagne.
                  onClick={(event) => event.stopPropagation()}
                >
                  {selection.enrolled.has(contact.id) ? (
                    <span
                      title="Déjà inscrite à cette campagne"
                      className="font-mono text-[11px] text-win-d"
                    >
                      ✓ inscrite
                    </span>
                  ) : (
                    <input
                      type="checkbox"
                      aria-label={`Sélectionner ${contactTitle(contact)}`}
                      className="h-5 w-5"
                      checked={selection.selected.has(contact.id)}
                      onChange={() => selection.onToggle(contact.id)}
                    />
                  )}
                </td>
              )}
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
    </>
  );
}
