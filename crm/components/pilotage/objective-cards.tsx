import Link from "next/link";
import type { Metric } from "@/lib/domain/pilotage";

/**
 * **Les trois objectifs de la semaine, en haut de l'écran.**
 *
 * Trois et pas six : messages, démos envoyées, démos qualifiées. Ce sont les
 * trois seuls chiffres sur lesquels on peut agir cet après-midi, et une rangée
 * de six cartes d'objectif ne se lit plus comme un objectif — elle se lit comme
 * un tableau.
 *
 * **La phrase sous la barre dit quoi faire, pas où l'on en est** : « Il en
 * manque 8 d'ici dimanche » plutôt que « 92 % de l'objectif ». Le pourcentage
 * est une note, le reste à faire est une action. Au-dessus de l'objectif, la
 * carte reconnaît le dépassement (« Objectif atteint ×3,5 ») au lieu d'afficher
 * une barre pleine muette.
 *
 * La barre se plafonne visuellement, **la valeur non** : dépasser est une
 * information (la règle de `progress`, jalon 109).
 */

export interface Objective {
  readonly metric: Metric;
  readonly label: string;
  readonly value: number;
  readonly target: number;
  /** La phrase de `objectiveLabel` — le domaine la décide, pas cette vue. */
  readonly note: string;
  /** `null` hors de la semaine en cours : une cible hebdomadaire ne s'y compare pas. */
  readonly ratio: number | null;
  readonly href: string;
}

export function ObjectiveCards({ objectives }: { readonly objectives: readonly Objective[] }) {
  return (
    <ul data-objectives className="grid gap-3 sm:grid-cols-3">
      {objectives.map((objective) => {
        const reached = objective.ratio !== null && objective.ratio >= 1;
        return (
          <li
            key={objective.metric}
            data-objective={objective.metric}
            data-reached={reached ? "1" : "0"}
            className="rounded-board border border-line bg-surface px-4 py-3.5"
          >
            <Link href={objective.href} className="group block focus:outline-none">
              <p className="text-[12px] font-medium text-muted">{objective.label}</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span
                  data-objective-value
                  className="font-display text-[30px] leading-none font-semibold tracking-tight text-ink group-hover:text-brand-d group-focus-visible:text-brand-d"
                >
                  {objective.value}
                </span>
                <span className="text-[13px] text-muted">
                  / {objective.target}
                </span>
              </p>

              {objective.ratio === null ? (
                <p className="mt-2.5 text-[12px] text-muted">
                  Objectif hebdomadaire : il ne se compare pas à cette période.
                </p>
              ) : (
                <>
                  <div
                    className="mt-2.5 h-2 overflow-hidden rounded-full bg-line-2"
                    role="presentation"
                  >
                    <div
                      data-objective-bar
                      className={`h-full rounded-full ${reached ? "bg-win" : "bg-brand"}`}
                      style={{ width: `${Math.min(100, Math.round(objective.ratio * 100))}%` }}
                    />
                  </div>
                  <p
                    data-objective-note
                    className={`mt-1.5 text-[12px] font-medium ${reached ? "text-win-d" : "text-closed"}`}
                  >
                    {objective.note}
                  </p>
                </>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
