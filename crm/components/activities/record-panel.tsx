"use client";

import { useCallback, useEffect, useState } from "react";
import type { Alert } from "@/lib/domain/types";
import { fetchJson } from "@/lib/client/activity-api";
import { AlertNotice } from "./alert-notice";
import { LogForm } from "./log-form";
import { linkQuery, type RecordLink } from "./record-link";
import { RunSequence, type SequenceOption } from "./run-sequence";
import { TaskList } from "./task-list";
import { TaskQuickForm } from "./task-quick-form";
import { Timeline } from "./timeline";
import { parseActivity, parseList, parseTask, type ActivityView, type TaskView } from "./types";

/**
 * Bloc « activité » d'une fiche, commun aux trois tiroirs.
 *
 * Les données sont chargées à l'ouverture du tiroir, pas au rendu de la liste :
 * charger la chronologie des dix-huit contacts pour n'en montrer qu'une serait
 * dix-sept requêtes gaspillées à chaque affichage de la page.
 */
export interface RecordPanelProps {
  readonly link: RecordLink;
  readonly owners: readonly string[];
  readonly defaultOwner: string;
  readonly sequences: readonly SequenceOption[];
  readonly alerts: readonly Alert[];
  /**
   * Relance actuellement posée sur la fiche, quand il s'agit d'un contact.
   * Sert à décider si une nouvelle date mérite d'être proposée : écraser une
   * relance plus lointaine, déjà choisie, serait décider à la place de
   * l'utilisateur.
   */
  readonly currentReminder?: Date | null;
  /** Prévient le parent qu'une écriture a eu lieu, pour rafraîchir la vue. */
  readonly onChanged: () => void;
}

type Panel = "none" | "log" | "task" | "sequence";

export function RecordPanel({
  link,
  owners,
  defaultOwner,
  sequences,
  alerts,
  currentReminder = null,
  onChanged,
}: RecordPanelProps) {
  const [activities, setActivities] = useState<readonly ActivityView[]>([]);
  const [tasks, setTasks] = useState<readonly TaskView[]>([]);
  const [panel, setPanel] = useState<Panel>("none");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const query = linkQuery(link);

  const load = useCallback(async () => {
    setLoading(true);
    const [timeline, taskList] = await Promise.all([
      fetchJson(`/api/activities?${query}`),
      fetchJson(`/api/tasks?${query}&scope=open`),
    ]);

    if (timeline.ok) setActivities(parseList(timeline.data, "activities", parseActivity));
    if (taskList.ok) setTasks(parseList(taskList.data, "tasks", parseTask));
    setLoading(false);
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const afterWrite = (message: string) => {
    setPanel("none");
    setNotice(message);
    void load();
    onChanged();
  };

  return (
    <section className="mt-6">
      <AlertNotice alerts={alerts} />

      <div className="mb-3 flex flex-wrap gap-2">
        <Action active={panel === "log"} onClick={() => setPanel(panel === "log" ? "none" : "log")}>
          Consigner une interaction
        </Action>
        <Action
          active={panel === "task"}
          onClick={() => setPanel(panel === "task" ? "none" : "task")}
        >
          Nouvelle tâche
        </Action>
        {sequences.length > 0 && (
          <Action
            active={panel === "sequence"}
            onClick={() => setPanel(panel === "sequence" ? "none" : "sequence")}
          >
            Lancer une séquence
          </Action>
        )}
      </div>

      {notice !== null && panel === "none" && (
        <p className="mb-3 rounded-control border border-[#B9E7DC] bg-flux-l px-3 py-2 text-[12.5px] text-flux-d">
          {notice}
        </p>
      )}

      {panel === "log" && (
        <LogForm
          link={link}
          owners={owners}
          defaultOwner={defaultOwner}
          currentReminder={currentReminder}
          onCancel={() => setPanel("none")}
          onLogged={(summary) => afterWrite(summary)}
        />
      )}

      {panel === "task" && (
        <TaskQuickForm
          link={link}
          owners={owners}
          defaultOwner={defaultOwner}
          onCancel={() => setPanel("none")}
          onCreated={() => afterWrite("Tâche créée, rattachée à cette fiche.")}
        />
      )}

      {panel === "sequence" && (
        <RunSequence
          link={link}
          owners={owners}
          defaultOwner={defaultOwner}
          sequences={sequences}
          onCancel={() => setPanel("none")}
          onRun={(count) => afterWrite(`${count} tâche(s) créée(s) par la séquence.`)}
        />
      )}

      <h3 className="mt-5 mb-2.5 font-display text-sm font-semibold">
        Tâches ouvertes ({tasks.length})
      </h3>
      <TaskList tasks={tasks} onChanged={() => void load()} showTarget={false} />

      <h3 className="mt-5 mb-2.5 font-display text-sm font-semibold">
        Historique des interactions {loading ? "…" : `(${activities.length})`}
      </h3>
      <Timeline activities={activities} />
    </section>
  );
}

function Action({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-control border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
        active
          ? "border-flux bg-flux-l text-flux-d"
          : "border-line bg-surface hover:bg-surface-2"
      }`}
    >
      {children}
    </button>
  );
}
