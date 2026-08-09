"use client";

import { useState } from "react";
import {
  batchActions,
  BATCH_LABELS,
  blockedBy,
  selectionLabel,
  type BatchAction,
  type QueueRowLike,
} from "@/lib/domain/queue";
import { LOST_REASONS } from "@/lib/domain/lost";

/**
 * La barre d'actions groupées — la raison d'être de tout ce jalon.
 *
 * « Ce n'est pas dix décisions, c'en est une. » Dix relances du même lot de
 * juillet se reportent d'un geste ; l'écran cesse de facturer dix fois la même
 * pensée.
 *
 * Elle n'offre que les actions applicables à **toute** la sélection, et dit
 * pourquoi les autres manquent au lieu de les faire disparaître sans un mot —
 * un bouton absent sans explication se lit comme une panne.
 */
export interface BatchRequest {
  readonly action: BatchAction;
  readonly reason?: string;
  readonly owner?: string;
  readonly sequenceId?: string;
}

const BUTTON =
  "rounded-control border border-white/25 bg-white/10 px-2.5 py-1 text-[11.5px] font-semibold text-white transition-colors hover:bg-white/20 disabled:opacity-40";

export function BatchBar({
  rows,
  owners,
  sequences,
  busy,
  onRun,
  onClear,
}: {
  rows: readonly QueueRowLike[];
  owners: readonly string[];
  sequences: ReadonlyArray<{ id: string; name: string }>;
  busy: boolean;
  onRun: (request: BatchRequest) => void;
  onClear: () => void;
}) {
  const [prompt, setPrompt] = useState<BatchAction | null>(null);

  if (rows.length === 0) return null;

  const available = batchActions(rows);
  const missing = (["lost", "sequence", "complete"] as const).filter(
    (action) => !available.includes(action) && blockedBy(rows, action) > 0,
  );

  const run = (request: BatchRequest) => {
    setPrompt(null);
    onRun(request);
  };

  return (
    <div className="sticky bottom-3 z-30 mt-2 flex flex-wrap items-center gap-2 rounded-card bg-ink px-3 py-2 text-white shadow-float">
      <b className="text-[12.5px] font-semibold">{selectionLabel(rows.length)}</b>
      <span aria-hidden className="h-4 w-px bg-white/20" />

      {available.includes("postpone-3") && (
        <button type="button" className={BUTTON} disabled={busy} onClick={() => run({ action: "postpone-3" })}>
          Reporter à +3 j
        </button>
      )}
      {available.includes("postpone-7") && (
        <button type="button" className={BUTTON} disabled={busy} onClick={() => run({ action: "postpone-7" })}>
          Reporter à +7 j
        </button>
      )}
      {available.includes("complete") && (
        <button type="button" className={BUTTON} disabled={busy} onClick={() => run({ action: "complete" })}>
          Marquer fait
        </button>
      )}

      {available.includes("sequence") && sequences.length > 0 && (
        <Picker
          label={BATCH_LABELS.sequence}
          open={prompt === "sequence"}
          busy={busy}
          onOpen={() => setPrompt(prompt === "sequence" ? null : "sequence")}
          options={sequences.map((sequence) => ({ value: sequence.id, label: sequence.name }))}
          onPick={(sequenceId) => run({ action: "sequence", sequenceId })}
        />
      )}

      {available.includes("assign") && owners.length > 0 && (
        <Picker
          label={BATCH_LABELS.assign}
          open={prompt === "assign"}
          busy={busy}
          onOpen={() => setPrompt(prompt === "assign" ? null : "assign")}
          options={owners.map((owner) => ({ value: owner, label: owner }))}
          onPick={(owner) => run({ action: "assign", owner })}
        />
      )}

      {available.includes("lost") && (
        // Le motif est demandé, jamais deviné : « perdu » sans raison est une
        // information qu'on regrette six mois plus tard, quand on cherche ce qui
        // ne marche pas dans le discours.
        <Picker
          label={BATCH_LABELS.lost}
          open={prompt === "lost"}
          busy={busy}
          danger
          onOpen={() => setPrompt(prompt === "lost" ? null : "lost")}
          options={LOST_REASONS.map((reason) => ({ value: reason, label: reason }))}
          onPick={(reason) => run({ action: "lost", reason })}
        />
      )}

      <span className="flex-1" />

      {missing.length > 0 && (
        <span className="text-[11px] text-white/60">
          {missing.map((action) => BATCH_LABELS[action].toLowerCase()).join(", ")} : ne s'applique
          pas à toute la sélection
        </span>
      )}

      <button type="button" className={BUTTON} onClick={onClear}>
        Désélectionner
      </button>
    </div>
  );
}

function Picker({
  label,
  open,
  busy,
  danger = false,
  onOpen,
  options,
  onPick,
}: {
  label: string;
  open: boolean;
  busy: boolean;
  danger?: boolean;
  onOpen: () => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  onPick: (value: string) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        disabled={busy}
        aria-expanded={open}
        className={`${BUTTON} ${danger ? "text-[#FFC9C0]" : ""}`}
        onClick={onOpen}
      >
        {label}
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-40 mb-1 max-h-64 w-56 overflow-y-auto rounded-card border border-line bg-surface py-1 text-ink shadow-float">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className="block w-full px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-surface-2"
              onClick={() => onPick(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
