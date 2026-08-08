"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import type { PilotageSettings } from "@/lib/domain/types";

/**
 * Seuils de pilotage et objectif mensuel.
 *
 * Ces trois nombres pilotent tout le reste : `staleDays` et `coldDays` décident
 * de la chaleur des affaires, des alertes, et de la colonne rouge « dernière
 * touche » du centre de pilotage ; `objectifMensuel` de la barre de progression.
 * Les modifier change immédiatement ce que l'application signale.
 */
const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-flux";

function isSettings(value: unknown): value is { settings: PilotageSettings } {
  return typeof value === "object" && value !== null && "settings" in value;
}

export function PilotageForm({
  settings,
  onSaved,
}: {
  settings: PilotageSettings;
  onSaved: () => void;
}) {
  const [stale, setStale] = useState(settings.staleDays);
  const [cold, setCold] = useState(settings.coldDays);
  const [objective, setObjective] = useState(settings.objectifMensuel);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/settings",
      {
        method: "PATCH",
        body: JSON.stringify({ staleDays: stale, coldDays: cold, objectifMensuel: objective }),
      },
      isSettings,
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
      <div className="grid gap-2.5 sm:grid-cols-3">
        <Field label="Tiède au-delà de (jours)">
          <input
            type="number"
            min={1}
            value={stale}
            onChange={(e) => {
              setStale(Number(e.target.value));
              setSaved(false);
            }}
            className={CONTROL}
          />
        </Field>
        <Field label="Froid au-delà de (jours)">
          <input
            type="number"
            min={1}
            value={cold}
            onChange={(e) => {
              setCold(Number(e.target.value));
              setSaved(false);
            }}
            className={CONTROL}
          />
        </Field>
        <Field label="Objectif mensuel (€)">
          <input
            type="number"
            min={0}
            value={objective}
            onChange={(e) => {
              setObjective(Number(e.target.value));
              setSaved(false);
            }}
            className={CONTROL}
          />
        </Field>
      </div>

      <p className="mt-2 text-[12px] text-muted">
        Le seuil « tiède » doit rester inférieur au seuil « froid », sans quoi aucune affaire
        ne serait jamais tiède.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-control bg-flux px-4 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-flux-d disabled:opacity-50"
        >
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && <span className="text-[12.5px] text-flux-d">Enregistré.</span>}
        {error !== null && <span className="text-[12.5px] text-[#B2311F]">{error}</span>}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
