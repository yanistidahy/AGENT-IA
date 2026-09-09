"use client";

import Link from "next/link";
import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import type { EnrollSelectionOutcome } from "@/lib/api/campaigns";

/**
 * « Vous choisissez les contacts d'une campagne. »
 *
 * La sélection se fait ici, avec les outils qu'on utilise déjà — puces,
 * filtres de colonne, recherche — et **rien ne s'inscrit sans le clic** : le
 * bouton envoie la query string courante, le serveur ré-évalue le filtre avec
 * les mêmes fonctions que cette page, et inscrit ce qu'elle affiche. Un filtre
 * actif invisible serait un écran qui ment (jalon 31) ; une inscription sans
 * clic serait une écriture sans témoin (jalon 8).
 */

function isOutcome(value: unknown): value is { outcome: EnrollSelectionOutcome } {
  return typeof value === "object" && value !== null && "outcome" in value;
}

/** La sélection à mémoriser : l'URL courante, moins ce qui n'en fait pas partie. */
function selectionOf(params: URLSearchParams): string {
  const kept = new URLSearchParams(params);
  // `campagne` désigne la campagne, pas les contacts ; `fiche` est le tiroir
  // ouvert — ni l'un ni l'autre ne décrit le public.
  kept.delete("campagne");
  kept.delete("fiche");
  return kept.toString();
}

export function CampaignBanner({
  campaign,
  params,
  shown,
}: {
  readonly campaign: { readonly id: string; readonly name: string };
  readonly params: URLSearchParams;
  readonly shown: number;
}) {
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<EnrollSelectionOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enroll = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/campaigns",
      {
        method: "PUT",
        body: JSON.stringify({ campaignId: campaign.id, selection: selectionOf(params) }),
      },
      isOutcome,
    );
    setBusy(false);
    if (result.ok) setOutcome(result.data.outcome);
    else setError(result.message);
  };

  return (
    <div className="mb-2 rounded-card border border-brand-lift bg-brand-l px-3 py-2 text-[12.5px]">
      <div className="flex flex-wrap items-center gap-2">
        <span>
          Sélection pour la campagne <strong className="font-semibold">{campaign.name}</strong>
          {" — "}
          {shown} fiche{shown > 1 ? "s" : ""} affichée{shown > 1 ? "s" : ""}.
        </span>
        <button
          type="button"
          onClick={() => void enroll()}
          disabled={busy}
          className="min-h-[44px] rounded-control bg-brand px-3 text-[12.5px] font-medium text-white hover:bg-brand-d disabled:opacity-60 lg:min-h-0 lg:py-1"
        >
          {busy ? "Inscription…" : "Inscrire cette sélection"}
        </button>
        <Link href="/campagnes" className="ml-auto text-brand-d hover:underline">
          Retour aux campagnes
        </Link>
      </div>

      {outcome !== null && (
        <p className="mt-1.5">
          {outcome.matched} fiche{outcome.matched > 1 ? "s" : ""} dans le filtre ·{" "}
          <strong className="font-semibold">{outcome.enrolled} inscrite{outcome.enrolled > 1 ? "s" : ""}</strong>
          {outcome.already > 0 ? ` · ${outcome.already} déjà inscrite${outcome.already > 1 ? "s" : ""}` : ""}
          {outcome.refused > 0
            ? ` · ${outcome.refused} refusée${outcome.refused > 1 ? "s" : ""} (${outcome.refusedReasons.join(" ; ")})`
            : ""}
        </p>
      )}
      {error !== null && <p className="mt-1.5 text-danger">{error}</p>}
    </div>
  );
}
