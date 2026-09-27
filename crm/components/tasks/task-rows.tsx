"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { updateTask } from "@/lib/client/activity-api";
import { daysSince } from "@/lib/domain/dates";
import { kindLabel, type FeedRow } from "@/lib/domain/task-tabs";
import { formatDate } from "@/lib/format";

/**
 * La liste d'un onglet : une ligne par élément de travail, quelle que soit son
 * origine.
 *
 * Une tâche se coche ici même ; un départ, une réponse ou un signal mènent là où
 * le travail se fait — la file des départs, la fiche du contact. Reproduire
 * l'envoi d'un départ dans cette liste ferait deux endroits où valider un même
 * brouillon.
 */
interface TaskRowsProps {
  readonly rows: readonly FeedRow[];
  readonly onChanged: () => void;
}

function dueLabel(row: FeedRow, now: Date): { text: string; late: boolean } | null {
  if (row.due === null) return null;
  const days = daysSince(row.due, now);
  if (days > 0) return { text: `${days} j de retard`, late: true };
  if (days === 0) return { text: "aujourd'hui", late: true };
  return { text: `dans ${-days} j`, late: false };
}

export function TaskRows({ rows, onChanged }: TaskRowsProps) {
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const now = new Date();

  const toggle = async (row: FeedRow) => {
    const id = row.id.replace(/^tache:/, "");
    setPending((state) => ({ ...state, [row.id]: true }));
    setError(null);
    const result = await updateTask(id, { done: true });
    if (result.ok) {
      onChanged();
      return;
    }
    setPending((state) => {
      const copy = { ...state };
      delete copy[row.id];
      return copy;
    });
    setError(result.message);
  };

  return (
    <div className="grid gap-2">
      {error !== null && (
        <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
          {error}
        </p>
      )}

      {rows.map((row) => {
        const due = dueLabel(row, now);
        return (
          <article
            key={row.id}
            className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-3.5 py-3 shadow-card"
          >
            {row.kind === "task" ? (
              <input
                type="checkbox"
                aria-label={`Terminer « ${row.title} »`}
                checked={pending[row.id] === true}
                onChange={() => void toggle(row)}
                className="size-5 shrink-0 accent-brand"
              />
            ) : (
              <span className="shrink-0 text-muted">
                <Icon name="task" size={16} />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <b className="block truncate text-[13.5px] font-semibold">{row.title}</b>
              <span className="text-[12px] text-muted">
                {kindLabel(row.kind)}
                {row.detail !== "" && ` · ${row.detail}`}
                {row.owner !== "" && ` · ${row.owner}`}
                {row.due !== null && ` · ${formatDate(row.due)}`}
              </span>
            </div>

            {due !== null && (
              <span
                className={`shrink-0 text-[12px] ${due.late ? "font-semibold text-danger" : "text-muted"}`}
              >
                {due.text}
              </span>
            )}

            {row.href !== null && (
              <Link
                href={row.href}
                className="shrink-0 rounded-control border border-line px-2.5 py-1.5 text-[12.5px] font-semibold hover:bg-surface-2"
              >
                Ouvrir
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );
}
