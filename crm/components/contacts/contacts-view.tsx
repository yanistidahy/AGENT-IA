"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Icon } from "@/components/ui/icon";
import type { ContactRecord } from "@/lib/api/contacts";
import { LIFECYCLES, type PilotageSettings } from "@/lib/domain/types";
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
  /** Fiche désignée par `?fiche=` mais absente de la liste filtrée. */
  readonly focused: ContactRecord | null;
}

const CONTROL =
  "rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-flux";

const LIFECYCLE_FILTERS = ["all", ...LIFECYCLES] as const;
const LIFECYCLE_LABELS: Record<string, string> = { all: "Tous" };

export function ContactsView({
  contacts,
  settings,
  linkableDeals,
  sequences,
  alerts,
  focused,
  ...options
}: ContactsViewProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);

  const lifecycle = params.get("lifecycle") ?? "all";
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
            className="inline-flex items-center gap-1.5 rounded-control bg-flux px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-flux-d"
          >
            <Icon name="plus" size={15} />
            Nouveau contact
          </button>
        </div>
      </header>

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-control border border-line bg-surface">
          {LIFECYCLE_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setParam({ lifecycle: value })}
              className={`border-r border-line px-3 py-1.5 text-[12.5px] font-semibold transition-colors last:border-r-0 ${
                lifecycle === value ? "bg-ink text-white" : "text-muted hover:bg-surface-2"
              }`}
            >
              {LIFECYCLE_LABELS[value] ?? value}
            </button>
          ))}
        </div>

        <input
          className={`${CONTROL} min-w-[220px]`}
          placeholder="Rechercher un contact…"
          defaultValue={params.get("q") ?? ""}
          onChange={(event) => setParam({ q: event.target.value })}
        />

        <select
          className={CONTROL}
          value={params.get("owner") ?? ""}
          onChange={(event) => setParam({ owner: event.target.value })}
        >
          <option value="">Tous les propriétaires</option>
          {options.owners.map((owner) => (
            <option key={owner}>{owner}</option>
          ))}
        </select>

        <select
          className={CONTROL}
          value={params.get("source") ?? ""}
          onChange={(event) => setParam({ source: event.target.value })}
        >
          <option value="">Toutes les sources</option>
          {options.sources.map((source) => (
            <option key={source}>{source}</option>
          ))}
        </select>
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
];

function isSortKey(value: string | null): value is ContactSortKey {
  return value !== null && SORT_KEYS.some((key) => key === value);
}
