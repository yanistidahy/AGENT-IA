import type { Performance } from "@/lib/api/performance";
import type { TargetProgress } from "@/lib/domain/performance";

/**
 * La régularité — ce qui compte plus que les totaux.
 *
 * « 12 jours actifs sur 15 ouvrés » dit plus qu'un total : la prospection est
 * un rythme, et un rythme se juge à ses trous. La journée en cours ne casse
 * pas la série (elle n'est pas finie), et **les week-ends ne comptent ni en
 * jours ouvrés ni en jours cassants** — c'est la règle du samedi posée au
 * jalon 38, appliquée à la mesure.
 */
export function ConsistencyBlock({ perf }: { readonly perf: Performance }) {
  const { consistency, discipline } = perf;

  return (
    <div className="rounded-card border border-line bg-surface px-3.5 py-3 shadow-card">
      <h2 className="mb-2 font-display text-[13px] font-semibold">Régularité</h2>

      <dl className="grid gap-x-4 gap-y-2 text-[12.5px] sm:grid-cols-2">
        <Fact
          label="Jours actifs"
          value={`${consistency.activeDays} sur ${consistency.workingDays} ouvrés`}
        />
        <Fact
          label="Série"
          value={
            consistency.currentStreak === 0
              ? `— · record ${consistency.longestStreak} j`
              : `${consistency.currentStreak} j en cours · record ${consistency.longestStreak} j`
          }
        />
        <Fact
          label="Relances tenues"
          value={
            discipline.honoured + discipline.missed === 0
              ? "aucune échéance sur la période"
              : `${discipline.honoured} tenue${discipline.honoured > 1 ? "s" : ""} · ${discipline.missed} manquée${discipline.missed > 1 ? "s" : ""}`
          }
        />
      </dl>

      <div className="mt-3 grid gap-2">
        <Target label="Appels cette semaine" progress={perf.callTarget} />
        <Target label="Emails cette semaine" progress={perf.emailTarget} />
        {perf.callTarget === null && perf.emailTarget === null && (
          <p className="text-[11.5px] text-muted">
            Aucun objectif hebdomadaire réglé — sans objectif, un nombre n'est qu'un nombre.
            Réglages → Objectifs.
          </p>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="text-[10.5px] font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * La barre d'objectif mesure **toujours la semaine en cours**, quel que soit le
 * sélecteur de période : l'objectif est hebdomadaire, et le rapporter à un mois
 * ou à 90 jours produirait un pourcentage sans signification.
 */
function Target({
  label,
  progress,
}: {
  readonly label: string;
  readonly progress: TargetProgress | null;
}) {
  if (progress === null) return null;
  const reached = progress.done >= progress.target;

  return (
    <div>
      <p className="mb-0.5 flex items-baseline justify-between text-[11.5px]">
        <span className="text-muted">{label}</span>
        <span className={`font-mono tabular-nums ${reached ? "font-semibold text-win-d" : ""}`}>
          {progress.done} / {progress.target}
        </span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-line-2">
        <div
          className={`h-full rounded-full ${reached ? "bg-win" : "bg-brand"}`}
          style={{ width: `${Math.round(progress.share * 100)}%` }}
        />
      </div>
    </div>
  );
}
