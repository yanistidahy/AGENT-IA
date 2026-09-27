import { FunnelRow } from "@/components/emails/funnel-row";
import type { CampaignFunnel } from "@/lib/api/campaigns";

/**
 * L'entonnoir de la campagne et sa barre d'avancement.
 *
 * Extrait de `campaign-detail.tsx`, qui dépassait la limite de 250 lignes du
 * projet. L'entonnoir vient de `readFunnelFacts` avec une portée, comme celui de
 * /emails (jalon 55) : il n'y a qu'une addition, et ce composant ne fait que la
 * rendre.
 */
export function CampaignProgress({
  funnel,
  progress,
}: {
  readonly funnel: CampaignFunnel;
  readonly progress: { readonly ratio: number; readonly label: string };
}) {
  const percent = Math.round(progress.ratio * 100);
  return (
    <div className="mb-4 rounded-card border border-line bg-surface p-4 shadow-card">
      <FunnelRow steps={funnel.steps} />
      <div className="mt-3">
        <div
          className="h-1.5 overflow-hidden rounded-full bg-line-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-label={`Avancement de la séquence : ${progress.label}`}
        >
          <div className="h-full rounded-full bg-brand" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-1 text-[12px] text-muted">
          {progress.label} · {funnel.running} inscription
          {funnel.running > 1 ? "s" : ""} active{funnel.running > 1 ? "s" : ""}
        </p>
      </div>
    </div>
  );
}
