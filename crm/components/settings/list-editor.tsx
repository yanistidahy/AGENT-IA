"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import type { SettingsListKind } from "@/lib/domain/types";

/**
 * Listes éditables : propriétaires, offres, sources, cycles de vie.
 *
 * Une valeur par ligne. Les doublons et les lignes vides sont écartés par le
 * serveur ; l'ordre de saisie devient l'ordre d'affichage dans les menus.
 */
function isList(value: unknown): value is { kind: string } {
  return typeof value === "object" && value !== null && "kind" in value;
}

export function ListEditor({
  kind,
  label,
  values,
  onSaved,
}: {
  kind: SettingsListKind;
  label: string;
  values: readonly string[];
  onSaved: () => void;
}) {
  const [text, setText] = useState(values.join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/settings/lists",
      {
        method: "PUT",
        body: JSON.stringify({ kind, values: text.split("\n") }),
      },
      isList,
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
    <div className="rounded-card border border-line bg-surface p-3.5 shadow-card">
      <div className="mb-1.5 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        {label}
      </div>
      <textarea
        rows={5}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        className="w-full rounded-control border border-line bg-surface px-2.5 py-2 font-mono text-[12.5px] outline-none focus:border-flux"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="rounded-control border border-line px-3 py-1 text-[12px] font-semibold transition-colors hover:bg-surface-2 disabled:opacity-50"
        >
          {busy ? "…" : "Enregistrer"}
        </button>
        {saved && <span className="text-[12px] text-flux-d">Enregistré.</span>}
        {error !== null && <span className="text-[12px] text-[#B2311F]">{error}</span>}
      </div>
    </div>
  );
}
