import { Console } from "@/components/agents/console";
import { agentSummaries, DEFAULT_AGENT_ID } from "@/lib/agents/registry";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ConseilPage() {
  const agents = agentSummaries();

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
    // Base injoignable : le panneau s'ouvre quand même, vide. Le diagnostic
    // détaillé vit sur la page d'accueil.
  }

  return (
    <Console
      agents={agents}
      initialConversations={conversations}
      defaultAgentId={DEFAULT_AGENT_ID}
    />
  );
}
