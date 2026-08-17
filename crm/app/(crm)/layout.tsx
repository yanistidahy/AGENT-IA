import { Rail, type RailTotals } from "@/components/nav/rail";
import { listAgentProfiles } from "@/lib/api/agents";
import { SearchPalette } from "@/components/search/palette";
import { countOverdueTasks } from "@/lib/api/tasks";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Coquille des vues CRM : rail sombre à gauche, contenu clair à droite.
 *
 * Le pied de rail reste tolérant à la panne — une base indisponible ne doit pas
 * empêcher la coquille de s'afficher, sans quoi la page d'accueil ne pourrait
 * plus rendre son diagnostic. Mais il ne **ment plus** : une requête en échec
 * renvoie `null`, pas zéro.
 *
 * La version précédente retournait `0` dans le `catch`. Le rail affichait donc
 * « 0 € en pipeline · 0 affaires gagnées » aussi bien pour une base vide que
 * pour une base injoignable — deux situations sans rapport, dont l'une est une
 * panne. Le rail affiche désormais « indisponible » dans le second cas.
 */
async function readRailTotals(): Promise<RailTotals> {
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
  } catch (error) {
    console.error("[layout] compteurs du rail indisponibles", error);
    return null;
  }
}

export default async function CrmLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Les agents du rail, lus au rendu serveur comme les compteurs. Filtrés sur
  // l'activation ici plutôt que dans le composant : le rail affiche ce qu'on lui
  // donne, la décision « qui fait partie du conseil » appartient à la donnée.
  const [totals, agents] = await Promise.all([
    readRailTotals(),
    listAgentProfiles().catch(() => []),
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Rail totals={totals} agents={agents.filter((agent) => agent.enabled && !agent.locked)} />
      <main className="flex-1 overflow-y-auto bg-paper">{children}</main>
      <SearchPalette />
    </div>
  );
}
