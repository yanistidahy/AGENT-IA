import Link from "next/link";
import type { Alert, AlertLevel } from "@/lib/domain/types";

/**
 * Liste « à traiter », alimentée par le moteur d'alertes.
 *
 * Chaque ligne mène à la vue qui montre la fiche concernée. Le centre de
 * pilotage du jalon 5 ouvrira le tiroir directement ; d'ici là, un lien filtré
 * vaut mieux qu'une ligne inerte.
 */
const STYLES: Record<AlertLevel, string> = {
  hi: "border-[#F0C9C2] bg-pulse-l",
  md: "border-[#F0DFB8] bg-gold-l",
  low: "border-line bg-surface-2",
};

const DOTS: Record<AlertLevel, string> = {
  hi: "bg-pulse",
  md: "bg-gold",
  low: "bg-line",
};

/**
 * Destination d'une alerte : la fiche concernée, tiroir ouvert.
 *
 * `?fiche=` est lu par les vues Affaires et Contacts, qui chargent la fiche même
 * si elle sort du filtre courant — cliquer une alerte ouvre donc toujours le bon
 * enregistrement. Les tâches n'ont pas de tiroir : elles mènent à leur groupe
 * d'urgence dans /taches.
 */
function hrefFor(alert: Alert): string {
  switch (alert.targetType) {
    case "deal":
      return `/affaires?status=all&fiche=${encodeURIComponent(alert.targetId)}`;
    case "contact":
      return `/contacts?lifecycle=all&fiche=${encodeURIComponent(alert.targetId)}`;
    case "task":
      return "/taches";
  }
}

export function AlertList({ alerts, limit = 8 }: { alerts: readonly Alert[]; limit?: number }) {
  if (alerts.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
        Rien à traiter : aucune tâche en retard, aucune affaire silencieuse, aucun rappel dû.
      </p>
    );
  }

  const shown = alerts.slice(0, limit);

  return (
    <>
      <ul className="grid gap-1.5">
        {shown.map((alert) => (
          <li key={`${alert.kind}-${alert.targetId}`}>
            <Link
              href={hrefFor(alert)}
              className={`flex items-start gap-2.5 rounded-card border px-3.5 py-2.5 transition-colors hover:border-flux ${STYLES[alert.level]}`}
            >
              <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${DOTS[alert.level]}`} />
              <span className="min-w-0">
                <b className="block text-[13px] font-semibold">{alert.title}</b>
                <span className="block text-[12.5px] text-muted">{alert.detail}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {alerts.length > shown.length && (
        <p className="mt-2 text-[12.5px] text-muted">
          … et {alerts.length - shown.length} autre(s).
        </p>
      )}
    </>
  );
}
