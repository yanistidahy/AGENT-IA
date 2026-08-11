import type { DealRecord } from "@/lib/api/deals";
import { averageDealSize, weighted, weightedValue } from "@/lib/domain/pipeline";
import type { StageLike } from "@/lib/domain/types";
import { money, moneyShort } from "@/lib/format";

/**
 * « Le Flux » — bandeau signature du prototype.
 *
 * Chaque segment occupe une fraction de la piste proportionnelle au montant de
 * son étape ; un minimum de 4 % garantit qu'une étape non vide reste visible.
 * L'étape terminale « Gagné » est exclue : la piste montre le pipeline en cours,
 * pas le chiffre d'affaires déjà signé.
 */
interface FluxbarProps {
  readonly deals: readonly DealRecord[];
  readonly stages: readonly StageLike[];
}

export function Fluxbar({ deals, stages }: FluxbarProps) {
  const total = deals.reduce((sum, deal) => sum + deal.amount, 0);
  const weightedTotal = weighted(deals, stages);

  const segments = stages
    .filter((stage) => stage.prob < 100)
    .map((stage) => {
      const stageDeals = deals.filter((deal) => deal.stageId === stage.id);
      return {
        stage,
        count: stageDeals.length,
        amount: stageDeals.reduce((sum, deal) => sum + deal.amount, 0),
      };
    });

  const trackTotal = Math.max(
    1,
    segments.reduce((sum, segment) => sum + segment.amount, 0),
  );

  return (
    <section className="overflow-hidden rounded-card bg-ink px-[18px] py-4 text-white shadow-card">
      <div className="mb-3.5 flex flex-wrap items-baseline gap-x-3.5 gap-y-2">
        <Metric label="Valeur totale" value={money(total)} />
        <Separator />
        <Metric label="Montant pondéré" value={money(Math.round(weightedTotal))} accent />
        <Separator />
        <Metric label="Affaires" value={String(deals.length)} />
        <Separator />
        <Metric label="Panier moyen" value={moneyShort(averageDealSize(deals))} />
      </div>

      <div className="flex h-[34px] gap-0.5 overflow-hidden rounded-[7px] bg-ink-2">
        {segments.map((segment) => (
          <div
            key={segment.stage.id}
            title={`${segment.stage.name} — ${segment.count} affaires · ${money(segment.amount)}`}
            className="grid min-w-0.5 place-items-center overflow-hidden transition-[flex] duration-500"
            style={{
              flex: Math.max(segment.amount / trackTotal, 0.04),
              backgroundColor: segment.stage.color,
            }}
          >
            {segment.amount > 0 && (
              <span className="font-mono text-[10.5px] font-semibold whitespace-nowrap text-white/95">
                {moneyShort(segment.amount)}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {segments.map((segment) => (
          <span
            key={segment.stage.id}
            className="flex items-center gap-1.5 text-[11.5px] text-[#9AA4CE]"
          >
            <i
              aria-hidden
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: segment.stage.color }}
            />
            {segment.stage.name} · {segment.count}
          </span>
        ))}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[9.5px] tracking-[0.14em] text-[#828CBC] uppercase">
        {label}
      </div>
      <div
        className={`font-display text-[26px] font-semibold tracking-tight tabular-nums ${
          accent ? "text-brand" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Separator() {
  return <span aria-hidden className="h-[26px] w-px bg-[#232B5C]" />;
}

/** Réexporté pour la fiche : même calcul, même arrondi. */
export { weightedValue };
