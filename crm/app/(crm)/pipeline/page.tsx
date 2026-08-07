import { PipelineView } from "@/components/deals/pipeline-view";
import { listDeals } from "@/lib/api/deals";
import { getPilotage, listOffers, listOwners, listStages } from "@/lib/api/reference";
import { prisma } from "@/lib/db";
import { monthKey } from "@/lib/domain/dates";

export const dynamic = "force-dynamic";

/**
 * Vue Kanban du pipeline.
 *
 * La colonne terminale « Gagné » n'affiche que les affaires gagnées du mois en
 * cours — comme dans le prototype. Sans cette borne, elle accumulerait tout
 * l'historique et écraserait la lecture des colonnes actives.
 */
export default async function PipelinePage() {
  const [open, won, stages, owners, offers, settings, companies, contacts] =
    await Promise.all([
      listDeals({ status: "open" }),
      listDeals({ status: "won" }),
      listStages(),
      listOwners(),
      listOffers(),
      getPilotage(),
      prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.contact.findMany({
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);

  const thisMonth = monthKey(new Date());
  const wonThisMonth = won.filter(
    (deal) => deal.closedAt !== null && monthKey(deal.closedAt) === thisMonth,
  );

  return (
    <PipelineView
      deals={[...open, ...wonThisMonth]}
      openDeals={open}
      stages={stages}
      owners={owners}
      offers={offers}
      companies={companies}
      contacts={contacts}
      settings={settings}
    />
  );
}
