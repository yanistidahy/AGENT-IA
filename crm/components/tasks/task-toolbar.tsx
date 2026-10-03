"use client";

import { Icon } from "@/components/ui/icon";
import { TASK_KINDS, TASK_KIND_LABELS } from "@/lib/domain/task-kind";
import type { TaskFilters } from "@/lib/domain/task-tabs";
import type { TaskPriority } from "@/lib/domain/types";

/**
 * La barre d'outils : recherche, filtres, création, focus.
 *
 * **Le bouton « Filtres » dit combien il en cache.** Un filtre actif replié
 * derrière un bouton muet est un écran qui ment : la liste est filtrée et rien
 * ne dit par quoi (règle du jalon 21, reprise du jalon 31).
 *
 * Le choix de la personne **n'est pas ici** : il a sa propre rangée sous les
 * onglets (jalon 105). C'est la question qu'on se pose en arrivant, pas un
 * filtre qu'on déplie — et surtout, c'est elle qui décide de ce que les
 * pastilles comptent.
 */
interface TaskToolbarProps {
  readonly search: string;
  readonly filters: TaskFilters;
  readonly activeCount: number;
  readonly open: boolean;
  readonly canStart: boolean;
  readonly onSearch: (value: string) => void;
  readonly onFilter: (patch: Record<string, string | null>) => void;
  readonly onToggleFilters: () => void;
  readonly onCreate: () => void;
  readonly onStart: () => void;
}

const CONTROL =
  "rounded-control border border-line bg-surface px-2.5 py-2 text-[13px] outline-none focus:border-brand min-h-[44px] lg:min-h-0";

const PRIORITIES: readonly TaskPriority[] = ["haute", "normale", "basse"];

export function TaskToolbar({
  search,
  filters,
  activeCount,
  open,
  canStart,
  onSearch,
  onFilter,
  onToggleFilters,
  onCreate,
  onStart,
}: TaskToolbarProps) {
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Rechercher une tâche</span>
          <input
            className={`${CONTROL} min-w-[220px] pl-8`}
            placeholder="Rechercher une tâche…"
            defaultValue={search}
            onChange={(event) => onSearch(event.target.value)}
          />
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
            <Icon name="search" size={14} />
          </span>
        </label>

        <button
          type="button"
          onClick={onToggleFilters}
          aria-expanded={open}
          className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-control border px-3 py-2 text-[12.5px] font-semibold lg:min-h-0 ${
            activeCount > 0
              ? "border-brand bg-brand-l text-brand-d"
              : "border-line bg-surface text-ink hover:bg-surface-2"
          }`}
        >
          Filtres
          {activeCount > 0 && <span className="font-mono text-[11px]">· {activeCount} actif{activeCount > 1 ? "s" : ""}</span>}
        </button>

        <button
          type="button"
          onClick={onCreate}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-control border border-line bg-surface px-3 py-2 text-[12.5px] font-semibold hover:bg-surface-2 lg:min-h-0"
        >
          <Icon name="plus" size={14} />
          Créer une tâche
        </button>

        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-control bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-d disabled:cursor-not-allowed disabled:opacity-50 lg:min-h-0"
        >
          <Icon name="arrow" size={15} />
          Démarrer
        </button>
      </div>

      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface px-3 py-2">
          <select
            aria-label="Priorité"
            className={CONTROL}
            value={filters.priority ?? ""}
            onChange={(event) => onFilter({ priorite: event.target.value })}
          >
            <option value="">Toutes les priorités</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>

          <select
            aria-label="Type de tâche"
            className={CONTROL}
            value={filters.kind ?? ""}
            onChange={(event) => onFilter({ type: event.target.value })}
          >
            <option value="">Tous les types</option>
            {TASK_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {TASK_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
