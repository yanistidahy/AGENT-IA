"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";

/**
 * **Réinitialiser la campagne : un nouveau premier message pour tout le
 * monde.**
 *
 * Ce n'est pas la réouverture du jalon 81. Rouvrir reprend quelqu'un *là où il
 * en était* ; réinitialiser lui renvoie **un premier message**, avec le
 * discours d'aujourd'hui — et il s'en souvient peut-être. D'où les deux choses
 * que cet écran refuse de taire :
 *
 * - la phrase de confirmation dit **ce qui va se lire chez le destinataire**,
 *   pas ce qui va s'écrire en base ;
 * - les personnes ayant répondu sont **exclues par défaut**, nommées, et leur
 *   inclusion est une case à cocher — jamais l'inverse. Cocher la case
 *   **redemande le plan** : la phrase doit décrire ce qu'on vient d'autoriser.
 *
 * `POST` regarde, `PUT` écrit (jalon 8). Rien ne part : les brouillons frais
 * atterrissent dans « Départs du jour », comme toute composition.
 */

interface Plan {
  readonly included: number;
  readonly repliers: readonly string[];
  readonly message: string;
  readonly repliersNote: string;
  readonly exclusionsNote: string;
  readonly blocked: string | null;
}

function isPlan(value: unknown): value is Plan {
  return typeof value === "object" && value !== null && "message" in value;
}

function isOutcome(value: unknown): value is { reset: number; blocked: string | null } {
  return typeof value === "object" && value !== null && "reset" in value;
}

export function ResetAction({
  campaignId,
  onDone,
  className,
}: {
  readonly campaignId: string;
  readonly onDone: () => void;
  readonly className: string;
}) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [includeRepliers, setIncludeRepliers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const ask = async (withRepliers: boolean) => {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await requestJson(
      "/api/campaigns/reset",
      {
        method: "POST",
        body: JSON.stringify({ campaignId, includeRepliers: withRepliers }),
      },
      isPlan,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPlan(result.data);
  };

  const apply = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/campaigns/reset",
      { method: "PUT", body: JSON.stringify({ campaignId, includeRepliers }) },
      isOutcome,
    );
    setBusy(false);
    setPlan(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.data.blocked !== null) {
      setError(result.data.blocked);
      return;
    }
    setDone(
      `${result.data.reset} inscription${result.data.reset > 1 ? "s" : ""} ramenée${
        result.data.reset > 1 ? "s" : ""
      } à l'étape 1. Les nouveaux premiers messages se composent en arrière-plan et vous attendent dans « Départs du jour » — rien n'est envoyé.`,
    );
    onDone();
  };

  const toggle = (next: boolean) => {
    setIncludeRepliers(next);
    // Le plan est **redemandé** : le compte et la phrase changent avec la
    // case, et une confirmation qui décrirait l'autre choix serait pire que
    // pas de confirmation du tout (jalon 82).
    void ask(next);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void ask(includeRepliers)}
        disabled={busy}
        title="Ramène chaque inscrit à l'étape 1 et compose un nouveau premier message avec les consignes d'aujourd'hui. Les envois passés ne sont pas effacés."
        className={className}
      >
        Réinitialiser la campagne
      </button>

      {plan !== null && (
        <div className="mt-2 w-full rounded-card border border-brand-lift bg-brand-l p-3 text-[12.5px]">
          {plan.blocked !== null ? (
            <p className="font-semibold text-ink">{plan.blocked}</p>
          ) : (
            <>
              <p className="font-semibold text-ink">{plan.message}</p>
              <p className="mt-1 text-muted">
                Les envois passés ne sont pas effacés : ils restent dans /emails et sur la
                chronologie de chaque fiche. Rien ne part tout seul — les nouveaux brouillons
                attendent votre relecture dans « Départs du jour ».
              </p>
              {plan.repliersNote !== "" && (
                <p className="mt-2 rounded-control border border-danger bg-surface p-2 text-danger">
                  {plan.repliersNote}
                </p>
              )}
              {plan.exclusionsNote !== "" && <p className="mt-1 text-muted">{plan.exclusionsNote}</p>}
              {plan.repliers.length > 0 && (
                <label className="mt-2 flex items-start gap-2 text-ink">
                  <input
                    type="checkbox"
                    checked={includeRepliers}
                    disabled={busy}
                    onChange={(event) => toggle(event.target.checked)}
                    className="mt-0.5 h-5 w-5"
                  />
                  <span>
                    Inclure quand même les personnes qui ont répondu (décoché par défaut)
                  </span>
                </label>
              )}
            </>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            {plan.blocked === null && plan.included > 0 && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void apply()}
                className="min-h-[44px] rounded-control bg-danger px-3 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:opacity-50 lg:min-h-0 lg:py-1.5"
              >
                Réinitialiser, et composer un nouveau premier message
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => setPlan(null)}
              className="min-h-[44px] rounded-control border border-line bg-surface px-3 text-[12.5px] hover:bg-surface-2 lg:min-h-0 lg:py-1.5"
            >
              {plan.blocked === null && plan.included > 0 ? "Annuler" : "Fermer"}
            </button>
          </div>
        </div>
      )}

      {error !== null && <p className="mt-2 w-full text-[12px] text-danger">{error}</p>}
      {done !== null && <p className="mt-2 w-full text-[12px] text-win-d">{done}</p>}
    </>
  );
}
