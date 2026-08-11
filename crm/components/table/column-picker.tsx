"use client";

import { useEffect, useState } from "react";

/**
 * Le sélecteur de colonnes.
 *
 * Neuf colonnes affichées en permanence, c'est neuf colonnes qu'on ne compare
 * jamais. Celles qu'on garde relèvent de l'usage de chacun — d'où un choix, et
 * un choix **conservé** : le refaire à chaque visite en ferait un réglage
 * qu'on n'utilise pas.
 */
export interface PickableColumn {
  readonly key: string;
  readonly label: string;
}

export function ColumnPicker({
  columns,
  visible,
  locked,
  onToggle,
  onReset,
}: {
  columns: readonly PickableColumn[];
  visible: ReadonlySet<string>;
  /** Colonne qu'on ne peut pas retirer — le nom, ici. */
  locked: string;
  onToggle: (key: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  const count = columns.filter((column) => visible.has(column.key)).length;

  return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-surface-2"
      >
        Colonnes{" "}
        <span className="font-mono text-[11px] font-normal text-muted tabular-nums">
          {count}/{columns.length}
        </span>
      </button>

      {open && (
        <div className="absolute top-full right-0 z-30 mt-1 w-56 rounded-card border border-line bg-surface py-1 shadow-float">
          {columns.map((column) => {
            const isLocked = column.key === locked;
            return (
              <label
                key={column.key}
                className={`flex items-center gap-2 px-3 py-1.5 text-[12.5px] ${
                  isLocked ? "opacity-50" : "cursor-pointer hover:bg-surface-2"
                }`}
              >
                <input
                  type="checkbox"
                  checked={visible.has(column.key)}
                  disabled={isLocked}
                  onChange={() => onToggle(column.key)}
                  className="size-3.5 accent-brand-d"
                />
                {column.label}
              </label>
            );
          })}
          <button
            type="button"
            onClick={onReset}
            className="mt-1 w-full border-t border-line px-3 py-1.5 text-left text-[12px] text-muted transition-colors hover:bg-surface-2"
          >
            Revenir aux colonnes par défaut
          </button>
        </div>
      )}
    </div>
  );
}
