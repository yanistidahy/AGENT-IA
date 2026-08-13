"use client";

import Link from "next/link";
import { useState } from "react";
import { requestJson } from "@/lib/client/http";

/**
 * Action groupée « réveiller les affaires en sommeil ».
 *
 * Volontairement déclenchée à la main plutôt qu'au moment où l'alerte
 * s'affiche : afficher une liste ne doit pas écrire en base. Le bouton annonce
 * combien de tâches il va créer, et le résultat les nomme — on peut toutes les
 * terminer ou les supprimer dans /taches.
 *
 * Pas de `router.refresh()` : créer la tâche ne change rien à l'alerte —
 * l'affaire reste en sommeil tant qu'on ne l'a pas relancée. Recharger la page
 * ne ferait que faire clignoter l'écran pour un résultat identique.
 */
function isResult(value: unknown): value is { created: number; titles: string[] } {
  return typeof value === "object" && value !== null && "created" in value;
}

export function WakeStaleDeals({ dealIds }: { dealIds: readonly string[] }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (dealIds.length === 0) return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/deals/wake-stale",
      { method: "POST", body: JSON.stringify({ dealIds }) },
      isResult,
    );
    setBusy(false);
    if (result.ok) {
      setDone(result.data.created);
    } else {
      setError(result.message);
    }
  };

  if (done !== null) {
    return (
      <p className="mb-2 flex flex-wrap items-center gap-2 rounded-control border border-[#D3CEFA] bg-brand-l px-3 py-2 text-[12.5px] text-brand-d">
        {done} tâche(s) de réveil créée(s), une par affaire.
        <Link href="/taches" className="font-semibold underline">
          Ouvrir /taches
        </Link>
      </p>
    );
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void run()}
        className="rounded-control border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-surface-2 disabled:opacity-50"
      >
        {busy
          ? "Création…"
          : `Créer ${dealIds.length} tâche(s) de réveil pour les affaires en sommeil`}
      </button>
      {error !== null && <span className="text-[12.5px] text-[#B2311F]">{error}</span>}
    </div>
  );
}
