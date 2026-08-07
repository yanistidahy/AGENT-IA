import { Rail } from "@/components/nav/rail";
import { countOverdueTasks } from "@/lib/api/tasks";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Coquille des vues CRM : rail sombre à gauche, contenu clair à droite.
 *
 * Les compteurs du pied de rail sont tolérants à la panne : une base
 * indisponible ne doit pas empêcher la coquille de s'afficher, sans quoi la
 * page d'accueil ne pourrait plus rendre son diagnostic.
 */
async function readRailTotals(): Promise<{
  pipelineValue: number;
  wonCount: number;
  overdueCount: number;
}> {
  try {
    const [open, won, overdue] = await Promise.all([
      prisma.deal.aggregate({ where: { status: "open" }, _sum: { amount: true } }),
      prisma.deal.count({ where: { status: "won" } }),
      countOverdueTasks(new Date()),
    ]);
    return {
      pipelineValue: open._sum.amount ?? 0,
      wonCount: won,
      overdueCount: overdue,
    };
  } catch {
    return { pipelineValue: 0, wonCount: 0, overdueCount: 0 };
  }
}

export default async function CrmLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const totals = await readRailTotals();

  return (
    <div className="flex h-screen overflow-hidden">
      <Rail
        pipelineValue={totals.pipelineValue}
        wonCount={totals.wonCount}
        overdueCount={totals.overdueCount}
      />
      <main className="flex-1 overflow-y-auto bg-paper">{children}</main>
    </div>
  );
}
