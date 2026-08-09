import type { Alert, AlertLevel } from "@/lib/domain/types";

/**
 * Avertissements portant sur la fiche ouverte.
 *
 * Les alertes viennent du moteur (`lib/domain/alerts.ts`) filtré sur cette
 * fiche : le tiroir affiche exactement ce que la liste d'alertes affiche, sans
 * règle parallèle qui finirait par diverger.
 */
const STYLES: Record<AlertLevel, string> = {
  hi: "border-[#F0C9C2] bg-pulse-l text-[#B2311F]",
  md: "border-[#F0DFB8] bg-gold-l text-[#9A6410]",
  low: "border-line bg-surface-2 text-muted",
};

export function AlertNotice({ alerts }: { alerts: readonly Alert[] }) {
  if (alerts.length === 0) return null;

  return (
    <ul className="mb-3 grid gap-1.5">
      {alerts.map((alert) => (
        <li
          key={`${alert.kind}-${alert.targetId}`}
          className={`rounded-control border px-3 py-2 text-[12.5px] ${STYLES[alert.level]}`}
        >
          <b className="font-semibold">{alert.title}</b>
          <span className="block opacity-90">{alert.detail}</span>
        </li>
      ))}
    </ul>
  );
}
