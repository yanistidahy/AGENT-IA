"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";

/**
 * Les objectifs hebdomadaires de « Ma performance ».
 *
 * `0` vaut « pas d'objectif » — l'écran de performance n'affiche alors pas de
 * barre plutôt qu'un « 4 sur 0 ». Même convention que le plafond mensuel de
 * l'API : sans elle, on ne pourrait plus désactiver un objectif une fois posé.
 */
const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";

function isSettings(value: unknown): value is { settings: unknown } {
  return typeof value === "object" && value !== null && "settings" in value;
}

export function TargetsForm({
  calls,
  emails,
  onSaved,
}: {
  readonly calls: number;
  readonly emails: number;
  readonly onSaved: () => void;
}) {
  const [draft, setDraft] = useState({ calls, emails });
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
        body: JSON.stringify({
          objectifAppelsSemaine: draft.calls,
          objectifEmailsSemaine: draft.emails,
        }),
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
      <div className="grid max-w-[420px] gap-2.5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
            Appels par semaine
          </span>
          <input
            type="number"
            min={0}
            max={1000}
            value={draft.calls}
            onChange={(event) => {
              setSaved(false);
              setDraft((current) => ({ ...current, calls: Number(event.target.value) }));
            }}
            className={CONTROL}
          />
        </label>
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
            Emails par semaine
          </span>
          <input
            type="number"
            min={0}
            max={1000}
            value={draft.emails}
            onChange={(event) => {
              setSaved(false);
              setDraft((current) => ({ ...current, emails: Number(event.target.value) }));
            }}
            className={CONTROL}
          />
        </label>
      </div>

      <p className="mt-2 text-[12px] text-muted">
        Affichés sur « Ma performance » avec la progression de la semaine en cours. Zéro
        désactive l'objectif — aucune barre ne s'affiche alors.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-control bg-brand px-4 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50"
        >
          Enregistrer
        </button>
        {saved && <span className="text-[12px] text-win-d">Enregistré.</span>}
        {error !== null && <span className="text-[12px] text-[#B2311F]">{error}</span>}
      </div>
    </section>
  );
}
