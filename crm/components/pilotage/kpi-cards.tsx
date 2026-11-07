import Link from "next/link";

/**
 * **Les quatre cartes de la vue d'ensemble.**
 *
 * Chacune porte un grand chiffre, et surtout **ce qui le qualifie** : une
 * évolution, une décomposition, un dénominateur. Un grand nombre seul ne se lit
 * pas — « 37 nouvelles personnes » n'est ni bon ni mauvais tant qu'on ne sait
 * pas ce que valait la semaine d'avant.
 *
 * Tout est déjà calculé par le domaine : cette vue place des éléments et ne
 * décide rien. `tests/pilotage-source.test.ts` échoue si elle se met à composer
 * un taux (`toFixed` y est interdit).
 */

export interface KpiLine {
  readonly label: string;
  readonly value: string;
  /** `null` quand la ligne n'ouvre rien — un taux n'a pas de liste à lui. */
  readonly href: string | null;
}

export interface Kpi {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly href: string | null;
  /** Une phrase sous le chiffre : l'évolution, le dénominateur, la règle. */
  readonly hint?: string;
  /**
   * L'évolution contre la période précédente, **en nombre et non en pourcentage
   * seul** : « +12 contre 25 » dit ce qui a changé, « +48 % » cache que la base
   * était de 25. `null` quand il n'y a rien à comparer (la règle du jalon 20).
   */
  readonly change?: { readonly delta: number; readonly before: number } | null;
  /** La décomposition : par canal pour un taux, par catégorie pour les réponses. */
  readonly lines?: readonly KpiLine[];
  /** Le `n` du taux, affiché tel quel. */
  readonly sample?: React.ReactNode;
}

export function KpiCards({ kpis }: { readonly kpis: readonly Kpi[] }) {
  return (
    <ul data-kpis className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kpis.map((kpi) => (
        <li
          key={kpi.key}
          data-kpi={kpi.key}
          className="flex flex-col rounded-board border border-line bg-surface px-4 py-3.5"
        >
          <p className="text-[12px] font-medium text-muted">{kpi.label}</p>
          <p className="mt-1">
            {kpi.href === null ? (
              <span data-kpi-value className="font-display text-[30px] leading-none font-semibold tracking-tight text-ink">
                {kpi.value}
              </span>
            ) : (
              <Link
                href={kpi.href}
                data-kpi-value
                className="font-display text-[30px] leading-none font-semibold tracking-tight text-ink hover:text-brand-d focus-visible:text-brand-d focus:outline-none"
              >
                {kpi.value}
              </Link>
            )}
          </p>

          {kpi.sample !== undefined && <p className="mt-1.5">{kpi.sample}</p>}

          {kpi.change !== undefined && kpi.change !== null && (
            <p data-kpi-change className="mt-1.5 text-[12px]">
              <span
                className={
                  kpi.change.delta > 0
                    ? "font-medium text-win-d"
                    : kpi.change.delta < 0
                      ? "font-medium text-accent-2"
                      : "text-closed"
                }
              >
                {kpi.change.delta > 0 ? "+" : ""}
                {kpi.change.delta}
              </span>{" "}
              <span className="text-muted">
                contre {kpi.change.before} la période précédente
              </span>
            </p>
          )}

          {kpi.lines !== undefined && kpi.lines.length > 0 && (
            <ul data-kpi-lines className="mt-2.5 space-y-1 border-t border-line-2 pt-2">
              {kpi.lines.map((line) => (
                <li key={line.label} className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="truncate text-muted">{line.label}</span>
                  {line.href === null ? (
                    <span className="font-medium tabular-nums text-ink-2">{line.value}</span>
                  ) : (
                    <Link
                      href={line.href}
                      className="font-medium tabular-nums text-brand-d hover:underline"
                    >
                      {line.value}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}

          {kpi.hint !== undefined && (
            <p className="mt-auto pt-2 text-[11.5px] leading-snug text-muted">{kpi.hint}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
