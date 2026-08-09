"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";
import {
  applyFilterToParams,
  clearFilters,
  parseFilters,
  type ColumnFilter,
  type ColumnSpec,
  type FilterState,
} from "@/lib/domain/column-filters";

/**
 * Lecture et écriture de l'état de filtrage, porté par l'URL.
 *
 * Rien n'est gardé en mémoire de composant : l'URL **est** l'état. Une vue
 * filtrée se met donc en favori, se partage par message, et revient identique
 * après un rechargement — et le serveur, qui lit la même URL, peut filtrer en
 * base plutôt que de tout envoyer au navigateur.
 */
export function useColumnFilters(path: string, columns: readonly ColumnSpec[]) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const flat = useMemo(() => {
    const record: Record<string, string[]> = {};
    for (const key of new Set(params.keys())) record[key] = params.getAll(key);
    return record;
  }, [params]);

  const state: FilterState = useMemo(() => parseFilters(flat, columns), [flat, columns]);

  const push = useCallback(
    (next: URLSearchParams) => {
      startTransition(() => router.replace(`${path}?${next.toString()}`, { scroll: false }));
    },
    [path, router],
  );

  const setFilter = useCallback(
    (key: string, filter: ColumnFilter | null) => {
      push(applyFilterToParams(new URLSearchParams(params.toString()), key, filter));
    },
    [params, push],
  );

  const reset = useCallback(() => {
    push(clearFilters(new URLSearchParams(params.toString())));
  }, [params, push]);

  return { state, setFilter, reset, params, push };
}

/**
 * Bandeau de réinitialisation.
 *
 * N'apparaît que lorsqu'au moins un filtre est actif, et annonce combien de
 * lignes restent sur combien : sans ce nombre, une vue filtrée ressemble à une
 * base qui a perdu des données.
 */
export function FilterSummary({
  shown,
  total,
  active,
  onReset,
}: {
  shown: number;
  total: number;
  active: number;
  onReset: () => void;
}) {
  if (active === 0) return null;

  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-control border border-[#F0DFB8] bg-gold-l px-3 py-1.5 text-[12.5px] text-[#9A6410]">
      <span>
        <b className="font-mono">
          {shown} sur {total}
        </b>{" "}
        — {active} filtre(s) de colonne actif(s).
      </span>
      <button type="button" onClick={onReset} className="font-semibold underline">
        Réinitialiser tous les filtres
      </button>
    </div>
  );
}
