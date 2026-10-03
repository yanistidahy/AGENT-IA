"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { Drawer } from "@/components/ui/drawer";
import { requestJson } from "@/lib/client/http";
import { isTaskPriority } from "@/lib/domain/guards";
import { isTaskKind } from "@/lib/domain/task-kind";
import {
  activeFilterCount,
  emptyState,
  paginate,
  tabLabel,
  tabView,
  ALL_PEOPLE,
  type TaskFilters,
  type TaskRow,
  type TaskTabId,
} from "@/lib/domain/task-tabs";
import { FocusMode } from "./focus-mode";
import { PersonFilter } from "./person-filter";
import { TaskFullForm } from "./task-full-form";
import { TaskRows } from "./task-rows";
import { TaskTabBar } from "./task-tab-bar";
import { TaskToolbar } from "./task-toolbar";

/**
 * L'écran Tâches : quatre onglets, un choix de personne, une liste paginée.
 *
 * **La pastille et la liste sortent du même appel.** `tabView()` rend les deux
 * à partir d'un tableau filtré une fois par personne : il n'existe donc aucun
 * ordre d'appel dans lequel elles pourraient diverger, là où deux fonctions
 * séparées laissaient toujours la possibilité d'en appeler une sur un tableau
 * et l'autre sur un autre (jalons 49, 78).
 *
 * Tout l'état — onglet, personne, recherche, filtres, page — vit dans l'URL : la
 * vue survit à un rechargement, se met en favori, et un onglet enregistré n'est
 * qu'une requête nommée (jalon 92).
 */
interface TasksViewProps {
  readonly rows: readonly TaskRow[];
  readonly tab: TaskTabId;
  readonly savedTabs: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly query: string;
  }>;
  readonly people: readonly string[];
  readonly contacts: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly search: string;
  }>;
}

export function TasksView({ rows, tab, savedTabs, people, contacts }: TasksViewProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);
  const [focus, setFocus] = useState(false);
  const [tabs, setTabs] = useState(savedTabs);

  const search = params.get("q") ?? "";
  const filtersOpen = params.get("filtres") === "1";
  const activeSaved = params.get("perso") ?? "";
  const person = params.get("personne") ?? ALL_PEOPLE;

  const filters: TaskFilters = useMemo(() => {
    const priority = params.get("priorite") ?? "";
    const kind = params.get("type") ?? "";
    return {
      ...(isTaskPriority(priority) ? { priority } : {}),
      ...(isTaskKind(kind) ? { kind } : {}),
    };
  }, [params]);

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      startTransition(() => router.replace(`/taches?${next.toString()}`, { scroll: false }));
    },
    [params, router],
  );

  /* La même horloge pour les pastilles et pour les listes, forcément. */
  const now = useMemo(() => new Date(), []);
  const view = useMemo(
    () => tabView(rows, tab, person, now, filters, search),
    [rows, tab, person, now, filters, search],
  );

  const active = activeFilterCount(filters, search);
  const page = paginate(view.shown, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const empty = emptyState(tab, person, view.inTab.length, view.shown.length, filters, search);

  const refresh = () => {
    setCreating(false);
    router.refresh();
  };

  const saveTab = async (name: string) => {
    const query = new URLSearchParams(params.toString());
    query.delete("perso");
    query.delete("page");
    const result = await requestJson<{ tabs: typeof savedTabs }>(
      "/api/task-tabs",
      { method: "POST", body: JSON.stringify({ name, query: query.toString() }) },
      (value): value is { tabs: typeof savedTabs } =>
        typeof value === "object" && value !== null && "tabs" in value,
    );
    if (result.ok) setTabs(result.data.tabs);
  };

  const deleteTab = async (id: string) => {
    const result = await requestJson<{ tabs: typeof savedTabs }>(
      "/api/task-tabs",
      { method: "DELETE", body: JSON.stringify({ id }) },
      (value): value is { tabs: typeof savedTabs } =>
        typeof value === "object" && value !== null && "tabs" in value,
    );
    if (result.ok) {
      setTabs(result.data.tabs);
      if (activeSaved === id) setParams({ perso: null });
    }
  };

  const openSaved = (id: string) => {
    const saved = tabs.find((entry) => entry.id === id);
    if (saved === undefined) return;
    const query = new URLSearchParams(saved.query);
    query.set("perso", id);
    startTransition(() => router.replace(`/taches?${query.toString()}`, { scroll: false }));
  };

  return (
    <>
      <TaskTabBar
        tab={tab}
        counts={view.counts}
        savedTabs={tabs}
        activeSaved={activeSaved}
        onSelect={(next) => setParams({ onglet: next, page: null, perso: null })}
        onOpenSaved={openSaved}
        onSave={(name) => void saveTab(name)}
        onDeleteSaved={(id) => void deleteTab(id)}
      />

      <PersonFilter
        people={people}
        person={person}
        onSelect={(next) => setParams({ personne: next, page: null })}
      />

      <p className="mb-3 text-[13px] text-muted">
        {activeSaved === ""
          ? tabLabel(tab)
          : (tabs.find((entry) => entry.id === activeSaved)?.name ?? tabLabel(tab))}
        {person !== ALL_PEOPLE && ` · ${person}`}
        {page.total > 0 && ` · ${page.range}`}
      </p>

      <TaskToolbar
        search={search}
        filters={filters}
        activeCount={active}
        open={filtersOpen}
        canStart={view.shown.length > 0}
        onSearch={(value) => setParams({ q: value, page: null })}
        onFilter={(patch) => setParams({ ...patch, page: null })}
        onToggleFilters={() => setParams({ filtres: filtersOpen ? null : "1" })}
        onCreate={() => setCreating(true)}
        onStart={() => setFocus(true)}
      />

      {focus ? (
        <FocusMode
          rows={view.shown}
          onQuit={() => setFocus(false)}
          onChanged={() => router.refresh()}
        />
      ) : empty !== null ? (
        <div className="rounded-card border border-line bg-surface px-5 py-11 text-center shadow-card">
          <b className="mb-1.5 block font-display text-[15px]">
            {empty.kind === "filtered" ? empty.message : "Rien dans cet onglet"}
          </b>
          <span className="block text-[13px] text-muted">
            {empty.kind === "filtered"
              ? "Des filtres masquent du travail de cet onglet."
              : empty.message}
          </span>
          {empty.kind === "filtered" && (
            <button
              type="button"
              onClick={() => setParams({ q: null, priorite: null, type: null, page: null })}
              className="mt-4 inline-flex min-h-[44px] items-center rounded-control bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-d lg:min-h-0"
            >
              Retirer les filtres
            </button>
          )}
        </div>
      ) : (
        <>
          <TaskRows rows={page.rows} onChanged={refresh} />
          <nav className="mt-4 flex items-center gap-3 text-[12.5px] text-muted">
            <span className="font-mono">{page.range}</span>
            <button
              type="button"
              disabled={page.page <= 1}
              onClick={() => setParams({ page: String(page.page - 1) })}
              className="rounded-control border border-line px-2.5 py-1.5 font-semibold disabled:opacity-40"
            >
              Précédent
            </button>
            <button
              type="button"
              disabled={page.page >= page.pages}
              onClick={() => setParams({ page: String(page.page + 1) })}
              className="rounded-control border border-line px-2.5 py-1.5 font-semibold disabled:opacity-40"
            >
              Suivant
            </button>
          </nav>
        </>
      )}

      <Drawer open={creating} title="Nouvelle tâche" onClose={() => setCreating(false)}>
        <TaskFullForm
          people={people}
          contacts={contacts}
          onCancel={() => setCreating(false)}
          onCreated={refresh}
        />
      </Drawer>
    </>
  );
}
