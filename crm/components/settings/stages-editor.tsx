"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import type { StageWithAction } from "@/lib/api/reference";

/**
 * Étapes du pipeline : nom, couleur, probabilité, ordre.
 *
 * Chaque étape porte aussi son « action de suivi » : l'intitulé et le délai de
 * la tâche proposée quand une affaire entre dans l'étape. Intitulé vide = aucune
 * proposition, ce qui est voulu pour les étapes terminales.
 *
 * L'ordre du tableau devient l'ordre des colonnes du Kanban. Le nombre
 * d'affaires est affiché à côté de chaque étape parce que c'est lui qui décide
 * si la suppression est possible : le serveur refuse en 409 tant qu'une étape
 * supprimée porte encore des affaires, plutôt que de les laisser orphelines.
 */
interface StagesEditorProps {
  readonly stages: readonly StageWithAction[];
  readonly dealCounts: Record<string, number>;
  readonly onSaved: () => void;
}

interface Draft {
  id?: string;
  name: string;
  color: string;
  prob: number;
  nextActionLabel: string;
  nextActionDays: number;
}

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-flux";

function isStages(value: unknown): value is { stages: unknown } {
  return typeof value === "object" && value !== null && "stages" in value;
}

export function StagesEditor({ stages, dealCounts, onSaved }: StagesEditorProps) {
  const [drafts, setDrafts] = useState<Draft[]>(
    stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      color: stage.color,
      prob: stage.prob,
      nextActionLabel: stage.nextActionLabel,
      nextActionDays: stage.nextActionDays,
    })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const patch = (index: number, next: Partial<Draft>) => {
    setSaved(false);
    setDrafts((current) => current.map((d, i) => (i === index ? { ...d, ...next } : d)));
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= drafts.length) return;
    setSaved(false);
    setDrafts((current) => {
      const copy = [...current];
      const a = copy[index];
      const b = copy[target];
      if (a === undefined || b === undefined) return current;
      copy[index] = b;
      copy[target] = a;
      return copy;
    });
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/settings/stages",
      { method: "PUT", body: JSON.stringify({ stages: drafts }) },
      isStages,
    );
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
      <div className="mb-2 grid grid-cols-[1fr_72px_66px_1fr_60px_auto] gap-2 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        <span>Étape</span>
        <span>Couleur</span>
        <span>Proba</span>
        <span>Action de suivi</span>
        <span>Délai</span>
        <span />
      </div>

      <div className="grid gap-1.5">
        {drafts.map((draft, index) => {
          const count = draft.id === undefined ? 0 : (dealCounts[draft.id] ?? 0);
          return (
            <div
              key={draft.id ?? `nouvelle-${index}`}
              className="grid grid-cols-[1fr_72px_66px_1fr_60px_auto] items-center gap-2"
            >
              <input
                value={draft.name}
                onChange={(e) => patch(index, { name: e.target.value })}
                className={CONTROL}
              />
              <input
                type="color"
                value={draft.color}
                onChange={(e) => patch(index, { color: e.target.value })}
                aria-label="Couleur de l'étape"
                className="h-[32px] w-full rounded-control border border-line bg-surface px-1"
              />
              <label className="flex items-center gap-1 text-[12px] text-muted">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.prob}
                  onChange={(e) => patch(index, { prob: Number(e.target.value) })}
                  className={CONTROL}
                />
                %
              </label>
              <input
                value={draft.nextActionLabel}
                onChange={(e) => patch(index, { nextActionLabel: e.target.value })}
                placeholder="Action de suivi (vide = aucune)"
                aria-label="Action de suivi proposée"
                className={CONTROL}
              />
              <label className="flex items-center gap-1 text-[12px] text-muted">
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={draft.nextActionDays}
                  onChange={(e) => patch(index, { nextActionDays: Number(e.target.value) })}
                  aria-label="Délai de l'action de suivi, en jours"
                  className={CONTROL}
                />
                j
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  aria-label="Monter"
                  className="rounded-control border border-line px-2 py-1 text-[12px] transition-colors hover:bg-surface-2"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  aria-label="Descendre"
                  className="rounded-control border border-line px-2 py-1 text-[12px] transition-colors hover:bg-surface-2"
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={count > 0}
                  title={
                    count > 0
                      ? `${count} affaire(s) sur cette étape — déplacez-les d'abord`
                      : "Retirer l'étape"
                  }
                  onClick={() => {
                    setSaved(false);
                    setDrafts((current) => current.filter((_, i) => i !== index));
                  }}
                  className="rounded-control border border-line px-2 py-1 text-[12px] text-muted transition-colors hover:bg-surface-2 disabled:opacity-40"
                >
                  {count > 0 ? `${count} aff.` : "Retirer"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setSaved(false);
            setDrafts((current) => [...current, {
                name: "Nouvelle étape",
                color: "#6E8B86",
                prob: 50,
                nextActionLabel: "",
                nextActionDays: 3,
              }]);
          }}
          className="rounded-control border border-line px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-surface-2"
        >
          Ajouter une étape
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-control bg-flux px-4 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-flux-d disabled:opacity-50"
        >
          {busy ? "Enregistrement…" : "Enregistrer le pipeline"}
        </button>
        {saved && <span className="text-[12.5px] text-flux-d">Enregistré.</span>}
        {error !== null && <span className="text-[12.5px] text-[#B2311F]">{error}</span>}
      </div>
    </section>
  );
}
