"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";

/**
 * Sauvegarde et restauration complètes.
 *
 * La restauration remplace **tout**. Elle demande donc une confirmation
 * explicite, et le serveur exécute l'opération dans une transaction : un fichier
 * refusé ne supprime rien.
 */
function isCounts(value: unknown): value is { counts: Record<string, number> } {
  return typeof value === "object" && value !== null && "counts" in value;
}

export function BackupPanel({ onRestored }: { onRestored: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<Record<string, number> | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const restore = async () => {
    if (file === null) return;
    setBusy(true);
    setError(null);
    setReport(null);

    let payload: unknown;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      setBusy(false);
      setError("Ce fichier n'est pas du JSON lisible.");
      return;
    }

    const result = await requestJson(
      "/api/backup",
      { method: "POST", body: JSON.stringify(payload) },
      isCounts,
    );
    setBusy(false);
    setConfirming(false);
    if (result.ok) {
      setReport(result.data.counts);
      onRestored();
    } else {
      setError(result.message);
    }
  };

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href="/api/backup"
          className="rounded-control border border-line px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-surface-2"
        >
          Télécharger la sauvegarde JSON
        </a>

        <label className="rounded-control border border-line px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-surface-2">
          {file === null ? "Choisir un fichier…" : file.name}
          <input
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setConfirming(false);
              setReport(null);
              setError(null);
            }}
          />
        </label>

        {file !== null && (
          <button
            type="button"
            disabled={busy}
            onClick={() => (confirming ? void restore() : setConfirming(true))}
            className="rounded-control border border-[#F0C9C2] px-3.5 py-1.5 text-[12.5px] font-semibold text-[#B2311F] transition-colors hover:bg-pulse-l disabled:opacity-50"
          >
            {busy ? "Restauration…" : confirming ? "Confirmer : tout remplacer" : "Restaurer"}
          </button>
        )}
      </div>

      {confirming && (
        <p className="mt-2.5 rounded-control border border-[#F0C9C2] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          La restauration supprime toutes les données actuelles et les remplace par celles du
          fichier. L'opération est transactionnelle : si le fichier est refusé, rien n'est
          supprimé.
        </p>
      )}

      {report !== null && (
        <p className="mt-2.5 rounded-control border border-[#B9E7DC] bg-flux-l px-3 py-2 text-[12.5px] text-flux-d">
          Restauration terminée :{" "}
          {Object.entries(report)
            .map(([label, count]) => `${count} ${label}`)
            .join(" · ")}
          .
        </p>
      )}

      {error !== null && (
        <p className="mt-2.5 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}
    </section>
  );
}
