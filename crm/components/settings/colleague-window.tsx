"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";

/**
 * La fenêtre de l'avertissement « un collègue a déjà été écrit ».
 *
 * Elle vit ici, sous les rôles, parce qu'elle répond à la même question : deux
 * personnes d'une même maison reçoivent des messages, et la seule chose qui
 * puisse mal tourner est qu'ils se ressemblent. Les rôles font qu'ils diffèrent
 * ; ce réglage fait qu'on le sait avant d'envoyer.
 *
 * `0` coupe l'avertissement — même convention que le plafond mensuel de l'API
 * et les objectifs hebdomadaires : sans elle, on ne pourrait plus le désactiver
 * une fois posé.
 */

const CONTROL =
  "w-24 rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";

function isSettings(value: unknown): value is { settings: unknown } {
  return typeof value === "object" && value !== null && "settings" in value;
}

export function ColleagueWindow({
  days,
  onSaved,
}: {
  readonly days: number;
  readonly onSaved: () => void;
}) {
  const [draft, setDraft] = useState(days);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/settings",
      { method: "PATCH", body: JSON.stringify({ colleagueWarningDays: draft }) },
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
    <div className="mt-4 border-t border-line-2 pt-3">
      <h3 className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        Avertissement « collègue déjà écrit »
      </h3>
      <p className="mt-1 mb-2 text-[12px] text-muted">
        Avant d'écrire à quelqu'un dont un collègue a été contacté dans cette fenêtre, le
        panneau de rédaction le nomme et donne la date. Ce n'est jamais un blocage — écrire à
        plusieurs personnes d'une maison est le but. Alex, lui, reçoit l'accroche déjà
        utilisée et a consigne de ne pas la reprendre. Zéro désactive l'avertissement.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="number"
            min={0}
            max={365}
            value={draft}
            onChange={(event) => {
              setSaved(false);
              setDraft(Number(event.target.value));
            }}
            className={CONTROL}
          />
          <span className="text-muted">jours</span>
        </label>
        <button
          type="button"
          onClick={save}
          disabled={busy || draft === days}
          className="min-h-[44px] rounded-control border border-line px-3 text-[13px] hover:border-brand disabled:opacity-50 lg:min-h-0 lg:py-1.5"
        >
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && <span className="text-[12px] text-win-d">Enregistré.</span>}
        {error !== null && <span className="text-[12px] text-danger">{error}</span>}
      </div>
    </div>
  );
}
