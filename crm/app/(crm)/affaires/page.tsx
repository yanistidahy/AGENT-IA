import { DealsView } from "@/components/deals/deals-view";
import { parseDealsQuery } from "@/lib/api/deal-schemas";
import { listDeals } from "@/lib/api/deals";
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

  const [deals, stages, owners, offers, settings, companies, contacts, sequences, alerts] =
    await Promise.all([
    listDeals({ status: "open", ...query }),
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
    ]);

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
    />
  );
}
