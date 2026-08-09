"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { TaskList } from "@/components/activities/task-list";
import type { TaskView } from "@/components/activities/types";
import { Drawer } from "@/components/ui/drawer";
import { Icon } from "@/components/ui/icon";
import { taskBucket, type TaskBucket } from "@/lib/domain/tasks";
import { TaskFullForm } from "./task-full-form";

/**
 * Vue Tâches, groupée par urgence.
 *
 * Le regroupement vient de `taskBucket()` (domaine, pur, testé) et se calcule au
 * rendu client : l'horloge du navigateur est celle de l'utilisateur, et une
 * tâche « aujourd'hui » doit l'être dans son fuseau, pas dans celui du serveur.
 */
interface TasksViewProps {
  readonly tasks: readonly TaskView[];
  readonly owners: readonly string[];
  readonly targets: TaskTargets;
}

export interface TaskTargets {
  readonly contacts: ReadonlyArray<{ readonly id: string; readonly label: string }>;
  readonly companies: ReadonlyArray<{ readonly id: string; readonly label: string }>;
  readonly deals: ReadonlyArray<{ readonly id: string; readonly label: string }>;
}

/** Ordre d'affichage : le plus urgent d'abord, les terminées en dernier. */
const BUCKETS: readonly TaskBucket[] = [
  "En retard",
  "Aujourd'hui",
  "Cette semaine",
  "Plus tard",
  "Terminées",
];

const CONTROL =
  "rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-flux";

export function TasksView({ tasks, owners, targets }: TasksViewProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);

  const scope = params.get("scope") ?? "open";

  const setParam = useCallback(
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

  const refresh = () => {
    setCreating(false);
    router.refresh();
  };

  const now = new Date();
  const grouped = new Map<TaskBucket, TaskView[]>();
  for (const task of tasks) {
    const bucket = taskBucket({ ...task }, now);
    grouped.set(bucket, [...(grouped.get(bucket) ?? []), task]);
  }

  const late = grouped.get("En retard")?.length ?? 0;

  return (
    <div className="px-6 py-6">
      <header className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Tâches</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {tasks.length} tâches affichées
            {late > 0 && <span className="font-semibold text-[#B2311F]"> · {late} en retard</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-control bg-flux px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-flux-d"
        >
          <Icon name="plus" size={15} />
          Nouvelle tâche
        </button>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-control border border-line bg-surface">
          {[
            { value: "open", label: "À faire" },
            { value: "done", label: "Terminées" },
            { value: "all", label: "Toutes" },
          ].map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setParam({ scope: filter.value })}
              className={`border-r border-line px-3 py-1.5 text-[12.5px] font-semibold transition-colors last:border-r-0 ${
                scope === filter.value ? "bg-ink text-white" : "text-muted hover:bg-surface-2"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <input
          className={`${CONTROL} min-w-[220px]`}
          placeholder="Rechercher une tâche…"
          defaultValue={params.get("q") ?? ""}
          onChange={(event) => setParam({ q: event.target.value })}
        />

        <select
          className={CONTROL}
          value={params.get("owner") ?? ""}
          onChange={(event) => setParam({ owner: event.target.value })}
        >
          <option value="">Tous les propriétaires</option>
          {owners.map((owner) => (
            <option key={owner}>{owner}</option>
          ))}
        </select>
      </div>

      {tasks.length === 0 ? (
        <div className="rounded-card border border-line bg-surface px-5 py-11 text-center shadow-card">
          <b className="mb-1.5 block font-display text-[15px]">Aucune tâche ne correspond.</b>
          <span className="text-[13px] text-muted">
            Créez-en une, ou consignez une interaction avec une « prochaine action » depuis
            une fiche.
          </span>
        </div>
      ) : (
        <div className="grid gap-5">
          {BUCKETS.map((bucket) => {
            const group = grouped.get(bucket) ?? [];
            if (group.length === 0) return null;

            return (
              <section key={bucket}>
                <h2 className="mb-2 flex items-center gap-2 font-display text-sm font-semibold">
                  <span className={bucket === "En retard" ? "text-[#B2311F]" : undefined}>
                    {bucket}
                  </span>
                  <span className="rounded-full bg-paper px-2 py-[1px] font-mono text-[11px] text-muted">
                    {group.length}
                  </span>
                </h2>
                <TaskList tasks={group} onChanged={refresh} />
              </section>
            );
          })}
        </div>
      )}

      <Drawer open={creating} title="Nouvelle tâche" onClose={() => setCreating(false)}>
        <TaskFullForm
          owners={owners}
          targets={targets}
          onCancel={() => setCreating(false)}
          onCreated={refresh}
        />
      </Drawer>
    </div>
  );
}
