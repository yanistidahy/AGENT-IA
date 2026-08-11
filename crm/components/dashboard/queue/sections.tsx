"use client";

import type { ActionRow } from "@/lib/api/dashboard";
import type { QueueSection } from "@/lib/domain/queue";
import { QueueRow, type RowIntent } from "./row";

/**
 * Le corps de la file : sections, regroupements par société, lignes.
 *
 * Séparé de la logique pour que celle-ci reste lisible — l'état de la file
 * (sélection, curseur, optimisme, annulation) et son rendu ne se relisent pas
 * avec les mêmes questions en tête.
 *
 * Les en-têtes de section **collent** au haut de la zone : sur une file longue,
 * savoir si la ligne qu'on regarde est une relance ou une tâche en retard ne
 * doit pas demander de remonter.
 */
export function QueueSections({
  sections,
  selected,
  cursor,
  collapsed,
  onToggleCollapse,
  onSelect,
  onSelectMany,
  onFocus,
  onIntent,
}: {
  sections: readonly QueueSection<ActionRow>[];
  selected: ReadonlySet<string>;
  cursor: string | null;
  collapsed: ReadonlySet<string>;
  onToggleCollapse: (key: string) => void;
  onSelect: (id: string) => void;
  onSelectMany: (ids: readonly string[]) => void;
  onFocus: (id: string) => void;
  onIntent: (row: ActionRow, intent: RowIntent) => void;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      {sections.map((section) => (
        <section key={section.group}>
          <h3 className="sticky top-0 z-10 flex items-center gap-2 border-b border-line bg-surface-2/95 px-2.5 py-1.5 font-mono text-[10px] tracking-[0.12em] text-muted uppercase backdrop-blur">
            {section.label}
            <span className="font-sans text-[10px] tracking-normal normal-case">
              ({section.count})
            </span>
          </h3>

          <ul>
            {section.clusters.map((cluster) => {
              if (!cluster.clustered) {
                const row = cluster.rows[0];
                if (row === undefined) return null;
                return (
                  <QueueRow
                    key={row.id}
                    row={row}
                    selected={selected.has(row.id)}
                    focused={cursor === row.id}
                    onSelect={() => onSelect(row.id)}
                    onFocus={() => onFocus(row.id)}
                    onIntent={(intent) => onIntent(row, intent)}
                  />
                );
              }

              const ids = cluster.rows.map((row) => row.id);
              const allSelected = ids.every((id) => selected.has(id));
              const shut = collapsed.has(cluster.key);

              return (
                <li key={cluster.key}>
                  {/* Plusieurs contacts d'une même société sont une seule
                      conversation : les replier rend visible qu'il y a là une
                      décision, pas six. */}
                  <div className="flex h-9 items-center gap-2.5 border-b border-line-2 bg-paper/60 px-2.5">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => onSelectMany(ids)}
                      aria-label={`Sélectionner les ${ids.length} lignes de ${cluster.company ?? ""}`}
                      className="size-3.5 shrink-0 accent-brand-d"
                    />
                    <button
                      type="button"
                      aria-expanded={!shut}
                      onClick={() => onToggleCollapse(cluster.key)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                      <span aria-hidden className="text-[10px] text-muted">
                        {shut ? "▸" : "▾"}
                      </span>
                      <b className="truncate text-[12.5px] font-semibold">{cluster.company}</b>
                      <span className="shrink-0 rounded-full bg-surface px-1.5 font-mono text-[10px] text-muted">
                        {ids.length}
                      </span>
                    </button>
                  </div>

                  {!shut && (
                    <ul>
                      {cluster.rows.map((row) => (
                        <QueueRow
                          key={row.id}
                          row={row}
                          selected={selected.has(row.id)}
                          focused={cursor === row.id}
                          onSelect={() => onSelect(row.id)}
                          onFocus={() => onFocus(row.id)}
                          onIntent={(intent) => onIntent(row, intent)}
                        />
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
