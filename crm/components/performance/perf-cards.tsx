import type { ChannelVolume, Performance } from "@/lib/api/performance";
import type { Delta } from "@/lib/domain/performance";
import { formatRate } from "@/lib/domain/email-stats";
import { ACTIVITY_LABELS } from "@/lib/domain/types";
import { OUTCOME_LABELS, isOutcome } from "@/lib/domain/status";

/**
 * Les cartes de volume et de résultat de « Ma performance ».
 *
 * **La comparaison porte le sens, pas le signe.** « +8 appels » est une bonne
 * nouvelle ; « +8 jours sans contact » n'en serait pas une — ici tous les
 * compteurs mesurent de l'activité ou du résultat, donc la hausse est verte.
 * La période de référence est nommée dans la légende plutôt que devinée.
 */

export function DeltaBadge({ value, vs }: { readonly value: Delta; readonly vs: string }) {
  if (value.previous === 0 && value.current === 0) return null;
  const text =
    value.direction === "flat"
      ? `= ${vs}`
      : `${value.diff > 0 ? "+" : "−"}${Math.abs(value.diff)} ${vs}`;
  return (
    <span
      className={`text-[11px] font-medium tabular-nums ${
        value.direction === "up"
          ? "text-win-d"
          : value.direction === "down"
            ? "text-[#B2311F]"
            : "text-muted"
      }`}
    >
      {text}
    </span>
  );
}

export function StatCard({
  label,
  value,
  delta,
  vs,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly delta?: Delta;
  readonly vs?: string;
  readonly hint?: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface px-3.5 py-2.5 shadow-card">
      <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-2">
        <span className="font-display text-[24px] leading-tight font-semibold tabular-nums">
          {value}
        </span>
        {delta !== undefined && vs !== undefined && <DeltaBadge value={delta} vs={vs} />}
      </p>
      {hint !== undefined && <p className="text-[11px] leading-snug text-muted">{hint}</p>}
    </div>
  );
}

/**
 * Les issues des appels, en une ligne sous la carte : « pas de réponse »,
 * « parlé », « mauvais interlocuteur ». C'est la ventilation demandée, et elle
 * ne mérite pas un graphique — trois nombres se lisent plus vite que trois
 * barres.
 */
export function CallOutcomes({
  outcomes,
}: {
  readonly outcomes: Performance["callOutcomes"];
}) {
  if (outcomes.length === 0) return null;
  return (
    <p className="mt-1 text-[11px] leading-relaxed text-muted">
      {outcomes
        .map(
          (entry) =>
            `${isOutcome(entry.outcome) ? OUTCOME_LABELS[entry.outcome] : entry.outcome} : ${entry.count}`,
        )
        .join(" · ")}
    </p>
  );
}

/**
 * Le taux de réponse par canal — **le nombre qui dit quel canal marche**.
 *
 * Le taux se calcule sur les interactions **à l'issue connue** : une issue non
 * renseignée n'est pas un échec, c'est une donnée manquante, et la compter en
 * non-réponse gonflerait l'échec — règle du jalon 13, reprise.
 */
export function ChannelRates({ channels }: { readonly channels: readonly ChannelVolume[] }) {
  const active = channels.filter((channel) => channel.count.current > 0);
  if (active.length === 0) {
    return <p className="text-[12px] text-muted">Aucune interaction sur la période.</p>;
  }

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {["Canal", "Volume", "Issues connues", "Réponses", "Taux"].map((label, index) => (
            <th
              key={label}
              scope="col"
              className={`border-b border-line bg-surface-2 px-3 py-1.5 font-mono text-[9.5px] font-medium tracking-[0.12em] whitespace-nowrap text-muted uppercase ${
                index === 0 ? "text-left" : "text-right"
              }`}
            >
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {active.map((channel) => (
          <tr key={channel.channel}>
            <td className="border-b border-line-2 px-3 py-1.5 text-[12.5px] font-medium">
              {ACTIVITY_LABELS[channel.channel]}
            </td>
            <Num value={String(channel.count.current)} />
            <Num value={String(channel.known)} />
            <Num value={String(channel.answered)} />
            <Num value={formatRate(channel.rate)} strong />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Num({ value, strong = false }: { readonly value: string; readonly strong?: boolean }) {
  return (
    <td
      className={`border-b border-line-2 px-3 py-1.5 text-right font-mono text-[12px] tabular-nums ${
        strong ? "font-semibold" : "text-muted"
      }`}
    >
      {value}
    </td>
  );
}
