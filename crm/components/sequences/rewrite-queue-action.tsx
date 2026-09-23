"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import { cost } from "@/components/campaigns/compose-action";

/**
 * « Réécrire tous les départs » — la file, avec les consignes d'aujourd'hui.
 *
 * Un brouillon en attente porte le discours du matin où il a été écrit : le
 * mail de référence, les notes d'angle, la recherche et la signature de ce
 * jour-là. Quand l'un des quatre change, la file devient périmée **sans que
 * rien ne le dise**. Ce bouton la remet à jour.
 *
 * **Même confirmation qu'au jalon 70** : le coût annoncé avant d'être dépensé,
 * et surtout le nombre de brouillons **retouchés à la main** qui seront
 * remplacés. C'est le seul chiffre qui coûte quelque chose à l'utilisateur, et
 * il est nommé plutôt que noyé dans un total.
 */

interface Plan {
  readonly drafts: number;
  readonly edited: number;
  readonly micros: number;
  readonly campaigns: number;
  readonly blocked: string | null;
}

function isPlan(value: unknown): value is { plan: Plan } {
  return typeof value === "object" && value !== null && "plan" in value;
}

function isOutcome(value: unknown): value is { outcome: { campaigns: number } } {
  return typeof value === "object" && value !== null && "outcome" in value;
}

export function RewriteQueueAction() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const ask = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await requestJson("/api/departures/rewrite", {}, isPlan);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setPlan(result.data.plan);
  };

  const apply = async () => {
    setBusy(true);
    const result = await requestJson("/api/departures/rewrite", { method: "POST" }, isOutcome);
    setBusy(false);
    setPlan(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDone(
      `Réécriture lancée sur ${result.data.outcome.campaigns} campagne${
        result.data.outcome.campaigns > 1 ? "s" : ""
      }. La file se remplit sous vos yeux ; rien n'est envoyé.`,
    );
    router.refresh();
  };

  return (
    <div className="mx-6 mt-3">
      <button
        type="button"
        onClick={() => void ask()}
        disabled={busy}
        title="Recompose tous les brouillons en attente avec le discours, les angles, la recherche et la signature d'aujourd'hui. Rien n'est envoyé."
        className="min-h-[44px] rounded-control border border-line bg-surface px-3 text-[12.5px] font-semibold hover:border-brand disabled:opacity-50 lg:min-h-0 lg:py-1.5"
      >
        Réécrire tous les départs
      </button>

      {plan !== null && (
        <div className="mt-2 rounded-card border border-brand-lift bg-brand-l p-3 text-[12.5px]">
          {plan.blocked !== null ? (
            <p className="font-semibold text-ink">{plan.blocked}</p>
          ) : (
            <>
              <p className="font-semibold text-ink">
                {plan.drafts} brouillon{plan.drafts > 1 ? "s" : ""} seront réécrits sur{" "}
                {plan.campaigns} campagne{plan.campaigns > 1 ? "s" : ""}, pour {cost(plan.micros)}.
              </p>
              <p className="mt-1 text-muted">
                Ils repartiront du discours, des angles, de la recherche et de la signature
                d&apos;aujourd&apos;hui. Les messages déjà envoyés ne sont pas touchés, et rien ne
                part sans validation.
              </p>
              {plan.edited > 0 && (
                <p className="mt-1 font-semibold text-danger">
                  Dont {plan.edited} que vous avez retouché{plan.edited > 1 ? "s" : ""} à la main :
                  {plan.edited > 1 ? " ils seront remplacés." : " il sera remplacé."}
                </p>
              )}
            </>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            {plan.blocked === null && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void apply()}
                className="min-h-[44px] rounded-control bg-brand px-3 text-[12.5px] font-semibold text-white hover:bg-brand-d disabled:opacity-50 lg:min-h-0 lg:py-1.5"
              >
                Réécrire
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => setPlan(null)}
              className="min-h-[44px] rounded-control border border-line bg-surface px-3 text-[12.5px] hover:bg-surface-2 lg:min-h-0 lg:py-1.5"
            >
              {plan.blocked === null ? "Annuler" : "Fermer"}
            </button>
          </div>
        </div>
      )}

      {error !== null && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      {done !== null && <p className="mt-2 text-[12px] text-win-d">{done}</p>}
    </div>
  );
}
