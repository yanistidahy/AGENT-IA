import type { FunnelRow } from "@/lib/domain/kpis";
import { moneyShort } from "@/lib/format";

/**
 * Entonnoir de conversion.
 *
 * La largeur d'une barre est proportionnelle au nombre d'affaires ayant atteint
 * l'étape, et le taux affiché est le passage depuis l'étape précédente — c'est
 * le nombre qui dit *où* ça bloque, plus que les volumes absolus.
 */
export function Funnel({ rows }: { rows: readonly FunnelRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line px-3.5 py-6 text-center text-[12.5px] text-muted">
        Aucune étape configurée.
      </p>
    );
  }

  const max = Math.max(...rows.map((row) => row.count), 1);

  return (
    <div className="grid gap-1.5">
      {rows.map((row) => (
        <div key={row.stageId} className="flex items-center gap-3">
          {/* Sous `lg`, le libellé cède la moitié de sa largeur et le montant
              disparaît : la barre et le taux de passage sont la lecture. */}
          <span className="w-[150px] shrink-0 truncate text-[12.5px] max-lg:w-[92px]">{row.label}</span>
          <div className="h-6 flex-1 overflow-hidden rounded-control bg-paper">
            <div
              className="flex h-full items-center justify-end rounded-control px-2"
              style={{
                width: `${Math.max((row.count / max) * 100, row.count > 0 ? 6 : 0)}%`,
                backgroundColor: `${row.color}2e`,
                borderRight: `3px solid ${row.color}`,
              }}
            >
              <span className="font-mono text-[11px] font-semibold" style={{ color: row.color }}>
                {row.count}
              </span>
            </div>
          </div>
          <span className="w-[76px] shrink-0 text-right font-mono text-[11.5px] text-muted tabular-nums max-lg:hidden">
            {moneyShort(row.amount)}
          </span>
          <span className="w-[54px] shrink-0 text-right font-mono text-[11.5px] tabular-nums">
            {row.rate === null ? (
              <span className="text-muted">—</span>
            ) : (
              <span className={row.rate < 50 ? "font-semibold text-[#B2311F]" : "text-muted"}>
                {row.rate} %
              </span>
            )}
          </span>
        </div>
      ))}
      <p className="mt-1 text-[11.5px] text-muted">
        Le pourcentage est le taux de passage depuis l'étape précédente. En rouge sous 50 %.
      </p>
    </div>
  );
}
