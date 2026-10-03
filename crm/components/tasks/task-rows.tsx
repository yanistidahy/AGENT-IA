"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { updateTask } from "@/lib/client/activity-api";
import { markCallDone } from "@/lib/client/task-api";
import { daysSince } from "@/lib/domain/dates";
import { dialHref } from "@/lib/domain/task-kind";
import { TASK_KIND_LABELS, type TaskRow } from "@/lib/domain/task-tabs";
import { formatDate } from "@/lib/format";

/**
 * La liste d'un onglet : une ligne par tâche, **et rien que des tâches**.
 *
 * Une tâche d'appel porte deux gestes de plus, et c'est le seul type qui en a :
 * le numéro du contact devient un bouton d'appel, et « Appel passé » coche la
 * tâche **en consignant l'appel**. Les deux écritures partent ensemble par
 * `POST /api/tasks/<id>/appel` — cocher sans consigner perdrait le seul fait qui
 * compte, qu'on a bien appelé, et c'est ce que le CRM existe pour empêcher.
 *
 * Le bouton d'appel n'apparaît que sur un numéro **composable** (`dialHref`) :
 * un champ libre peut porter « à demander au standard », et un lien `tel:` sur
 * cette phrase ne composerait rien tout en ayant l'air d'un bouton.
 */
interface TaskRowsProps {
  readonly rows: readonly TaskRow[];
  readonly onChanged: () => void;
}

function dueLabel(row: TaskRow, now: Date): { text: string; late: boolean } | null {
  if (row.done) return null;
  const days = daysSince(row.due, now);
  if (days > 0) return { text: `${days} j de retard`, late: true };
  if (days === 0) return { text: "aujourd'hui", late: true };
  return { text: `dans ${-days} j`, late: false };
}

export function TaskRows({ rows, onChanged }: TaskRowsProps) {
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const now = new Date();

  const toggle = async (row: TaskRow) => {
    setBusy((state) => ({ ...state, [row.id]: true }));
    setError(null);
    const result = await updateTask(row.id, { done: !row.done });
    if (result.ok) {
      onChanged();
      return;
    }
    setBusy((state) => {
      const copy = { ...state };
      delete copy[row.id];
      return copy;
    });
    setError(result.message);
  };

  const callDone = async (row: TaskRow) => {
    setBusy((state) => ({ ...state, [row.id]: true }));
    setError(null);
    const result = await markCallDone(row.id);
    if (result.ok) {
      onChanged();
      return;
    }
    setBusy((state) => {
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
        const dial = row.kind === "appel" ? dialHref(row.contactPhone) : null;
        return (
          <article
            key={row.id}
            data-task={row.id}
            data-kind={row.kind}
            className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-3.5 py-3 shadow-card"
          >
            <input
              type="checkbox"
              aria-label={`${row.done ? "Rouvrir" : "Terminer"} « ${row.title} »`}
              checked={row.done || busy[row.id] === true}
              onChange={() => void toggle(row)}
              className="size-5 shrink-0 accent-brand"
            />

            <div className="min-w-0 flex-1">
              <b
                className={`block truncate text-[13.5px] font-semibold ${
                  row.done ? "text-muted line-through" : ""
                }`}
              >
                {row.title}
              </b>
              <span className="text-[12px] text-muted">
                {TASK_KIND_LABELS[row.kind]}
                {row.detail !== "" && ` · ${row.detail}`}
                {row.assignee !== "" && ` · ${row.assignee}`}
                {` · ${formatDate(row.done && row.doneAt !== null ? row.doneAt : row.due)}`}
              </span>
            </div>

            {due !== null && (
              <span
                className={`shrink-0 text-[12px] ${
                  due.late ? "font-semibold text-danger" : "text-muted"
                }`}
              >
                {due.text}
              </span>
            )}

            {/*
              **Le numéro, composable d'un geste.** 44 px de haut comme toute
              cible tactile depuis le jalon 46 : c'est un bouton qu'on presse en
              marchant, pas un lien qu'on lit.
            */}
            {dial !== null && !row.done && (
              <a
                href={dial}
                data-dial="1"
                aria-label={`Appeler ${row.contactName} au ${row.contactPhone}`}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-control border border-line px-2.5 py-1.5 text-[12.5px] font-semibold hover:bg-surface-2 lg:min-h-0"
              >
                <Icon name="phone" size={14} />
                {row.contactPhone}
              </a>
            )}

            {row.kind === "appel" && row.contactId !== null && !row.done && (
              <button
                type="button"
                data-call-done="1"
                disabled={busy[row.id] === true}
                onClick={() => void callDone(row)}
                className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-control bg-brand px-2.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-d disabled:opacity-50 lg:min-h-0"
              >
                <Icon name="check" size={14} />
                Appel passé
              </button>
            )}

            {row.href !== null && (
              <Link
                href={row.href}
                className="inline-flex min-h-[44px] shrink-0 items-center rounded-control border border-line px-2.5 py-1.5 text-[12.5px] font-semibold hover:bg-surface-2 lg:min-h-0"
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
