"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import type { ActionRow } from "@/lib/api/dashboard";
import { Drawer } from "@/components/ui/drawer";
import { LogForm } from "@/components/activities/log-form";
import { UndoToast, type ToastState } from "@/components/ui/undo-toast";
import { usePersistedSet } from "@/lib/client/persisted";
import { buildSections, visibleOrder } from "@/lib/domain/queue";
import { dayProgress } from "@/lib/domain/progress";
import { runQueueBatch, undoQueueBatch, type QueueBatchRequest } from "@/lib/client/queue-api";
import { ProgressRing } from "../progress-ring";
import { BatchBar, type BatchRequest } from "./batch-bar";
import { QueueSections } from "./sections";
import type { RowIntent } from "./row";
import { Shortcuts } from "./shortcuts";
import { EndOfDay } from "./end-of-day";
import { useQueueKeys } from "./use-queue-keys";

/**
 * La file d'action : un état, une source de vérité, un filet.
 *
 * **L'optimisme est local et réversible.** Une ligne traitée disparaît tout de
 * suite et l'anneau avance : attendre l'aller-retour ferait de chaque geste une
 * pause. Mais la ligne retirée est mémorisée, et un refus du serveur la remet
 * exactement où elle était, avec la raison. L'écran ne ment jamais plus de
 * quelques centaines de millisecondes, et jamais en silence.
 *
 * `done` compte les marques du serveur **plus** les lignes retirées qui figurent
 * encore dans la liste reçue : sitôt le rafraîchissement arrivé, elles ont
 * disparu des deux côtés et le compte ne double pas.
 */
const COLLAPSED_KEY = "queue.collapsed";

export function ActionQueue({
  rows,
  owners,
  defaultOwner,
  sequences,
  serverDone,
  serverPlanned,
  tomorrow,
}: {
  rows: readonly ActionRow[];
  owners: readonly string[];
  defaultOwner: string;
  sequences: ReadonlyArray<{ id: string; name: string }>;
  serverDone: number;
  serverPlanned: number;
  tomorrow: number;
}) {
  const router = useRouter();
  const [removed, setRemoved] = useState<ReadonlySet<string>>(() => new Set());
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [cursor, setCursor] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [logging, setLogging] = useState<ActionRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [collapsed, toggleCollapsed] = usePersistedSet(COLLAPSED_KEY);

  const visible = useMemo(() => rows.filter((row) => !removed.has(row.id)), [rows, removed]);
  const sections = useMemo(() => buildSections(visible), [visible]);
  const order = useMemo(() => visibleOrder(sections, collapsed), [sections, collapsed]);

  const pending = useMemo(
    () => [...removed].filter((id) => rows.some((row) => row.id === id)).length,
    [removed, rows],
  );
  const progress = dayProgress(serverDone + pending, visible.length, serverPlanned + pending);

  const selectedRows = useMemo(
    () => visible.filter((row) => selected.has(row.id)),
    [visible, selected],
  );

  const toggle = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleMany = useCallback((ids: readonly string[]) => {
    setSelected((current) => {
      const next = new Set(current);
      const all = ids.every((id) => next.has(id));
      for (const id of ids) {
        if (all) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }, []);

  const restore = useCallback((ids: readonly string[]) => {
    setRemoved((current) => {
      const next = new Set(current);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, []);

  /** Exécute un lot, en retirant d'abord et en rendant en cas de refus. */
  const run = useCallback(
    async (ids: readonly string[], body: QueueBatchRequest) => {
      if (ids.length === 0) return;
      setBusy(true);
      setRemoved((current) => new Set([...current, ...ids]));
      setSelected(new Set());

      const result = await runQueueBatch(body);
      setBusy(false);

      if (!result.ok) {
        restore(ids);
        setToast({ message: result.message, tone: "error" });
        return;
      }

      const refused = result.data.failed;
      if (refused.length > 0) restore(refused.map((entry) => entry.id));

      const succeeded = ids.filter((id) => !refused.some((entry) => entry.id === id));
      setToast({
        message: result.data.message,
        tone: refused.length > 0 && succeeded.length === 0 ? "error" : "ok",
        onUndo:
          result.data.undo.length === 0
            ? undefined
            : async () => {
                const back = await undoQueueBatch(result.data.undo, succeeded);
                restore(succeeded);
                if (!back.ok) setToast({ message: back.message, tone: "error" });
                router.refresh();
              },
      });

      router.refresh();
    },
    [restore, router],
  );

  const runBatch = useCallback(
    (request: BatchRequest) => {
      const ids = selectedRows.map((row) => row.id);
      const shared = { ids, owner: request.owner, reason: request.reason, sequenceId: request.sequenceId };
      if (request.action === "postpone-3") void run(ids, { ...shared, action: "postpone", days: 3 });
      else if (request.action === "postpone-7") void run(ids, { ...shared, action: "postpone", days: 7 });
      else if (request.action === "complete") void run(ids, { ...shared, action: "complete" });
      else if (request.action === "assign") void run(ids, { ...shared, action: "assign" });
      else if (request.action === "lost") void run(ids, { ...shared, action: "lost" });
      else void run(ids, { ...shared, action: "sequence" });
    },
    [run, selectedRows],
  );

  const onIntent = useCallback(
    (row: ActionRow, intent: RowIntent) => {
      if (intent.kind === "log") {
        setLogging(row);
        return;
      }
      if (intent.kind === "postpone") {
        void run([row.id], { ids: [row.id], action: "postpone", days: intent.days });
        return;
      }
      if (intent.kind === "complete") {
        void run([row.id], { ids: [row.id], action: "complete" });
        return;
      }
      void run([row.id], { ids: [row.id], action: "lost" });
    },
    [run],
  );

  const openRow = useCallback((row: ActionRow) => router.push(hrefOf(row)), [router]);

  useQueueKeys({
    order,
    rows: visible,
    cursor,
    onCursor: setCursor,
    onToggle: toggle,
    onOpen: openRow,
    onLog: setLogging,
  });

  return (
    <>
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex flex-wrap items-baseline gap-2 font-display text-[15px] font-semibold">
          À traiter maintenant
          {visible.length > 0 && (
            <span className="rounded-full bg-paper px-2 py-[1px] font-mono text-[11px] font-normal text-muted tabular-nums">
              {visible.length}
            </span>
          )}
        </h2>
        <ProgressRing progress={progress} />
      </div>

      {visible.length === 0 ? (
        <EndOfDay complete={progress.complete} done={progress.done} tomorrow={tomorrow} />
      ) : (
        <>
          <QueueSections
            sections={sections}
            selected={selected}
            cursor={cursor}
            collapsed={collapsed}
            onToggleCollapse={toggleCollapsed}
            onSelect={toggle}
            onSelectMany={toggleMany}
            onFocus={setCursor}
            onIntent={onIntent}
          />
          <BatchBar
            rows={selectedRows}
            owners={owners}
            sequences={sequences}
            busy={busy}
            onRun={runBatch}
            onClear={() => setSelected(new Set())}
          />
          <Shortcuts />
        </>
      )}

      <UndoToast state={toast} onDismiss={() => setToast(null)} />

      <Drawer
        open={logging !== null}
        title={logging === null ? "" : `Consigner — ${logging.title}`}
        onClose={() => setLogging(null)}
      >
        {logging !== null && logging.contactId !== null && (
          <LogForm
            link={{ contactId: logging.contactId }}
            owners={owners}
            defaultOwner={defaultOwner}
            onCancel={() => setLogging(null)}
            onLogged={(summary) => {
              const id = logging.id;
              setLogging(null);
              setRemoved((current) => new Set([...current, id]));
              setToast({ message: summary, tone: "ok" });
              router.refresh();
            }}
          />
        )}
      </Drawer>
    </>
  );
}

function hrefOf(row: ActionRow): string {
  if (row.contactId !== null) {
    return `/contacts?lifecycle=all&fiche=${encodeURIComponent(row.contactId)}`;
  }
  if (row.dealId !== null) return `/affaires?status=all&fiche=${encodeURIComponent(row.dealId)}`;
  return "/taches";
}
