"use client";

import type { AccountState, DmState } from "@/lib/domain/instagram-filter";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Icon } from "@/components/ui/icon";
import type { ContactRecord } from "@/lib/api/contacts";
import { isContactFilter } from "@/lib/domain/follow-up";
import type { PilotageSettings } from "@/lib/domain/types";
import type { FacetValue } from "@/lib/domain/column-match";
import { CONTACT_FILTER_COLUMNS } from "@/lib/api/contact-columns";
import { FilterSummary, useColumnFilters } from "@/components/table/filter-state";
import { ContactsFilters } from "./contacts-filters";
import { ColumnPicker } from "@/components/table/column-picker";
import { CONTACT_COLUMNS, DEFAULT_COLUMNS, LOCKED_COLUMN } from "./contact-table-columns";
import { usePersistedSet } from "@/lib/client/persisted";
import { ContactDrawer } from "./contact-drawer";
import { ContactForm, type ContactFormOptions } from "./contact-form";
import { ContactsTable, type ContactSortKey } from "./contacts-table";
import { ImportDialog } from "./import-dialog";
import type { SequenceOption } from "@/components/activities/run-sequence";
import type { Alert } from "@/lib/domain/types";
import type { LinkableDeal } from "./link-deal";

interface ContactsViewProps extends ContactFormOptions {
  readonly contacts: readonly ContactRecord[];
  readonly settings: PilotageSettings;
  readonly linkableDeals: readonly LinkableDeal[];
  readonly sequences: readonly SequenceOption[];
  readonly alerts: readonly Alert[];
  /** Compteurs de la puce « À relancer », calculés sur l'ensemble des contacts. */
  readonly reminderCounts: { readonly total: number; readonly late: number };
  readonly account: AccountState | undefined;
  readonly dm: DmState | undefined;
  readonly instagramCounts: Readonly<Record<string, number>>;
  /** Fiche désignée par `?fiche=` mais absente de la liste filtrée. */
  readonly focused: ContactRecord | null;
  /** Valeurs distinctes par colonne, calculées côté serveur. */
  readonly facets: Readonly<Record<string, readonly FacetValue[]>>;
  /** Total avant filtres de colonne, pour le « 54 sur 138 ». */
  readonly totalRows: number;
  readonly incompleteCount: number;
  readonly unidentifiedCount: number;
  readonly companyOptions: ReadonlyArray<{ id: string; name: string; count: number }>;
  readonly tagCounts: ReadonlyArray<{ value: string; count: number }>;
  /** Offres proposées à la qualification, et celle vendue en dernier. */
  readonly offers: readonly string[];
  readonly defaultOffer: string;
}

export function ContactsView({
  contacts,
  settings,
  offers,
  defaultOffer,
  linkableDeals,
  sequences,
  alerts,
  focused,
  reminderCounts,
  account,
  dm,
  instagramCounts,
  facets,
  totalRows,
  incompleteCount,
  unidentifiedCount,
  companyOptions,
  tagCounts,
  ...options
}: ContactsViewProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  // Le choix de colonnes vit dans le poste, pas dans l'URL : ce n'est pas un
  // filtre qu'on partage, c'est une préférence d'affichage.
  const [visibleColumns, toggleColumn, resetColumns] = usePersistedSet(
    "contacts.columns",
    DEFAULT_COLUMNS,
  );
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  const {
    state: filters,
    setFilter,
    reset,
  } = useColumnFilters("/contacts", CONTACT_FILTER_COLUMNS);

  const lifecycle = params.get("lifecycle") ?? "all";
  const followUp = params.get("followUp");
  const incomplete = params.get("incomplete") === "1";
  const sortParam = params.get("sort");
  const dir = params.get("dir") === "desc" ? "desc" : "asc";

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      startTransition(() => router.replace(`/contacts?${next.toString()}`, { scroll: false }));
    },
    [params, router],
  );

  // Le tiroir ouvert est un état d'URL, pas un état de composant : une alerte
  // du centre de pilotage peut donc ouvrir directement la bonne fiche, le lien
  // est partageable, et le bouton « précédent » referme le tiroir.
  const fiche = params.get("fiche");
  const selected =
    fiche === null ? null : (contacts.find((c) => c.id === fiche) ?? focused);

  const closeDrawer = () => setParam({ fiche: null });

  const refresh = () => {
    setCreating(false);
    router.refresh();
  };

  const clients = contacts.filter((contact) => contact.lifecycle === "Client").length;

  return (
    <div className="px-6 py-6">
      <header className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {contacts.length} contacts · {clients} clients
          </p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <a
            href={`/api/contacts/export?${params.toString()}`}
            className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold transition-colors hover:bg-surface-2"
          >
            Exporter en CSV
          </a>
          <button
            type="button"
            onClick={() => setImporting(true)}
            className="inline-flex items-center gap-1.5 rounded-control border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold transition-colors hover:bg-surface-2"
          >
            Importer
          </button>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-control bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-d"
          >
            <Icon name="plus" size={15} />
            Nouveau contact
          </button>
        </div>
      </header>

      <ContactsFilters
        lifecycle={lifecycle}
        followUp={followUp}
        incomplete={incomplete}
        incompleteCount={incompleteCount}
        unidentifiedCount={unidentifiedCount}
        reminderCounts={reminderCounts}
        account={account}
        dm={dm}
        instagramCounts={instagramCounts}
        owners={options.owners}
        sources={options.sources}
        companies={companyOptions}
        tags={tagCounts}
        current={Object.fromEntries(params.entries())}
        onChange={setParam}
      />

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <FilterSummary
            shown={contacts.length}
            total={totalRows}
            active={Object.keys(filters).length}
            onReset={reset}
          />
        </div>
        <ColumnPicker
          columns={CONTACT_COLUMNS.map((column) => ({ key: column.key, label: column.label }))}
          visible={visibleColumns}
          locked={LOCKED_COLUMN}
          onToggle={toggleColumn}
          onReset={resetColumns}
        />
      </div>

      <ContactsTable
        contacts={contacts}
        settings={settings}
        sort={isSortKey(sortParam) ? sortParam : undefined}
        dir={dir}
        onSort={(key) =>
          setParam({ sort: key, dir: sortParam === key && dir === "asc" ? "desc" : "asc" })
        }
        onSelect={(contact) => setParam({ fiche: contact.id })}
        filter={followUp !== null && isContactFilter(followUp) ? followUp : null}
        facets={facets}
        filters={filters}
        onFilter={setFilter}
        visible={visibleColumns}
      />

      <ContactDrawer
        {...options}
        contact={selected ?? null}
        linkableDeals={linkableDeals}
        sequences={sequences}
        alerts={
          selected === null || selected === undefined
            ? []
            : alerts.filter(
                (alert) => alert.targetType === "contact" && alert.targetId === selected.id,
              )
        }
        onClose={closeDrawer}
        offers={offers}
        defaultOffer={defaultOffer}
        onChanged={refresh}
      />

      <Drawer open={creating} title="Nouveau contact" onClose={() => setCreating(false)}>
        <ContactForm
          {...options}
          contact={null}
          onCancel={() => setCreating(false)}
          onSaved={refresh}
        />
      </Drawer>

      <ImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        onImported={() => router.refresh()}
      />
    </div>
  );
}

const SORT_KEYS: readonly ContactSortKey[] = [
  "lastName",
  "firstName",
  "company",
  "lifecycle",
  "owner",
  "lastContact",
  "tag",
  "followUp",
  "nextReminder",
];

function isSortKey(value: string | null): value is ContactSortKey {
  return value !== null && SORT_KEYS.some((key) => key === value);
}
