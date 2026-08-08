"use client";

import { CLIENT_FILTER_COLUMNS } from "@/lib/api/client-columns";
import { ColumnFilterMenu } from "@/components/table/column-filter";
import { useColumnFilters } from "@/components/table/filter-state";
import type { FacetValue } from "@/lib/domain/column-match";

/**
 * Menu de filtre d'une colonne de `/clients`.
 *
 * Ce composant écrit lui-même dans l'URL au lieu de recevoir un `onChange` :
 * c'est ce qui permet à la table de rester un **composant serveur**. Une
 * fonction ne franchit pas la frontière serveur → client ; une lecture de l'URL,
 * si. Le tri continue donc de passer par de simples liens, et le tableau
 * n'envoie aucun JavaScript au navigateur en dehors de ces menus.
 */
export function ClientFilterCell({
  columnKey,
  facets,
}: {
  columnKey: string;
  facets: readonly FacetValue[];
}) {
  const { state, setFilter } = useColumnFilters("/clients", CLIENT_FILTER_COLUMNS);
  const column = CLIENT_FILTER_COLUMNS.find((candidate) => candidate.key === columnKey);
  if (column === undefined) return null;

  return (
    <ColumnFilterMenu
      column={column}
      facets={facets}
      value={state[columnKey] ?? null}
      onChange={(next) => setFilter(columnKey, next)}
    />
  );
}

/** Bandeau de réinitialisation, monté à côté du tableau serveur. */
export function ClientFilterSummary({ shown, total }: { shown: number; total: number }) {
  const { state, reset } = useColumnFilters("/clients", CLIENT_FILTER_COLUMNS);
  const active = Object.keys(state).length;
  if (active === 0) return null;

  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-control border border-[#F0DFB8] bg-gold-l px-3 py-1.5 text-[12.5px] text-[#9A6410]">
      <span>
        <b className="font-mono">
          {shown} sur {total}
        </b>{" "}
        — {active} filtre(s) de colonne actif(s).
      </span>
      <button type="button" onClick={reset} className="font-semibold underline">
        Réinitialiser tous les filtres
      </button>
    </div>
  );
}
