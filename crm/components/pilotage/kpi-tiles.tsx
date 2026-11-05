import Link from "next/link";
import { progress, rateLabel, type Metric } from "@/lib/domain/pilotage";

/**
 * Les pastilles du pilotage.
 *
 * **Chaque nombre est un lien**, et il ouvre la liste des personnes derrière
 * lui. Le nombre vient de `metricResult` et la liste du même appel, donc ils ne
 * peuvent pas se contredire : c'est la règle du jalon 105, appliquée ici.
 *
 * Aucun calcul dans ce fichier — il reçoit des nombres déjà faits. Une garde
 * statique échoue si un composant du tableau de bord se met à compter.
 */

export interface Tile {
  readonly metric: Metric | null;
  readonly label: string;
  /** Déjà formaté : un taux porte son signe, un compte est un entier. */
  readonly value: string;
  /** Le nombre brut, pour la barre de progression. `null` pour un taux. */
  readonly actual: number | null;
  readonly target: number | null;
  readonly hint?: string;
}

export function KpiTiles({
  tiles,
  href,
}: {
  readonly tiles: readonly Tile[];
  readonly href: (metric: Metric) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {tiles.map((tile) => (
        <TileCard key={tile.label} tile={tile} href={href} />
      ))}
    </div>
  );
}

function TileCard({
  tile,
  href,
}: {
  readonly tile: Tile;
  readonly href: (metric: Metric) => string;
}) {
  const share = tile.actual === null || tile.target === null ? null : progress(tile.actual, tile.target);

  const body = (
    <>
      <div className="text-[12px] leading-tight font-medium text-muted">{tile.label}</div>
      <div className="mt-1 font-display text-[26px] leading-none font-semibold tabular-nums">
        {tile.value}
        {tile.target !== null && tile.target > 0 && (
          <span className="ml-1 text-[13px] font-medium text-muted">/ {tile.target}</span>
        )}
      </div>
      {share !== null && (
        <div className="mt-2.5">
          {/* La barre se plafonne visuellement, le pourcentage non : dépasser
              l'objectif est une information, pas un débordement à masquer. */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line-2">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.min(100, Math.round(share * 100))}%` }}
            />
          </div>
          <div className="mt-1 text-[11px] text-muted tabular-nums">
            {rateLabel(share)} de la cible de la semaine
          </div>
        </div>
      )}
      {tile.hint !== undefined && (
        <div className="mt-2 text-[11px] leading-snug text-muted">{tile.hint}</div>
      )}
    </>
  );

  const shell =
    "block rounded-card border border-line bg-surface px-3.5 py-3 transition-colors";

  if (tile.metric === null) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <Link
      href={href(tile.metric)}
      data-kpi={tile.metric}
      data-count={tile.actual ?? ""}
      className={`${shell} hover:border-brand hover:bg-brand-l/40 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none`}
    >
      {body}
    </Link>
  );
}
