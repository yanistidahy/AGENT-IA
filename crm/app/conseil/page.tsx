import { Console } from "@/components/agents/console";
import type { StageStats } from "@/components/agents/agent-stage";
import { defaultAgentSlug, listAgentProfiles } from "@/lib/api/agents";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const WHEN = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Les chiffres affichés sous chaque portrait.
 *
 * Deux agrégats groupés plutôt qu'une requête par agent : le conseil compte
 * huit membres, mais le nombre de requêtes ne doit pas suivre le nombre
 * d'agents. Une base injoignable rend simplement des statistiques vides — la
 * page du conseil doit s'ouvrir même quand PostgreSQL ne répond pas.
 */
async function readStats(): Promise<Record<string, StageStats>> {
  const stats: Record<string, StageStats> = {};

  try {
    const [runs, open] = await Promise.all([
      prisma.shiftRun.groupBy({ by: ["agentId"], _max: { startedAt: true } }),
      prisma.recommendation.groupBy({
        by: ["agentId"],
        where: { status: "new" },
        _count: { _all: true },
      }),
    ]);

    for (const run of runs) {
      const last = run._max.startedAt;
      stats[run.agentId] = {
        lastRun: last === null ? "" : WHEN.format(last),
        openRecommendations: 0,
      };
    }

    for (const row of open) {
      stats[row.agentId] = {
        lastRun: stats[row.agentId]?.lastRun ?? "",
        openRecommendations: row._count._all,
      };
    }
  } catch {
    // Base injoignable : le panneau s'ouvre quand même. Le diagnostic détaillé
    // vit sur la page d'accueil.
  }

  return stats;
}

export default async function ConseilPage() {
  const [agents, defaultSlug, stats] = await Promise.all([
    listAgentProfiles(),
    defaultAgentSlug(),
    readStats(),
  ]);

  let conversations: {
    id: string;
    agentId: string;
    title: string;
    deep: boolean;
    updatedAt: Date;
  }[] = [];

  try {
    conversations = await prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, agentId: true, title: true, deep: true, updatedAt: true },
    });
  } catch {
    // Même raison que ci-dessus.
  }

  return (
    <Console
      agents={agents.filter((agent) => agent.enabled)}
      initialConversations={conversations}
      defaultAgentId={defaultSlug}
      stats={stats}
    />
  );
}
