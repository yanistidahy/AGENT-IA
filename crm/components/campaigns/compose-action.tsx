"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";

/**
 * « Écrire les mails » : le plan, puis le travail.
 *
 * **C'est le seul geste qui dépense.** Enregistrer une campagne est une
 * configuration : cela n'appelle aucun modèle, n'écrit aucun brouillon, et se
 * refait autant de fois qu'on veut. L'écriture, elle, se demande ici — et elle
 * se demande en deux temps : le premier clic rend le plan sans rien facturer,
 * le second dépense. La règle « aucune écriture sans clic » du jalon 8 vaut
 * d'autant plus quand l'écriture se facture.
 *
 * Le plan dit **trois** nombres plutôt qu'un, parce qu'ils n'engagent pas la
 * même chose :
 *
 * - `fresh` — des contacts qui n'ont encore rien reçu : du travail neuf ;
 * - `rewritten` — des brouillons en attente qui seront **reconstruits** avec
 *   les consignes du jour. C'est délibéré : changer l'angle d'une étape doit
 *   pouvoir profiter à ce qui n'est pas encore parti ;
 * - `edited` — parmi eux, ceux **retouchés à la main**. C'est le seul chiffre
 *   qui coûte quelque chose à l'utilisateur, et il est annoncé **avant**,
 *   jamais découvert après.
 *
 * Les contacts déjà servis ne sont jamais recomposés d'ici : on ne réécrit pas
 * un message qui est parti.
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
  readonly fresh: number;
  readonly rewritten: number;
  readonly edited: number;
}

interface Outcome {
  readonly composed: number;
  readonly background: boolean;
  readonly drafts: number;
  readonly rewritten: number;
  readonly edited: number;
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

const plural = (n: number, one: string, many = `${one}s`): string => (n > 1 ? many : one);

/** Qui va être écrit, et qui ne le sera pas. Une phrase, pas un tableau de bord. */
export function describeScope(plan: {
  readonly fresh: number;
  readonly rewritten: number;
}): string {
  const parts: string[] = [];
  if (plan.fresh > 0) {
    parts.push(
      `${plan.fresh} contact${plural(plan.fresh, "")} qui n'${plan.fresh > 1 ? "ont" : "a"} encore rien reçu`,
    );
  }
  if (plan.rewritten > 0) {
    parts.push(
      `${plan.rewritten} brouillon${plural(plan.rewritten, "")} en attente, réécrit${plural(plan.rewritten, "")} avec les consignes du jour`,
    );
  }
  return parts.join(" · ");
}

/**
 * L'avertissement des retouches à la main.
 *
 * Il nomme **combien**, parce qu'un « certains brouillons seront remplacés » ne
 * se décide pas : on ne sait pas s'il s'agit d'un texte ou de douze.
 */
export function describeEdited(edited: number): string | null {
  if (edited <= 0) return null;
  return edited === 1
    ? "1 brouillon que vous avez retouché à la main sera remplacé."
    : `${edited} brouillons que vous avez retouchés à la main seront remplacés.`;
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

  const edited = plan === null ? null : describeEdited(plan.edited);

  return (
    <>
      <button
        type="button"
        onClick={() => void askPlan()}
        disabled={busy}
        title="Écrit les brouillons des inscrits qui n'ont pas encore reçu leur message. Rien n'est envoyé."
        className="min-h-[44px] rounded-control border border-brand px-3 text-brand-d hover:bg-brand-l disabled:opacity-50 lg:min-h-0 lg:py-1"
      >
        Écrire les mails
      </button>

      {plan !== null && (
        <div className="mt-2 w-full rounded-control border border-brand bg-brand-l px-3 py-2">
          {plan.blocked === null ? (
            <>
              <p>
                <strong className="font-semibold">
                  {plan.estimate.drafts} brouillon{plan.estimate.drafts > 1 ? "s" : ""} à écrire
                </strong>{" "}
                — {describeScope(plan)}.
              </p>
              <p className="mt-1">
                {plan.estimate.drafts} appel{plan.estimate.drafts > 1 ? "s" : ""} au modèle, environ{" "}
                <strong className="font-semibold">{cost(plan.estimate.micros)}</strong> (
                {plan.estimate.model}, {describeSource(plan.estimate.source)}).{" "}
                <strong className="font-semibold">Rien n'est envoyé</strong> : la file se relit et se
                valide à la main, et c'est l'envoi qui démarre la séquence.
                {plan.estimate.background &&
                  " Au-delà de dix brouillons, l'écriture se fait en arrière-plan."}
              </p>
              <p className="mt-1 text-muted">
                Les contacts déjà servis ne sont pas réécrits.
              </p>
              {edited !== null && (
                <p className="mt-1 font-semibold text-danger">{edited}</p>
              )}
            </>
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
                {busy ? "Écriture en cours…" : "Écrire maintenant"}
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
