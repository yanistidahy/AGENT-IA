"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import type { WeeklyTargets } from "@/lib/domain/pilotage";

/**
 * Les trois cibles hebdomadaires du pilotage.
 *
 * Elles ont remplacé les objectifs « appels » et « emails » de « Ma
 * performance » au jalon 109, parce que l'écran qui les affichait a été retiré
 * et que les colonnes correspondantes ne pilotaient plus rien. Les deux
 * anciennes colonnes **restent en base** : les supprimer est irréversible et ne
 * rapporte rien.
 *
 * `0` vaut « pas de cible » — la pastille affiche alors le chiffre seul, sans
 * barre ni pourcentage, et le graphique sans ligne. C'est la convention du
 * plafond mensuel de l'API (jalon 36) : sans elle, une cible posée une fois ne
 * pourrait plus être retirée. Une barre sur zéro n'a aucun sens, et « 12 sur
 * 0 » encore moins.
 *
 * La semaine est **du lundi au dimanche, heure de Paris** : c'est ce que
 * `parisWeek` applique au tableau de bord, et la phrase sous les champs le dit
 * pour que personne n'ait à le déduire d'un chiffre qui retombe à zéro un
 * lundi matin.
 */
const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";

function isSettings(value: unknown): value is { settings: unknown } {
  return typeof value === "object" && value !== null && "settings" in value;
}

const FIELDS = [
  {
    key: "messages",
    label: "Messages par semaine",
    hint: "emails envoyés + invitations LinkedIn",
  },
  { key: "demos", label: "Démos envoyées par semaine", hint: "" },
  { key: "qualified", label: "Démos qualifiées par semaine", hint: "envoyée, testée, retour reçu" },
] as const;

export function TargetsForm({
  targets,
  onSaved,
}: {
  readonly targets: WeeklyTargets;
  readonly onSaved: () => void;
}) {
  const [draft, setDraft] = useState<WeeklyTargets>(targets);
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
          cibleMessagesSemaine: draft.messages,
          cibleDemosSemaine: draft.demos,
          cibleQualifieesSemaine: draft.qualified,
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
      <div className="grid gap-2.5 sm:grid-cols-3">
        {FIELDS.map((field) => (
          <label key={field.key} className="block">
            <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
              {field.label}
            </span>
            <input
              type="number"
              min={0}
              max={10000}
              data-target={field.key}
              value={draft[field.key]}
              onChange={(event) => {
                setSaved(false);
                setDraft((current) => ({ ...current, [field.key]: Number(event.target.value) }));
              }}
              className={CONTROL}
            />
            {field.hint !== "" && (
              <span className="mt-1 block text-[11.5px] text-muted">{field.hint}</span>
            )}
          </label>
        ))}
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-muted">
        Affichées sur Pilotage, avec l'avancement de la semaine en cours — du lundi au dimanche,
        heure de Paris. Zéro retire la cible : la pastille garde son chiffre, sans barre.
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
