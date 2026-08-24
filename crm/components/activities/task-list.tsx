"use client";

import Link from "next/link";
import { useState } from "react";
import { updateTask } from "@/lib/client/activity-api";
import { daysSince } from "@/lib/domain/dates";
import type { TaskPriority } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";
import type { TaskView } from "./types";

/**
 * Liste de tâches cochables.
 *
 * La coche est optimiste : l'état bascule avant la réponse réseau et revient en
 * arrière en cas d'échec. Une case qui met une seconde à réagir donne
 * l'impression que le clic n'a pas pris, et l'utilisateur clique deux fois.
 */
interface TaskListProps {
  readonly tasks: readonly TaskView[];
  readonly onChanged: () => void;
  /** Masqué dans les tiroirs : la fiche concernée est déjà celle qu'on regarde. */
  readonly showTarget?: boolean;
}

const PRIORITY_DOTS: Record<TaskPriority, string> = {
  haute: "bg-pulse",
  normale: "bg-gold",
  basse: "bg-line",
};

export function TaskList({ tasks, onChanged, showTarget = true }: TaskListProps) {
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const now = new Date();

  if (tasks.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
        Aucune tâche ouverte.
      </p>
    );
  }

  const toggle = async (task: TaskView) => {
    const next = !task.done;
    setPending((state) => ({ ...state, [task.id]: next }));
    setError(null);

    const result = await updateTask(task.id, { done: next });
    if (result.ok) {
      onChanged();
    } else {
      setPending((state) => {
        const copy = { ...state };
        delete copy[task.id];
        return copy;
      });
      setError(result.message);
    }
  };

  return (
    <>
      {error !== null && (
        <p className="mb-2 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}
      <ul className="grid gap-1.5">
        {tasks.map((task) => {
          const done = pending[task.id] ?? task.done;
          const late = !done && daysSince(task.due, now) > 0;

          return (
            <li
              key={task.id}
              className="flex flex-wrap items-center gap-2.5 rounded-card border border-line bg-surface px-3 py-2 text-[13px]"
            >
              <input
                type="checkbox"
                checked={done}
                onChange={() => void toggle(task)}
                aria-label={`Terminer « ${task.title} »`}
                // 20 px de case sous `lg` : cocher une tâche au pouce est le
                // geste central de /taches en mobilité.
                className="shrink-0 accent-brand max-lg:size-5 lg:size-4"
              />
              <span
                aria-hidden
                className={`size-1.5 shrink-0 rounded-full ${PRIORITY_DOTS[task.priority]}`}
                title={`Priorité ${task.priority}`}
              />
              <span className={done ? "text-muted line-through" : "font-medium"}>
                {task.title}
              </span>

              {showTarget && task.target !== null && (
                <Link
                  href={task.target.href}
                  className="rounded-full bg-paper px-2 py-[2px] text-[11.5px] text-muted hover:text-ink hover:underline"
                >
                  {task.target.label}
                </Link>
              )}

              <span
                className={`ml-auto font-mono text-[11.5px] ${
                  late ? "font-semibold text-[#B2311F]" : "text-muted"
                }`}
              >
                {formatDate(task.due)}
                {late && ` · ${daysSince(task.due, now)} j de retard`}
              </span>
              <span className="text-[11.5px] text-muted">{task.owner}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
