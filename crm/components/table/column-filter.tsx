"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DATE_PRESETS,
  DATE_PRESET_LABELS,
  VOID,
  type ColumnFilter,
  type ColumnSpec,
} from "@/lib/domain/column-filters";
import type { FacetValue } from "@/lib/domain/column-match";

/**
 * Menu de filtre d'une colonne, à la manière d'un tableur.
 *
 * Un seul composant pour les quatre tableaux : il ne connaît que le type de la
 * colonne et la liste des valeurs présentes. Les valeurs et leurs comptes
 * arrivent **du serveur** — le navigateur ne reçoit jamais la table entière, il
 * reçoit la liste des valeurs distinctes, qui reste courte quand les lignes se
 * comptent par milliers.
 */
interface ColumnFilterProps {
  readonly column: ColumnSpec;
  readonly facets: readonly FacetValue[];
  readonly value: ColumnFilter | null;
  readonly onChange: (filter: ColumnFilter | null) => void;
}

const INPUT =
  "w-full rounded-control border border-line bg-surface px-2 py-1 text-[12.5px] outline-none focus:border-flux";

export function ColumnFilterMenu({ column, facets, value, onChange }: ColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const box = useRef<HTMLDivElement>(null);

  const active = value !== null;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (box.current !== null && !box.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const selected = useMemo(
    () => new Set(value !== null && value.kind === "text" ? value.values : []),
    [value],
  );

  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (needle === "") return facets;
    return facets.filter((facet) => facet.value.toLowerCase().includes(needle));
  }, [facets, search]);

  const toggle = (candidate: string) => {
    const next = new Set(selected);
    if (next.has(candidate)) next.delete(candidate);
    else next.add(candidate);
    onChange(next.size === 0 ? null : { kind: "text", values: [...next] });
  };

  return (
    <span className="relative inline-flex" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={`Filtrer ${column.label}`}
        title={active ? `Filtre actif sur ${column.label}` : `Filtrer ${column.label}`}
        className={`ml-1 inline-flex size-[18px] items-center justify-center rounded-[4px] border text-[10px] transition-colors ${
          active
            ? "border-flux bg-flux text-white"
            : "border-transparent text-muted hover:border-line hover:bg-surface-2"
        }`}
      >
        {/* Entonnoir plein quand un filtre est posé : la colonne filtrée se
            repère d'un coup d'œil, sans avoir à ouvrir les menus un par un. */}
        <svg viewBox="0 0 10 10" className="size-[10px]" aria-hidden>
          <path
            d="M0.5 1.5h9L6 5.5v3.2L4 7.6V5.5z"
            fill={active ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute top-6 left-0 z-30 w-[260px] rounded-card border border-line bg-surface p-2.5 text-left shadow-lg">
          {column.kind === "text" && (
            <>
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher une valeur…"
                className={`${INPUT} mb-2`}
              />
              <div className="mb-2 flex gap-2 text-[11.5px]">
                <button
                  type="button"
                  className="underline hover:text-flux-d"
                  onClick={() =>
                    onChange({ kind: "text", values: shown.map((facet) => facet.value) })
                  }
                >
                  Tout sélectionner
                </button>
                <button
                  type="button"
                  className="underline hover:text-flux-d"
                  onClick={() => onChange(null)}
                >
                  Tout effacer
                </button>
              </div>
              <ul className="max-h-[240px] overflow-y-auto">
                {shown.length === 0 && (
                  <li className="px-1 py-2 text-[12px] text-muted">Aucune valeur.</li>
                )}
                {shown.map((facet) => (
                  <li key={facet.value}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-control px-1 py-1 text-[12.5px] hover:bg-surface-2">
                      <input
                        type="checkbox"
                        checked={selected.has(facet.value)}
                        onChange={() => toggle(facet.value)}
                      />
                      <span className={`flex-1 truncate ${facet.value === VOID ? "text-muted italic" : ""}`}>
                        {facet.value}
                      </span>
                      <span className="font-mono text-[11px] text-muted">{facet.count}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}

          {column.kind === "date" && (
            <DateFilterBody value={value} onChange={onChange} />
          )}

          {column.kind === "number" && (
            <NumberFilterBody value={value} onChange={onChange} />
          )}
        </div>
      )}
    </span>
  );
}

function DateFilterBody({
  value,
  onChange,
}: {
  value: ColumnFilter | null;
  onChange: (filter: ColumnFilter | null) => void;
}) {
  const current = value !== null && value.kind === "date" ? value : null;

  return (
    <>
      <ul className="mb-2 grid gap-0.5">
        {DATE_PRESETS.map((preset) => (
          <li key={preset}>
            <button
              type="button"
              onClick={() =>
                onChange(
                  current?.preset === preset
                    ? null
                    : { kind: "date", preset, from: null, to: null },
                )
              }
              className={`w-full rounded-control px-2 py-1 text-left text-[12.5px] transition-colors ${
                current?.preset === preset ? "bg-flux-l text-flux-d" : "hover:bg-surface-2"
              }`}
            >
              {DATE_PRESET_LABELS[preset]}
            </button>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-1.5 border-t border-line pt-2">
        <input
          type="date"
          aria-label="Depuis"
          value={current?.from ?? ""}
          onChange={(event) =>
            onChange({
              kind: "date",
              preset: null,
              from: event.target.value === "" ? null : event.target.value,
              to: current?.to ?? null,
            })
          }
          className={INPUT}
        />
        <input
          type="date"
          aria-label="Jusqu'au"
          value={current?.to ?? ""}
          onChange={(event) =>
            onChange({
              kind: "date",
              preset: null,
              from: current?.from ?? null,
              to: event.target.value === "" ? null : event.target.value,
            })
          }
          className={INPUT}
        />
      </div>
      <button
        type="button"
        onClick={() => onChange(null)}
        className="mt-2 text-[11.5px] underline hover:text-flux-d"
      >
        Tout effacer
      </button>
    </>
  );
}

function NumberFilterBody({
  value,
  onChange,
}: {
  value: ColumnFilter | null;
  onChange: (filter: ColumnFilter | null) => void;
}) {
  const current = value !== null && value.kind === "number" ? value : null;

  const update = (part: "min" | "max", raw: string) => {
    const parsed = raw === "" ? null : Number(raw);
    const next = {
      kind: "number" as const,
      min: part === "min" ? parsed : (current?.min ?? null),
      max: part === "max" ? parsed : (current?.max ?? null),
    };
    onChange(next.min === null && next.max === null ? null : next);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-1.5">
        <input
          type="number"
          placeholder="Minimum"
          aria-label="Minimum"
          value={current?.min ?? ""}
          onChange={(event) => update("min", event.target.value)}
          className={INPUT}
        />
        <input
          type="number"
          placeholder="Maximum"
          aria-label="Maximum"
          value={current?.max ?? ""}
          onChange={(event) => update("max", event.target.value)}
          className={INPUT}
        />
      </div>
      <button
        type="button"
        onClick={() => onChange(null)}
        className="mt-2 text-[11.5px] underline hover:text-flux-d"
      >
        Tout effacer
      </button>
    </>
  );
}
