import { DealsView } from "@/components/deals/deals-view";
import { parseDealsQuery } from "@/lib/api/deal-schemas";
import { countDealsByStatus, dealFacets, getDeal, listDeals } from "@/lib/api/deals";
import { DEAL_FILTER_COLUMNS } from "@/lib/api/deal-columns";
import { parseFilters } from "@/lib/domain/column-filters";
import { readAlerts } from "@/lib/api/alerts";
import { listOffers, listOwners, listStages, getPilotage } from "@/lib/api/reference";
import { listSequences } from "@/lib/api/sequences";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Vue liste des affaires.
 *
 * Les filtres passent par l'URL : l'état est partageable, rechargeable, et le
 * bouton « précédent » du navigateur fonctionne. La page appelle directement la
 * couche service — pas de requête HTTP vers sa propre API.
 */
export default async function AffairesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    flat[key] = Array.isArray(value) ? value[0] : value;
  }

  const parsed = parseDealsQuery(flat);
  const query = parsed.success ? parsed.data : {};

  // Paramètres bruts : les filtres de colonne se répètent (`f.owner=…&f.owner=…`).
  const filters = parseFilters(raw, DEAL_FILTER_COLUMNS);
  const now = new Date();

  const [
    deals,
    stages,
    owners,
    offers,
    settings,
    companies,
    contacts,
    sequences,
    alerts,
    statusCounts,
    facetData,
  ] = await Promise.all([
    listDeals({ status: "open", ...query }, filters, now),
    listStages(),
    listOwners(),
    listOffers(),
    getPilotage(),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.contact.findMany({
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    listSequences(),
    readAlerts(),
    countDealsByStatus(),
    dealFacets({ status: "open", ...query }, filters, now),
  ]);

  const ficheId = flat.fiche;
  const focused =
    ficheId === undefined || deals.some((deal) => deal.id === ficheId)
      ? null
      : await getDeal(ficheId);

  return (
    <DealsView
      deals={deals}
      stages={stages}
      owners={owners}
      offers={offers}
      companies={companies}
      contacts={contacts}
      settings={settings}
      sequences={sequences}
      alerts={alerts}
      focused={focused}
      statusCounts={statusCounts}
      facets={facetData.facets}
      totalRows={facetData.total}
    />
  );
}
