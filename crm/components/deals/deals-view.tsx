"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Icon } from "@/components/ui/icon";
import { DEAL_STATUS_FILTERS, type DealRecord } from "@/lib/api/deals";
import type { PilotageSettings } from "@/lib/domain/types";
import { money } from "@/lib/format";
import type { SequenceOption } from "@/components/activities/run-sequence";
import type { Alert } from "@/lib/domain/types";
import { DealDrawer } from "./deal-drawer";
import { DealForm, type DealFormOptions } from "./deal-form";
import { DealsTable, type SortKey } from "./deals-table";
import { DEAL_FILTER_COLUMNS } from "@/lib/api/deal-columns";
import type { FacetValue } from "@/lib/domain/column-match";
import { FilterSummary, useColumnFilters } from "@/components/table/filter-state";

interface DealsViewProps extends DealFormOptions {
  readonly deals: readonly DealRecord[];
  readonly settings: PilotageSettings;
  readonly sequences: readonly SequenceOption[];
  readonly alerts: readonly Alert[];
  /** Affaire désignée par `?fiche=` mais absente de la liste filtrée. */
  readonly focused: DealRecord | null;
  /** Comptes par statut, sur l'ensemble des affaires — pas sur la liste filtrée. */
  readonly statusCounts: Readonly<Record<string, number>>;
  readonly facets: Readonly<Record<string, readonly FacetValue[]>>;
  readonly totalRows: number;
}

const CONTROL =
  "rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";

export function DealsView({
  deals,
  settings,
  sequences,
  alerts,
  focused,
  statusCounts,
  facets,
  totalRows,
  ...options
}: DealsViewProps) {
  const {
    state: columnFilters,
    setFilter,
    reset,
  } = useColumnFilters("/affaires", DEAL_FILTER_COLUMNS);
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);

  const status = params.get("status") ?? "open";
  const sortParam = params.get("sort");
  const dir = params.get("dir") === "desc" ? "desc" : "asc";

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      startTransition(() => router.replace(`/affaires?${next.toString()}`, { scroll: false }));
    },
    [params, router],
  );

  // Tiroir piloté par l'URL — voir le commentaire équivalent dans contacts-view.
  const fiche = params.get("fiche");
  const selected = fiche === null ? null : (deals.find((d) => d.id === fiche) ?? focused);

  const refresh = () => {
    setCreating(false);
    router.refresh();
  };

  const total = deals.reduce((sum, deal) => sum + deal.amount, 0);

  return (
    <div className="px-6 py-6">
      <header className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Affaires</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {deals.length} affaires · {money(total)} au total
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-control bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-d"
        >
          <Icon name="plus" size={15} />
          Nouvelle affaire
        </button>
      </header>

      <div className="mb-3.5 flex flex-wrap items-center gap-2">
        {/* `flex-wrap` sous `lg` : quatre segments ne tiennent pas sur 360 px,
            et un segment coupé hors écran est un filtre qu'on ne peut plus
            choisir. */}
        <div className="flex overflow-hidden rounded-control border border-line bg-surface max-lg:flex-wrap">
          {DEAL_STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setParam({ status: filter.value })}
              className={`border-r border-line px-3 py-1.5 text-[12.5px] font-semibold last:border-r-0 transition-colors ${
                status === filter.value ? "bg-brand text-white" : "text-muted hover:bg-surface-2"
              }`}
            >
              {filter.label}
              {(statusCounts[filter.value] ?? 0) > 0 && (
                <span className="ml-1 font-normal opacity-80">
                  ({statusCounts[filter.value]})
                </span>
              )}
            </button>
          ))}
        </div>

        <input
          className={`${CONTROL} min-w-[220px]`}
          placeholder="Rechercher une affaire…"
          defaultValue={params.get("q") ?? ""}
          onChange={(event) => setParam({ q: event.target.value })}
        />

        <select
          className={CONTROL}
          value={params.get("stageId") ?? ""}
          onChange={(event) => setParam({ stageId: event.target.value })}
        >
          <option value="">Toutes les étapes</option>
          {options.stages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </select>

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
      </div>

      <FilterSummary
        shown={deals.length}
        total={totalRows}
        active={Object.keys(columnFilters).length}
        onReset={reset}
      />

      <DealsTable
        deals={deals}
        facets={facets}
        filters={columnFilters}
        onFilter={setFilter}
        settings={settings}
        sort={isSortKey(sortParam) ? sortParam : undefined}
        dir={dir}
        onSort={(key) =>
          setParam({ sort: key, dir: sortParam === key && dir === "asc" ? "desc" : "asc" })
        }
        onSelect={(deal) => setParam({ fiche: deal.id })}
        status={status}
        searching={(params.get("q") ?? "") !== ""}
        total={statusCounts.all ?? 0}
      />

      <DealDrawer
        {...options}
        deal={selected ?? null}
        settings={settings}
        sequences={sequences}
        alerts={
          selected === null || selected === undefined
            ? []
            : alerts.filter(
                (alert) => alert.targetType === "deal" && alert.targetId === selected.id,
              )
        }
        onClose={() => setParam({ fiche: null })}
        onChanged={refresh}
      />

      <Drawer
        open={creating}
        title="Nouvelle affaire"
        onClose={() => setCreating(false)}
      >
        <DealForm
          {...options}
          deal={null}
          onCancel={() => setCreating(false)}
          onSaved={refresh}
        />
      </Drawer>
    </div>
  );
}

const SORT_KEYS: readonly SortKey[] = [
  "name",
  "amount",
  "expectedClose",
  "lastActivityAt",
  "owner",
];

function isSortKey(value: string | null): value is SortKey {
  return value !== null && SORT_KEYS.some((key) => key === value);
}
