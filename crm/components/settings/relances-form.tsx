"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import type { ReminderDelays } from "@/lib/domain/automation";
import { ACTIVITY_LABELS, ACTIVITY_TYPES, type ActivityType } from "@/lib/domain/types";

/**
 * Délais de relance proposés après une interaction.
 *
 * Ces cinq nombres ne déclenchent **aucune** écriture : ils pré-remplissent la
 * date de relance du formulaire de saisie d'interaction, que l'on reste libre de
 * changer ou d'effacer. C'est la raison pour laquelle ils sont configurables
 * plutôt que codés en dur — la bonne cadence après un appel n'est pas la même
 * d'un métier à l'autre.
 */
/**
 * Nom du champ de réglages porté par chaque type d'interaction.
 *
 * `Record<ActivityType, …>` et non un tableau : ajouter un type d'interaction
 * sans lui donner de délai devient une erreur de compilation, pas un champ
 * silencieusement absent du formulaire.
 */
const API_FIELD: Record<ActivityType, string> = {
  call: "relanceApresAppel",
  email: "relanceApresEmail",
  demo: "relanceApresDemo",
  meeting: "relanceApresReunion",
  note: "relanceApresNote",
};

const FIELDS: ReadonlyArray<{ type: ActivityType; key: keyof ReminderDelays; api: string }> =
  ACTIVITY_TYPES.map((type) => ({ type, key: type, api: API_FIELD[type] }));

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";

function isSettings(value: unknown): value is { settings: unknown } {
  return typeof value === "object" && value !== null && "settings" in value;
}

export function RelancesForm({
  delays,
  onSaved,
}: {
  delays: ReminderDelays;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ReminderDelays>(delays);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);

    const body: Record<string, number> = {};
    for (const field of FIELDS) body[field.api] = draft[field.key];

    const result = await requestJson(
      "/api/settings",
      { method: "PATCH", body: JSON.stringify(body) },
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
      <div className="grid gap-2.5 sm:grid-cols-5">
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
              Après {ACTIVITY_LABELS[field.type]}
            </span>
            <input
              type="number"
              min={0}
              max={365}
              value={draft[field.key]}
              onChange={(e) => {
                setSaved(false);
                setDraft((current) => ({ ...current, [field.key]: Number(e.target.value) }));
              }}
              className={CONTROL}
            />
          </label>
        ))}
      </div>

      <p className="mt-2 text-[12px] text-muted">
        Ces délais ne créent rien tout seuls : ils pré-remplissent la date de relance quand vous
        enregistrez une interaction. Vous restez libre de la changer ou de la retirer.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-control bg-brand px-4 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50"
        >
          {busy ? "Enregistrement…" : "Enregistrer les délais"}
        </button>
        {saved && <span className="text-[12.5px] text-win-d">Enregistré.</span>}
        {error !== null && <span className="text-[12.5px] text-[#B2311F]">{error}</span>}
      </div>
    </section>
  );
}
