"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/client/http";
import type { EnrollSelectionOutcome } from "@/lib/api/campaigns";
import {
  clearSelection,
  readSelection,
  writeSelection,
} from "@/lib/client/campaign-selection";

/**
 * La barre de sélection d'une campagne, sur /contacts.
 *
 * **Elle est collée en haut de l'écran** (`sticky`) : le compteur et le bouton
 * doivent rester atteignables pendant qu'on parcourt cent cinquante lignes.
 * Une barre qui défile hors du champ obligerait à remonter pour confirmer, et
 * on finirait par cocher sans jamais valider.
 *
 * La sélection vit dans `sessionStorage`, pas dans l'URL ni dans l'état React :
 * filtrer est une navigation, et une sélection perdue au changement de filtre
 * rendrait tout l'écran inutilisable — voir `lib/client/campaign-selection.ts`.
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
  selected,
  onCleared,
}: {
  readonly campaign: { readonly id: string; readonly name: string };
  readonly params: URLSearchParams;
  readonly shown: number;
  /** Les identifiants cochés, tenus par la vue — la barre ne fait que les lire. */
  readonly selected: ReadonlySet<string>;
  readonly onCleared: () => void;
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
        body: JSON.stringify({
          campaignId: campaign.id,
          selection: selectionOf(params),
          // **Les fiches cochées font foi quand il y en a.** Le filtre n'est
          // alors qu'un souvenir de la façon dont on les a trouvées : cocher
          // huit fiches sur un filtre, puis cinq sur un autre, ne se décrit par
          // aucune requête unique — c'est la liste qui décrit la sélection.
          contactIds: [...selected],
        }),
      },
      isOutcome,
    );
    setBusy(false);
    if (result.ok) {
      setOutcome(result.data.outcome);
      clearSelection(campaign.id);
      onCleared();
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="sticky top-0 z-20 mb-2 rounded-card border border-brand-lift bg-brand-l px-3 py-2 text-[12.5px] shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <span>
          Sélection pour <strong className="font-semibold">{campaign.name}</strong>
        </span>
        <strong className="font-mono tabular-nums">
          {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
        </strong>
        <span className="text-muted">· {shown} affichée{shown > 1 ? "s" : ""}</span>

        <button
          type="button"
          onClick={() => void enroll()}
          disabled={busy || selected.size === 0}
          className="ml-auto min-h-[44px] rounded-control bg-brand px-3 text-[12.5px] font-medium text-white hover:bg-brand-d disabled:opacity-50 lg:min-h-0 lg:py-1"
        >
          {busy ? "Inscription…" : `Inscrire ${selected.size} contact${selected.size > 1 ? "s" : ""}`}
        </button>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={() => {
              clearSelection(campaign.id);
              onCleared();
            }}
            className="min-h-[44px] text-[12.5px] text-brand-d hover:underline lg:min-h-0"
          >
            Vider
          </button>
        )}
        <Link href="/campagnes" className="min-h-[44px] text-brand-d hover:underline lg:min-h-0">
          Retour
        </Link>
      </div>

      <p className="mt-1 text-[12px] text-brand-d">
        La sélection suit les changements de filtre : cochez ici, filtrez autrement, cochez
        encore — tout est conservé jusqu'à l'inscription.
      </p>

      {outcome !== null && (
        <p className="mt-1.5">
          <strong className="font-semibold">
            {outcome.enrolled} inscrite{outcome.enrolled > 1 ? "s" : ""}
          </strong>
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

/**
 * La sélection, tenue par la vue et **rechargée depuis `sessionStorage`** à
 * chaque montage — c'est-à-dire à chaque changement de filtre, puisque filtrer
 * navigue.
 */
export function useCampaignSelection(campaignId: string | null): {
  readonly selected: ReadonlySet<string>;
  readonly toggle: (id: string) => void;
  readonly toggleAll: (ids: readonly string[], checked: boolean) => void;
  readonly reset: () => void;
} {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set<string>());

  useEffect(() => {
    // Au montage seulement : la lecture touche `window`, absent au rendu
    // serveur. Sans cet effet, la page échouerait à l'hydratation.
    setSelected(campaignId === null ? new Set<string>() : readSelection(campaignId));
  }, [campaignId]);

  const commit = (next: Set<string>) => {
    setSelected(next);
    if (campaignId !== null) writeSelection(campaignId, next);
  };

  return {
    selected,
    toggle: (id) => {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      commit(next);
    },
    toggleAll: (ids, checked) => {
      const next = new Set(selected);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      commit(next);
    },
    reset: () => commit(new Set<string>()),
  };
}
