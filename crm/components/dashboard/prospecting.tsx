import type { ProspectingMetrics, WeekReview } from "@/lib/api/dashboard";
import { ACTIVITY_LABELS } from "@/lib/domain/types";
import { toActivityType } from "@/lib/domain/guards";
import { KpiCard } from "./kpi-card";
import { describeDelta, EMPTY_HINTS } from "@/lib/domain/kpi-delta";

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
    <div className="mb-5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
      <KpiCard
        label="Contacts"
        value={String(metrics.total)}
        href="/contacts?lifecycle=all"
        delta={describeDelta(metrics.createdThisWeek, metrics.createdPreviousWeek, "semaine dernière")}
        hint={metrics.byLifecycle.map((row) => `${row.value} ${row.label}`).join(" · ")}
      />
      <KpiCard
        label="Contactés cette semaine"
        value={String(metrics.contactedThisWeek)}
        href="/contacts?lifecycle=all&followUp=recent"
        delta={describeDelta(
          metrics.contactedThisWeek,
          metrics.contactedPreviousWeek,
          "semaine dernière",
        )}
      />
      <KpiCard
        label="Taux de réponse (30 j)"
        value={metrics.responseRate === null ? null : `${metrics.responseRate} %`}
        href="/contacts?lifecycle=all&followUp=answered"
        delta={
          metrics.responseRate === null
            ? null
            : describeDelta(metrics.responseRate, metrics.responseRatePrevious, "30 j précédents")
        }
        hint="sur les échanges dont l'issue est connue"
        emptyExplanation={EMPTY_HINTS.responseRate}
      />
      <KpiCard
        label="Jamais contactés"
        value={String(metrics.neverContacted)}
        href="/contacts?lifecycle=all&followUp=never"
        // Aucune comparaison ici : rien en base ne dit combien de fiches
        // n'avaient jamais été approchées la semaine dernière. Inventer une
        // tendance sur une donnée qu'on n'a pas serait pire qu'un chiffre nu.
        hint="aucun échange consigné, jamais"
      />
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
