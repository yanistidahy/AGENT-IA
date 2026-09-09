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

interface ComposeReport {
  readonly composed: number;
  readonly background: boolean;
  readonly drafts: number;
  readonly blocked: string | null;
}

interface Plan {
  readonly estimate: { readonly drafts: number; readonly micros: number; readonly model: string; readonly source: string; readonly background: boolean };
  readonly blocked: string | null;
}

function isOutcome(
  value: unknown,
): value is { outcome: EnrollSelectionOutcome; composition: ComposeReport } {
  return typeof value === "object" && value !== null && "outcome" in value;
}

function isPlan(value: unknown): value is { plan: Plan } {
  return typeof value === "object" && value !== null && "plan" in value;
}

/** « ≈ 0,48 $ » — le même rendu que côté serveur, sur la même règle. */
function cost(micros: number): string {
  if (micros <= 0) return "0,00 $";
  const dollars = micros / 1_000_000;
  return dollars < 0.01 ? "moins de 0,01 $" : `${dollars.toFixed(2).replace(".", ",")} $`;
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
  const [composed, setComposed] = useState<ComposeReport | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Le prix **avant** le clic, jamais après.
   *
   * Inscrire déclenche la composition, donc autant d'appels au modèle que de
   * fiches : une confirmation qui ne dirait que « 47 inscriptions » cacherait la
   * seule chose qui coûte de l'argent.
   */
  const ask = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      `/api/campaigns/compose?campaignId=${encodeURIComponent(campaign.id)}&aInscrire=${selected.size}`,
      {},
      isPlan,
    );
    setBusy(false);
    if (result.ok) setPlan(result.data.plan);
    else setError(result.message);
  };

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
    setPlan(null);
    if (result.ok) {
      setOutcome(result.data.outcome);
      setComposed(result.data.composition);
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
          onClick={() => void ask()}
          disabled={busy || selected.size === 0}
          className="ml-auto min-h-[44px] rounded-control bg-brand px-3 text-[12.5px] font-medium text-white hover:bg-brand-d disabled:opacity-50 lg:min-h-0 lg:py-1"
        >
          {busy ? "Un instant…" : `Inscrire ${selected.size} contact${selected.size > 1 ? "s" : ""}`}
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

      {/*
        **La confirmation porte le prix.** Composer cinquante brouillons, c'est
        cinquante appels au modèle : le nombre et le coût s'affichent ici, avant
        le clic qui les dépense — jamais sur la facture du mois.
      */}
      {plan !== null && (
        <div className="mt-1.5 rounded-control border border-brand bg-surface px-3 py-2">
          <p>
            <strong className="font-semibold">
              {selected.size} inscription{selected.size > 1 ? "s" : ""}
            </strong>
            {plan.blocked === null ? (
              <>
                , puis {plan.estimate.drafts} brouillon{plan.estimate.drafts > 1 ? "s" : ""} composé
                {plan.estimate.drafts > 1 ? "s" : ""} tout de suite —{" "}
                <strong className="font-semibold">
                  {plan.estimate.drafts} appel{plan.estimate.drafts > 1 ? "s" : ""} au modèle,
                  environ {cost(plan.estimate.micros)}
                </strong>{" "}
                ({plan.estimate.model},{" "}
                {plan.estimate.source === "measured"
                  ? "d'après vos brouillons déjà facturés"
                  : "estimation par défaut, faute d'historique"}
                ). Rien n'est envoyé : la file se relit et se valide à la main.
              </>
            ) : (
              <>
                . <span className="text-muted">{plan.blocked}</span> Les inscriptions seront faites,
                mais aucun brouillon ne sera composé.
              </>
            )}
          </p>
          {plan.estimate.background && (
            <p className="mt-1 text-[12px] text-muted">
              Au-delà de dix brouillons, la composition se fait en arrière-plan : la file se remplit
              à mesure, sans bloquer l'écran.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void enroll()}
              disabled={busy}
              className="min-h-[44px] rounded-control bg-brand px-3 font-medium text-white hover:bg-brand-d disabled:opacity-50 lg:min-h-0 lg:py-1"
            >
              {busy ? "En cours…" : "Confirmer"}
            </button>
            <button
              type="button"
              onClick={() => setPlan(null)}
              className="min-h-[44px] rounded-control border border-line px-3 lg:min-h-0 lg:py-1"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {composed !== null && (
        <p className="mt-1.5">
          {composed.background
            ? `${composed.drafts} départs en préparation — la file se remplit, rechargez « Départs du jour » dans un instant.`
            : composed.composed > 0
              ? `${composed.composed} départ${composed.composed > 1 ? "s" : ""} composé${composed.composed > 1 ? "s" : ""} — à relire dans « Départs du jour ».`
              : `Aucun départ composé. ${composed.blocked ?? ""}`}
        </p>
      )}

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
