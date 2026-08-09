"use client";

import { useState } from "react";
import { runSequence } from "@/lib/client/activity-api";
import type { RecordLink } from "./record-link";

/**
 * Lancement d'une séquence sur la fiche ouverte.
 *
 * L'aperçu annonce le nombre d'étapes et la date de la dernière avant d'écrire :
 * une séquence crée d'un coup six tâches datées, et les défaire une par une
 * coûte bien plus cher que de les avoir lues avant.
 */
export interface SequenceOption {
  readonly id: string;
  readonly name: string;
  readonly trigger: string;
  readonly active: boolean;
  readonly steps: ReadonlyArray<{ readonly day: number; readonly label: string }>;
}

interface RunSequenceProps {
  readonly link: RecordLink;
  readonly owners: readonly string[];
  readonly defaultOwner: string;
  readonly sequences: readonly SequenceOption[];
  readonly onCancel: () => void;
  readonly onRun: (created: number) => void;
}

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[13.5px] outline-none focus:border-flux";

function isoDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RunSequence({
  link,
  owners,
  defaultOwner,
  sequences,
  onCancel,
  onRun,
}: RunSequenceProps) {
  const active = sequences.filter((sequence) => sequence.active);
  const [choice, setChoice] = useState(active[0]?.id ?? "");
  const [start, setStart] = useState(isoDay());
  const [owner, setOwner] = useState(defaultOwner);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = active.find((sequence) => sequence.id === choice) ?? null;
  const lastDay =
    selected === null || selected.steps.length === 0
      ? 0
      : Math.max(...selected.steps.map((step) => step.day));

  const run = async () => {
    if (selected === null) return;
    setBusy(true);
    setError(null);

    const result = await runSequence(selected.id, { ...link, owner, start });
    setBusy(false);
    if (result.ok) onRun(result.data.created);
    else setError(result.message);
  };

  if (active.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
        Aucune séquence active. Réactivez-en une dans Réglages.
      </p>
    );
  }

  return (
    <div className="grid gap-3 rounded-card border border-line bg-surface-2 px-3.5 py-3.5">
      <label className="block">
        <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
          Séquence
        </span>
        <select value={choice} onChange={(e) => setChoice(e.target.value)} className={CONTROL}>
          {active.map((sequence) => (
            <option key={sequence.id} value={sequence.id}>
              {sequence.name}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
            Départ
          </span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={CONTROL}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
            Propriétaire
          </span>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className={CONTROL}>
            {owners.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>

      {selected !== null && (
        <div className="rounded-control border border-line bg-surface px-3 py-2.5 text-[12.5px]">
          <b>{selected.steps.length} étape(s)</b> sur {lastDay} jours ·{" "}
          <span className="text-muted">{selected.trigger}</span>
          <ul className="mt-1.5 grid gap-0.5 text-muted">
            {[...selected.steps]
              .sort((a, b) => a.day - b.day)
              .map((step, index) => (
                <li key={`${step.day}-${index}`}>
                  J+{step.day} — {step.label}
                </li>
              ))}
          </ul>
        </div>
      )}

      {error !== null && (
        <p className="rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || selected === null}
          onClick={() => void run()}
          className="rounded-control bg-flux px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-flux-d disabled:opacity-45"
        >
          {busy ? "Lancement…" : `Créer ${selected?.steps.length ?? 0} tâche(s)`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-control border border-line px-4 py-2 text-[13px] font-semibold transition-colors hover:bg-surface-2"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
