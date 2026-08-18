"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import { MODELS, PURPOSES, PURPOSE_LABELS, type Purpose } from "@/lib/domain/model-pricing";

/**
 * Un modèle par usage, et le plafond mensuel.
 *
 * **Le sélecteur affiche le tarif à côté de chaque modèle.** Choisir un modèle
 * est une décision de coût autant que de qualité, et un menu qui ne montre que
 * des noms oblige à aller chercher l'information ailleurs — c'est-à-dire, en
 * pratique, à ne pas la chercher.
 */

export interface ModelsSettings {
  readonly draft: string;
  readonly revision: string;
  readonly chat: string;
  readonly shift: string;
  readonly monthlyBudgetCents: number;
}

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";

const FIELD: Record<Purpose, string> = {
  draft: "modelDraft",
  revision: "modelRevision",
  chat: "modelChat",
  shift: "modelShift",
};

/** Pourquoi ce défaut, en une phrase — la question qu'on se pose devant le menu. */
const WHY: Record<Purpose, string> = {
  draft: "Écrire depuis un dossier fourni n'est pas du raisonnement.",
  revision: "Même travail que la rédaction, même modèle.",
  chat: "Milieu de gamme : on y pose de vraies questions.",
  shift: "Une vacation juge — c'est là qu'on garde le plus fort.",
};

function isOk(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function ModelsForm({
  initial,
  onSaved,
}: {
  readonly initial: ModelsSettings;
  readonly onSaved: () => void;
}) {
  const [models, setModels] = useState<Record<Purpose, string>>({
    draft: initial.draft,
    revision: initial.revision,
    chat: initial.chat,
    shift: initial.shift,
  });
  // Saisi en dollars, stocké en cents : personne ne règle un budget en cents.
  const [budget, setBudget] = useState(String(initial.monthlyBudgetCents / 100));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    const dollars = Number(budget.replace(",", "."));
    if (!Number.isFinite(dollars) || dollars < 0) {
      setError("Le plafond doit être un montant positif, ou 0 pour le désactiver.");
      return;
    }

    setBusy(true);
    setError(null);
    const body: Record<string, unknown> = { monthlyBudgetCents: Math.round(dollars * 100) };
    for (const purpose of PURPOSES) body[FIELD[purpose]] = models[purpose];

    const result = await requestJson(
      "/api/settings",
      { method: "PATCH", body: JSON.stringify(body) },
      isOk,
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
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {PURPOSES.map((purpose) => (
          <label key={purpose} className="block">
            <span className="mb-1 block text-[12.5px] font-medium">{PURPOSE_LABELS[purpose]}</span>
            <select
              className={CONTROL}
              value={models[purpose]}
              onChange={(event) => {
                setSaved(false);
                setModels((current) => ({ ...current, [purpose]: event.target.value }));
              }}
            >
              {MODELS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label} — {model.input} $ / {model.output} $ par million
                </option>
              ))}
            </select>
            <span className="mt-0.5 block text-[12px] text-muted">{WHY[purpose]}</span>
          </label>
        ))}
      </div>

      <label className="block max-w-xs">
        <span className="mb-1 block text-[12.5px] font-medium">
          Plafond mensuel, en dollars
        </span>
        <input
          className={CONTROL}
          inputMode="decimal"
          value={budget}
          onChange={(event) => {
            setSaved(false);
            setBudget(event.target.value);
          }}
        />
        <span className="mt-0.5 block text-[12px] text-muted">
          Au-delà, les appels sont refusés avant d'être lancés. Un bandeau prévient à 80 %.
          <strong> 0 désactive le plafond.</strong>
        </span>
      </label>

      {error !== null && (
        <p className="rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-control bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50"
          disabled={busy}
          onClick={save}
        >
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && <span className="text-[12.5px] text-win-d">Enregistré.</span>}
      </div>
    </div>
  );
}
