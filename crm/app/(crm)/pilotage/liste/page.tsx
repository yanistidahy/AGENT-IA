import Link from "next/link";
import { pilotageView, readMetric } from "@/lib/api/pilotage-view";
import { CHANNEL_LABELS, TYPE_LABELS, replyCategoryLabel } from "@/lib/domain/outreach";
import {
  NO_CAMPAIGN,
  NO_DATA,
  campaignKey,
  campaignLabel,
  sourceLabel,
} from "@/lib/domain/pilotage";
import { backTab, one } from "@/lib/domain/board-links";

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
  /*
    **La liste passe par la même porte que les onglets.**

    `pilotageView` lit l'URL, borne la période, attribue les campagnes et filtre
    — une fois. Refaire ce chemin ici, même à l'identique, laisserait la
    possibilité qu'il dérive : c'est exactement ce qui sépare une pastille de sa
    liste, et les jalons 49, 78 et 105 l'ont payé trois fois.
  */
  const view = await pilotageView(params);
  const { period } = view;
  const result = view.metric(readMetric(one(params, "metric"), "messages"));

  const back = new URLSearchParams();
  for (const key of Object.keys(params)) {
    const single = one(params, key);
    if (single !== "" && key !== "metric" && key !== "retour") back.set(key, single);
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
          href={`${backTab(params)}?${back.toString()}`}
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
                <Th>Origine</Th>
                <Th>Quand</Th>
                <Th>Propriétaire</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.id} data-row className="border-b border-line-2 last:border-0">
                  {/*
                    **Une ligne sans fiche se montre tout de même** (jalon 112) :
                    un message compté au compteur manuel sans destinataire
                    enregistré. Sans elle, le nombre de lignes cesserait d'égaler
                    le nombre annoncé, et c'est l'invariant du jalon 109. Pas de
                    lien : il n'y a pas de fiche à ouvrir.
                  */}
                  <td className="px-3 py-2 font-medium" data-cell="contact">
                    {row.contactId === null ? (
                      <span className="text-muted italic" data-no-contact>
                        {row.contactName}
                      </span>
                    ) : (
                      <Link
                        href={`/contacts?fiche=${encodeURIComponent(row.contactId)}`}
                        className="hover:text-brand-d hover:underline"
                      >
                        {row.contactName}
                      </Link>
                    )}
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
                  <td className="px-3 py-2 text-muted" data-source={row.source}>
                    {sourceLabel(row.source)}
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
