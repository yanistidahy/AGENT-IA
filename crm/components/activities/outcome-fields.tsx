"use client";

import { Combobox, type ComboboxValue } from "@/components/ui/combobox";
import { LOST_REASONS } from "@/lib/domain/lost";
import {
  OUTCOMES,
  OUTCOME_LABELS,
  STATUS_SUGGESTIONS,
  type Outcome,
} from "@/lib/domain/status";

/**
 * Issue de l'échange, statut qui en découle, et motif de perte.
 *
 * Extrait du formulaire d'interaction pour le garder sous la limite de 250
 * lignes, mais aussi parce que ces trois champs forment une seule décision :
 * ce qu'on vient d'apprendre, et ce que la fiche doit dire ensuite.
 */
const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[13.5px] outline-none focus:border-flux";

export interface OutcomeFieldsProps {
  readonly outcome: Outcome | "";
  readonly onOutcome: (value: Outcome) => void;
  readonly status: ComboboxValue;
  readonly onStatus: (value: ComboboxValue) => void;
  readonly lostReason: string;
  readonly onLostReason: (value: string) => void;
  readonly needsLostReason: boolean;
  readonly lifecycle: string | null;
  readonly suggestions: readonly string[];
  readonly error?: string[];
}

export function OutcomeFields(props: OutcomeFieldsProps) {
  const options = [...new Set([...props.suggestions, ...STATUS_SUGGESTIONS])].map((value) => ({
    id: value,
    label: value,
  }));

  return (
    <fieldset className="grid gap-2.5 rounded-control border border-line bg-surface px-3 py-2.5">
      <legend className="px-1 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        Résultat de l'échange
      </legend>

      <div className="grid gap-1.5 sm:grid-cols-2">
        {OUTCOMES.map((value) => (
          <label
            key={value}
            className={`flex cursor-pointer items-center gap-2 rounded-control border px-2.5 py-1.5 text-[13px] transition-colors ${
              props.outcome === value
                ? "border-flux bg-flux-l text-flux-d"
                : "border-line hover:bg-surface-2"
            }`}
          >
            <input
              type="radio"
              name="outcome"
              value={value}
              checked={props.outcome === value}
              onChange={() => props.onOutcome(value)}
            />
            {OUTCOME_LABELS[value]}
          </label>
        ))}
      </div>

      {props.error !== undefined && props.error.length > 0 && (
        <span className="text-[12px] text-[#B2311F]">{props.error.join(" · ")}</span>
      )}

      {props.outcome !== "" && (
        <>
          <label className="block">
            <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
              Statut du contact après cet échange
            </span>
            <Combobox
              options={options}
              value={props.status}
              onChange={props.onStatus}
              placeholder="Choisir ou écrire un statut…"
              emptyLabel="Laisser le statut calculé"
            />
            <span className="mt-1 block text-[11.5px] leading-relaxed text-muted">
              Laissé vide, le statut reste celui que le CRM calcule à partir des dates.
              Renseigné, il l'emporte partout jusqu'à ce que vous le changiez.
            </span>
          </label>

          {props.lifecycle !== null && (
            <p className="rounded-control border border-[#B9E7DC] bg-flux-l px-2.5 py-1.5 text-[12px] text-flux-d">
              Le cycle de vie passera à <b className="font-semibold">{props.lifecycle}</b>.
            </p>
          )}

          {props.needsLostReason && (
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
                Motif de perte
              </span>
              <input
                list="motifs-de-perte-interaction"
                value={props.lostReason}
                onChange={(event) => props.onLostReason(event.target.value)}
                placeholder="Budget, Timing, Concurrent…"
                className={CONTROL}
              />
              <datalist id="motifs-de-perte-interaction">
                {LOST_REASONS.map((reason) => (
                  <option key={reason} value={reason} />
                ))}
              </datalist>
              <span className="mt-1 block text-[11.5px] leading-relaxed text-muted">
                « Ne souhaite plus être contacté » vaut opposition ferme : plus aucune séquence
                ni relance ne visera cette personne.
              </span>
            </label>
          )}
        </>
      )}
    </fieldset>
  );
}
