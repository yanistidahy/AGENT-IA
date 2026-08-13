import Link from "next/link";
import type { Delta } from "@/lib/domain/kpi-delta";

/**
 * Une carte d'indicateur qui dit quelque chose.
 *
 * Trois ajouts, chacun répondant à un défaut précis du tableau de bord
 * précédent :
 *
 * 1. **une comparaison**, parce qu'un nombre seul ne se juge pas — 31 contactés
 *    est une bonne semaine ou une mauvaise selon la précédente ;
 * 2. **un lien**, parce qu'un chiffre sur lequel on ne peut pas cliquer oblige à
 *    reconstruire le filtre à la main dans une autre vue ;
 * 3. **une explication quand la valeur manque**. Un « — » ressemble à une panne.
 *    La vraie information est qu'il manque une saisie, et laquelle.
 */
const TONES = {
  good: "text-win-d",
  bad: "text-[#B2311F]",
  flat: "text-muted",
} as const;

export interface KpiCardProps {
  readonly label: string;
  /** `null` déclenche l'état vide et son explication. */
  readonly value: string | null;
  readonly href: string;
  readonly delta?: Delta | null;
  readonly hint?: string;
  /** Ce qu'il faut faire pour que la valeur existe. Obligatoire si `value` est nul. */
  readonly emptyExplanation?: string;
}

export function KpiCard({
  label,
  value,
  href,
  delta,
  hint,
  emptyExplanation,
}: KpiCardProps) {
  return (
    <Link
      href={href}
      className="block rounded-card border border-line bg-surface px-3.5 py-3 shadow-card transition-colors hover:border-brand hover:bg-surface-2"
    >
      <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">{label}</span>

      <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
        <span
          className={`font-display text-[22px] font-semibold tabular-nums ${
            value === null ? "text-muted" : ""
          }`}
        >
          {value ?? "—"}
        </span>
        {delta !== undefined && delta !== null && (
          <span className={`font-mono text-[11px] font-semibold ${TONES[delta.tone]}`}>
            {delta.text}
          </span>
        )}
      </div>

      {value === null && emptyExplanation !== undefined ? (
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-[#9A6410]">{emptyExplanation}</p>
      ) : (
        hint !== undefined &&
        hint !== "" && <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{hint}</p>
      )}
    </Link>
  );
}
