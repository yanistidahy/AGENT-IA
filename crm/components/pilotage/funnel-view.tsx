import Link from "next/link";
import { NO_DATA, rateLabel, type FunnelStep, type Metric } from "@/lib/domain/pilotage";

/**
 * L'entonnoir, en personnes, des contactés aux clients.
 *
 * **Nombres ou pourcentages, et le choix vit dans l'URL** : la vue se met en
 * favori, et elle survit à un rechargement (la règle du jalon 1).
 *
 * Les marches dont un chiffre a une liste sont cliquables ; les autres —
 * l'essai, le client — n'ont pas encore de source dans l'historique et le
 * disent en gris plutôt qu'en zéro trompeur.
 */

/** La marche porte une liste quand la métrique correspondante en a une. */
const DRILL: Partial<Record<FunnelStep["stage"], Metric>> = {
  contacted: "contacted",
  replied: "replies",
  positive: "positive",
  demo_sent: "demos_sent",
  demo_tested: "demos_tested",
  qualified: "qualified",
};

export function FunnelView({
  steps,
  asShare,
  toggleHref,
  href,
}: {
  readonly steps: readonly FunnelStep[];
  readonly asShare: boolean;
  readonly toggleHref: string;
  readonly href: (metric: Metric) => string;
}) {
  const empty = steps.every((step) => step.contactIds.length === 0);

  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3.5">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">
          Entonnoir
          <span className="ml-2 text-[12px] font-normal text-muted">en personnes</span>
        </h2>
        <Link
          href={toggleHref}
          data-funnel-toggle
          className="rounded-control border border-line px-2.5 py-1 text-[12px] font-semibold transition-colors hover:bg-surface-2"
        >
          {asShare ? "Voir les nombres" : "Voir les pourcentages"}
        </Link>
      </header>

      {empty ? (
        <p className="text-[13px] text-muted">{NO_DATA}</p>
      ) : (
        <ol className="space-y-1.5">
          {steps.map((step) => {
            const count = step.contactIds.length;
            // La largeur vient de la **part calculée par le domaine**, jamais
            // d'une division écrite ici : deux divisions finissent par ne plus
            // dire la même chose, et la garde statique interdit la seconde.
            const width = step.share === null ? 0 : Math.max(2, Math.round(step.share * 100));
            const metric = DRILL[step.stage];
            const shown = asShare ? rateLabel(step.share) : String(count);

            const row = (
              <div className="flex items-center gap-3">
                <span className="w-[136px] flex-none truncate text-[12.5px] text-muted">
                  {step.label}
                </span>
                <span className="relative h-7 flex-1 overflow-hidden rounded-control bg-surface-2">
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0 rounded-control bg-brand-l"
                    style={{ width: `${width}%` }}
                  />
                  <span className="relative flex h-full items-center px-2.5 text-[13px] font-semibold tabular-nums">
                    {shown}
                  </span>
                </span>
              </div>
            );

            return (
              <li key={step.stage} data-funnel-stage={step.stage} data-count={count}>
                {metric === undefined ? (
                  <div className="opacity-70">{row}</div>
                ) : (
                  <Link
                    href={href(metric)}
                    className="block rounded-control transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                  >
                    {row}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
