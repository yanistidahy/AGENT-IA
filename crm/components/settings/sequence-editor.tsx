"use client";

import { useState } from "react";
import { updateSequence } from "@/lib/client/activity-api";
import { SEQUENCE_CHANNELS, type SequenceChannel } from "@/lib/domain/types";

/**
 * Éditeur d'une séquence : nom, description du déclencheur, activation, étapes.
 *
 * Les étapes sont envoyées en bloc. Modifier une séquence ne touche pas aux
 * tâches déjà créées par un lancement passé : une relance planifiée hier reste
 * planifiée, même si le modèle change aujourd'hui.
 */
export interface SequenceEditable {
  readonly id: string;
  readonly name: string;
  readonly trigger: string;
  readonly active: boolean;
  readonly steps: ReadonlyArray<{
    readonly day: number;
    readonly channel: SequenceChannel;
    readonly label: string;
  }>;
}

interface StepDraft {
  day: number;
  channel: SequenceChannel;
  label: string;
}

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";

const CHANNEL_LABELS: Record<SequenceChannel, string> = {
  email: "Email",
  call: "Appel",
  linkedin: "LinkedIn",
};

export function SequenceEditor({
  sequence,
  onSaved,
}: {
  sequence: SequenceEditable;
  onSaved: () => void;
}) {
  const [name, setName] = useState(sequence.name);
  const [trigger, setTrigger] = useState(sequence.trigger);
  const [active, setActive] = useState(sequence.active);
  const [steps, setSteps] = useState<StepDraft[]>(sequence.steps.map((step) => ({ ...step })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const patchStep = (index: number, patch: Partial<StepDraft>) => {
    setSaved(false);
    setSteps((current) =>
      current.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    );
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const result = await updateSequence(sequence.id, { name, trigger, active, steps });
    setBusy(false);
    if (result.ok) {
      setSaved(true);
      onSaved();
    } else {
      setError(result.message);
    }
  };

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="grid gap-2.5 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
            Nom
          </span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            className={CONTROL}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
            Déclencheur
          </span>
          <input
            value={trigger}
            onChange={(e) => {
              setTrigger(e.target.value);
              setSaved(false);
            }}
            className={CONTROL}
          />
        </label>
        <label className="flex items-end gap-2 pb-1.5 text-[13px]">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => {
              setActive(e.target.checked);
              setSaved(false);
            }}
            className="size-4 accent-brand"
          />
          Active
        </label>
      </div>

      <div className="mt-3 grid gap-1.5">
        {steps.map((step, index) => (
          <div key={index} className="grid grid-cols-[80px_110px_1fr_auto] items-center gap-2">
            <label className="flex items-center gap-1 text-[12.5px] text-muted">
              J+
              <input
                type="number"
                min={0}
                value={step.day}
                onChange={(e) => patchStep(index, { day: Number(e.target.value) })}
                className={CONTROL}
              />
            </label>
            <select
              value={step.channel}
              onChange={(e) => {
                const value = e.target.value;
                const channel = SEQUENCE_CHANNELS.find((c) => c === value) ?? "email";
                patchStep(index, { channel });
              }}
              className={CONTROL}
            >
              {SEQUENCE_CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {CHANNEL_LABELS[channel]}
                </option>
              ))}
            </select>
            <input
              value={step.label}
              onChange={(e) => patchStep(index, { label: e.target.value })}
              className={CONTROL}
            />
            <button
              type="button"
              onClick={() => {
                setSaved(false);
                setSteps((current) => current.filter((_, i) => i !== index));
              }}
              aria-label="Retirer l'étape"
              className="rounded-control border border-line px-2 py-1.5 text-[12px] text-muted transition-colors hover:bg-surface-2"
            >
              Retirer
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setSaved(false);
            setSteps((current) => [
              ...current,
              {
                day: (current[current.length - 1]?.day ?? 0) + 3,
                channel: "email",
                label: "",
              },
            ]);
          }}
          className="rounded-control border border-line px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-surface-2"
        >
          Ajouter une étape
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-control bg-brand px-4 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50"
        >
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && <span className="text-[12.5px] text-win-d">Enregistré.</span>}
        {error !== null && <span className="text-[12.5px] text-[#B2311F]">{error}</span>}
      </div>
    </section>
  );
}
