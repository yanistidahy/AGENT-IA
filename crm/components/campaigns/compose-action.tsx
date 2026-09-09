"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";

/**
 * « Composer les départs » : le plan, puis le travail.
 *
 * **Deux temps, et la séparation est le sujet.** Le premier clic demande le
 * plan — combien de brouillons, combien d'appels, combien ça coûte — et
 * n'appelle aucun modèle. Le second dépense. Un bouton unique qui composerait
 * tout de suite ferait payer un geste d'exploration, et la règle « aucune
 * écriture sans clic » du jalon 8 vaut d'autant plus quand l'écriture se
 * facture.
 *
 * Quand rien ne peut être composé, la cause est **nommée** plutôt que rendue
 * par un « 0 » : séquence inactive, étape sans consigne, campagne archivée,
 * week-end. C'est précisément ce silence-là qui a fait chercher du côté du
 * planificateur alors que la séquence n'avait jamais été activée.
 */

interface Plan {
  readonly estimate: {
    readonly drafts: number;
    readonly micros: number;
    readonly model: string;
    readonly source: string;
    readonly background: boolean;
  };
  readonly blocked: string | null;
}

interface Outcome {
  readonly composed: number;
  readonly background: boolean;
  readonly drafts: number;
  readonly blocked: string | null;
}

function isPlan(value: unknown): value is { plan: Plan } {
  return typeof value === "object" && value !== null && "plan" in value;
}

function isOutcome(value: unknown): value is { outcome: Outcome } {
  return typeof value === "object" && value !== null && "outcome" in value;
}

/** Le même rendu que côté serveur, sur la même règle — jamais « 0,00 $ » pour un travail réel. */
export function cost(micros: number): string {
  if (micros <= 0) return "0,00 $";
  const dollars = micros / 1_000_000;
  return dollars < 0.01 ? "moins de 0,01 $" : `${dollars.toFixed(2).replace(".", ",")} $`;
}

export function describeSource(source: string): string {
  return source === "measured"
    ? "d'après vos brouillons déjà facturés"
    : "estimation par défaut, faute d'historique";
}

export function ComposeAction({
  campaignId,
  onDone,
}: {
  readonly campaignId: string;
  /** Recharge la page : la file et les compteurs sont rendus par le serveur. */
  readonly onDone: () => void;
}) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const askPlan = async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    const result = await requestJson(
      `/api/campaigns/compose?campaignId=${encodeURIComponent(campaignId)}`,
      {},
      isPlan,
    );
    setBusy(false);
    if (result.ok) setPlan(result.data.plan);
    else setError(result.message);
  };

  const compose = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/campaigns/compose",
      { method: "POST", body: JSON.stringify({ campaignId }) },
      isOutcome,
    );
    setBusy(false);
    setPlan(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const done = result.data.outcome;
    setNote(
      done.background
        ? `${done.drafts} départs en préparation — la file se remplit à mesure.`
        : done.composed > 0
          ? `${done.composed} départ${done.composed > 1 ? "s" : ""} composé${done.composed > 1 ? "s" : ""} — à relire dans « Départs du jour ».`
          : `Aucun départ composé. ${done.blocked ?? ""}`,
    );
    onDone();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void askPlan()}
        disabled={busy}
        title="Écrit les brouillons de l'étape 1 pour les inscrits éligibles, tout de suite. Rien n'est envoyé."
        className="min-h-[44px] rounded-control border border-brand px-3 text-brand-d hover:bg-brand-l disabled:opacity-50 lg:min-h-0 lg:py-1"
      >
        Composer les départs
      </button>

      {plan !== null && (
        <div className="mt-2 w-full rounded-control border border-brand bg-brand-l px-3 py-2">
          {plan.blocked === null ? (
            <p>
              <strong className="font-semibold">
                {plan.estimate.drafts} brouillon{plan.estimate.drafts > 1 ? "s" : ""} à composer
              </strong>{" "}
              — {plan.estimate.drafts} appel{plan.estimate.drafts > 1 ? "s" : ""} au modèle, environ{" "}
              <strong className="font-semibold">{cost(plan.estimate.micros)}</strong> (
              {plan.estimate.model}, {describeSource(plan.estimate.source)}).{" "}
              <strong className="font-semibold">Rien n'est envoyé</strong> : la file se relit et se
              valide à la main.
              {plan.estimate.background &&
                " Au-delà de dix brouillons, la composition se fait en arrière-plan."}
            </p>
          ) : (
            <p>{plan.blocked}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {plan.blocked === null && (
              <button
                type="button"
                onClick={() => void compose()}
                disabled={busy}
                className="min-h-[44px] rounded-control bg-brand px-3 font-medium text-white hover:bg-brand-d disabled:opacity-50 lg:min-h-0 lg:py-1"
              >
                {busy ? "Composition…" : "Composer maintenant"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setPlan(null)}
              className="min-h-[44px] rounded-control border border-line px-3 lg:min-h-0 lg:py-1"
            >
              {plan.blocked === null ? "Annuler" : "Fermer"}
            </button>
          </div>
        </div>
      )}

      {note !== null && <p className="mt-2 w-full text-brand-d">{note}</p>}
      {error !== null && <p className="mt-2 w-full text-danger">{error}</p>}
    </>
  );
}
