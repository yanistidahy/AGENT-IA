"use client";

import { LIFECYCLES, type Lifecycle } from "@/lib/domain/types";

/**
 * Le champ « Cycle de vie », et la seule définition qui ne va pas de soi.
 *
 * `Qualifié` est le seul cycle de vie qui déclenche une écriture ailleurs — une
 * affaire — et le seul dont le sens se discute. Sa définition vit donc **contre
 * le champ**, pas dans une documentation : formulée du point de vue du
 * prospect, parce qu'une étape définie par notre activité se franchit toute
 * seule et ne mesure rien.
 */
const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[14px] outline-none focus:border-brand";

export function LifecycleField({
  value,
  errors,
  onChange,
}: {
  value: Lifecycle;
  errors?: readonly string[];
  onChange: (next: Lifecycle) => void;
}) {
  return (
    <div className="grid gap-1">
      <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        Cycle de vie
      </span>
      <select
        name="lifecycle"
        value={value}
        onChange={(event) => onChange(toLifecycleValue(event.target.value))}
        className={CONTROL}
      >
        {LIFECYCLES.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      <p className="text-[11.5px] leading-relaxed text-muted">
        <b className="font-semibold">Qualifié</b> : le prospect a exprimé le désir de l'offre. Y
        passer ouvre une affaire — le montant sera demandé.
      </p>
      {errors !== undefined &&
        errors.map((message) => (
          <span key={message} className="text-[12px] text-[#B2311F]">
            {message}
          </span>
        ))}
    </div>
  );
}

/** Frontière `string` → union, au seul endroit où la valeur entre. */
export function toLifecycleValue(value: string): Lifecycle {
  return LIFECYCLES.find((candidate) => candidate === value) ?? "Lead";
}
