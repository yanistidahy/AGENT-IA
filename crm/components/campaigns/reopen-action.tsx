"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";

/**
 * **Relancer les personnes qui ont terminé la campagne — sans passer par
 * l'éditeur.**
 *
 * L'éditeur d'étapes est le chemin normal : on ajoute une relance, on la
 * relit, et l'enregistrement propose de rattraper ceux qui avaient fini. Mais
 * ce chemin dépend d'un geste précis, et le jalon 81 a montré qu'il pouvait se
 * dérober sans rien dire — cinquante-deux personnes fermées, aucun moyen de
 * les atteindre depuis l'écran.
 *
 * Ce bouton est **la porte de secours** : il pose la même question au même
 * service, avec la même confirmation et les mêmes garde-fous, en partant des
 * étapes **telles qu'elles sont enregistrées**. Il ne dépend d'aucun état de
 * formulaire, donc il ne peut pas être neutralisé par un delta qui retombe à
 * zéro.
 *
 * Il ne rouvre rien de lui-même : `POST` regarde et compose la phrase, `PUT`
 * écrit — la discipline du jalon 8, et celle du jalon 81.
 */

interface Plan {
  readonly message: string;
  readonly exclusions: string;
  readonly silence: string;
  readonly decision: boolean;
}

function isPlan(value: unknown): value is Plan {
  return typeof value === "object" && value !== null && "decision" in value;
}

function isReopened(value: unknown): value is { reopened: number } {
  return typeof value === "object" && value !== null && "reopened" in value;
}

export function ReopenAction({
  sequenceId,
  steps,
  onDone,
  className,
}: {
  readonly sequenceId: string;
  /** Les étapes **enregistrées** : la relance part de ce que la base porte. */
  readonly steps: ReadonlyArray<{ readonly delayDays: number }>;
  readonly onDone: () => void;
  readonly className: string;
}) {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const ask = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await requestJson(
      "/api/sequences-email/reopen",
      {
        method: "POST",
        body: JSON.stringify({
          sequenceId,
          steps: steps.map((step) => ({ delayDays: step.delayDays })),
        }),
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
      "/api/sequences-email/reopen",
      { method: "PUT", body: JSON.stringify({ sequenceId }) },
      isReopened,
    );
    setBusy(false);
    setPlan(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDone(
      `${result.data.reopened} inscription${result.data.reopened > 1 ? "s" : ""} rouverte${
        result.data.reopened > 1 ? "s" : ""
      } — les personnes dues entreront dans la prochaine composition.`,
    );
    onDone();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void ask()}
        disabled={busy}
        title="Remet dans la séquence les personnes qu'elle avait fermées faute d'étape suivante. Celles qui ont répondu, refusé ou été retirées restent dehors."
        className={className}
      >
        Relancer les personnes ayant terminé
      </button>

      {plan !== null && (
        <div className="mt-2 w-full rounded-card border border-brand-lift bg-brand-l p-3 text-[12.5px]">
          <p className="font-semibold text-ink">
            {plan.silence === "" ? plan.message : "Aucune inscription ne sera rouverte."}
          </p>
          {plan.silence === "" ? (
            <p className="mt-1 text-muted">
              Le délai court depuis leur dernier message, pas depuis maintenant. Rien ne part sans
              validation : les personnes dues entrent dans la prochaine composition.
            </p>
          ) : (
            <p className="mt-1 text-muted">{plan.silence}</p>
          )}
          {plan.exclusions !== "" && <p className="mt-1 text-muted">{plan.exclusions}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {plan.silence === "" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void apply()}
                className="min-h-[44px] rounded-control bg-brand px-3 text-[12.5px] font-semibold text-white hover:bg-brand-d disabled:opacity-50 lg:min-h-0 lg:py-1.5"
              >
                Relancer
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => setPlan(null)}
              className="min-h-[44px] rounded-control border border-line bg-surface px-3 text-[12.5px] hover:bg-surface-2 lg:min-h-0 lg:py-1.5"
            >
              {plan.silence === "" ? "Annuler" : "Fermer"}
            </button>
          </div>
        </div>
      )}

      {error !== null && <p className="mt-2 w-full text-[12px] text-danger">{error}</p>}
      {done !== null && <p className="mt-2 w-full text-[12px] text-win-d">{done}</p>}
    </>
  );
}
