import Link from "next/link";
import { parsePilotageQuery, periodOf, readPilotage } from "@/lib/api/pilotage";
import { CHANNEL_LABELS, TYPE_LABELS, replyCategoryLabel } from "@/lib/domain/outreach";
import {
  NO_CAMPAIGN,
  NO_DATA,
  applyFilters,
  campaignKey,
  campaignLabel,
  isMetric,
  metricResult,
  slice,
  type Metric,
} from "@/lib/domain/pilotage";

export const dynamic = "force-dynamic";

/**
 * **Les personnes derrière un chiffre.**
 *
 * La page refait exactement le chemin du tableau de bord — mêmes filtres, même
 * période, **même appel** `metricResult` — et affiche ce qu'il rend. Le nombre
 * de lignes est donc celui de la pastille par construction, et non par
 * coïncidence : il n'y a pas un comptage « pour la pastille » et une requête
 * « pour la liste ». C'est ce que l'item 6 du test d'acceptation vérifie, et
 * c'est l'écart que les jalons 49, 78 et 105 ont payé trois fois.
 */
export default async function PilotageListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = parsePilotageQuery(params);
  const now = new Date();
  const period = periodOf(query, now);

  const raw = Array.isArray(params.metric) ? params.metric[0] : params.metric;
  const metric: Metric = raw !== undefined && isMetric(raw) ? raw : "messages";

  const data = await readPilotage();
  const all = applyFilters(data.rows, query.filters);
  const rows = slice(all, period);
  const result = metricResult(all, rows, period, metric);

  const back = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single !== undefined && single !== "" && key !== "metric") back.set(key, single);
  }

  return (
    <div className="px-6 py-5">
      <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-xl font-semibold tracking-tight">{result.label}</h1>
        <p className="text-[12.5px] text-muted">
          <span data-list-count className="font-semibold tabular-nums">
            {result.count}
          </span>{" "}
          {result.byPerson ? "personne" : "événement"}
          {result.count > 1 ? "s" : ""} · {period.label}
        </p>
        <Link
          href={`/pilotage?${back.toString()}`}
          className="ml-auto rounded-control border border-line bg-surface px-3 py-1.5 text-[13px] font-semibold transition-colors hover:bg-surface-2"
        >
          Retour au pilotage
        </Link>
      </header>

      {result.rows.length === 0 ? (
        <p className="rounded-card border border-line bg-surface px-4 py-6 text-[13px] text-muted">
          {NO_DATA}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line-2 text-left">
                <Th>Contact</Th>
                <Th>Société</Th>
                <Th>Campagne</Th>
                <Th>Canal</Th>
                <Th>Événement</Th>
                <Th>Quand</Th>
                <Th>Propriétaire</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id} data-row className="border-b border-line-2 last:border-0">
                  <td className="px-3 py-2 font-medium">
                    <Link
                      href={`/contacts?fiche=${encodeURIComponent(row.contactId)}`}
                      className="hover:text-brand-d hover:underline"
                    >
                      {row.contactName}
                    </Link>
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-muted">{row.companyName}</td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-muted">
                    {campaignKey(row) === NO_CAMPAIGN ? "—" : campaignLabel(row)}
                  </td>
                  <td className="px-3 py-2 text-muted">{CHANNEL_LABELS[row.channel]}</td>
                  <td className="px-3 py-2 text-muted">
                    {TYPE_LABELS[row.type]}
                    {row.type === "reply_received" && (
                      <span className="ml-1.5 text-[11.5px]">
                        ({replyCategoryLabel(row.replyCategory)})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted">{day(row.occurredAt)}</td>
                  <td className="px-3 py-2 text-muted">{row.owner === "" ? "—" : row.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { readonly children: React.ReactNode }) {
  return (
    <th scope="col" className="px-3 py-2 text-[11.5px] font-semibold tracking-wide text-muted uppercase">
      {children}
    </th>
  );
}

/** Le jour parisien, en français : le serveur tourne en UTC (jalon 93). */
function day(at: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(at);
}
