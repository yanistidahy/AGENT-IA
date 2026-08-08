import type { ProspectingMetrics, WeekReview } from "@/lib/api/dashboard";
import { ACTIVITY_LABELS } from "@/lib/domain/types";
import { toActivityType } from "@/lib/domain/guards";

/**
 * Cartes de prospection, affichées **à la place** des cartes de revenu tant
 * qu'aucune affaire n'existe.
 *
 * Trois zéros en euros n'apprennent rien à quelqu'un qui n'a pas encore créé
 * d'affaire : ils occupent la place de ce qu'il fait réellement. Les cartes de
 * revenu reviennent seules dès la première affaire — l'écran suit l'état, il ne
 * demande pas de réglage.
 */
export function ProspectingCards({ metrics }: { metrics: ProspectingMetrics }) {
  return (
    <div className="mb-5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
      <Card
        label="Contacts"
        value={String(metrics.total)}
        hint={metrics.byLifecycle.map((row) => `${row.value} ${row.label}`).join(" · ")}
      />
      <Card label="Contactés cette semaine" value={String(metrics.contactedThisWeek)} />
      <Card
        label="Taux de réponse (30 j)"
        value={metrics.responseRate === null ? "—" : `${metrics.responseRate} %`}
        hint={
          metrics.responseRate === null
            ? "aucune interaction avec issue renseignée"
            : "sur les échanges dont l'issue est connue"
        }
      />
      <Card label="Jamais contactés" value={String(metrics.neverContacted)} />
    </div>
  );
}

/**
 * « Ma semaine » : ce qui a été fait, et ce qui était prévu et ne l'a pas été.
 *
 * Le second chiffre est le seul qui dise si on a prospecté. Un compteur
 * d'interactions seul ne distingue pas l'activité de la discipline.
 */
export function WeekCard({ week }: { week: WeekReview }) {
  const total = week.byType.reduce((sum, row) => sum + row.value, 0);

  return (
    <div className="rounded-card border border-line bg-surface px-3.5 py-3 shadow-card">
      <p className="text-[13px]">
        <b className="font-mono text-[15px] font-semibold">{total}</b> interaction(s) sur 7 jours
        {total > 0 && (
          <span className="text-muted">
            {" — "}
            {week.byType
              .map((row) => `${row.value} ${ACTIVITY_LABELS[toActivityType(row.label)]}`)
              .join(" · ")}
          </span>
        )}
      </p>
      <p className="mt-1 text-[13px]">
        <b className="font-mono text-[15px] font-semibold text-flux-d">
          {week.remindersHonoured}
        </b>{" "}
        relance(s) honorée(s) ·{" "}
        <b className="font-mono text-[15px] font-semibold text-[#B2311F]">
          {week.remindersMissed}
        </b>{" "}
        en retard
      </p>
    </div>
  );
}

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-3.5 py-3 shadow-card">
      <span className="font-mono text-[10px] tracking-[0.1em] text-muted uppercase">{label}</span>
      <div className="mt-0.5 font-display text-[22px] font-semibold tabular-nums">{value}</div>
      {hint !== undefined && hint !== "" && (
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{hint}</p>
      )}
    </div>
  );
}
