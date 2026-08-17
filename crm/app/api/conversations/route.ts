import { z } from "zod";
import { prisma } from "@/lib/db";
import { findAgent, isUnlocked } from "@/lib/agents/registry";
import { findAgentProfile } from "@/lib/api/agents";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  agentId: z.string(),
  deep: z.boolean().default(false),
  dealId: z.string().nullish(),
  /** Contexte injecté depuis une fiche CRM (« Demander à Sacha »). */
  title: z.string().trim().max(120).optional(),
});

export async function GET() {
  try {
    const rows = await prisma.conversation.findMany({
      orderBy: { updatedAt: "desc" },
      take: 100,
      select: { id: true, agentId: true, title: true, deep: true, updatedAt: true },
    });
    return jsonOk({ conversations: rows });
  } catch (error) {
    return serverError("GET /api/conversations", error);
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = createSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  const agent = findAgent(parsed.data.agentId);
  if (agent === undefined) return badRequest("Agent inconnu.");
  if (!isUnlocked(agent)) {
    return badRequest(`${agent.name} est verrouillé sur ce déploiement.`);
  }

  // **Désactivé vaut refus, pas seulement absence du roster.** Le verrou
  // `isUnlocked` porte sur une variable d'environnement ; l'activation, elle,
  // est de la donnée réglable à l'écran. Sans ce contrôle, un agent retiré du
  // conseil resterait joignable par un appel direct à l'API — une porte que
  // l'écran ne montre plus mais qui n'est pas fermée.
  const profile = await findAgentProfile(agent.slug);
  if (profile !== null && !profile.enabled) {
    return badRequest(`${profile.name} est désactivé. Réactivez-le dans Réglages → Conseil.`);
  }

  try {
    const conversation = await prisma.conversation.create({
      data: {
        agentId: agent.slug,
        title: parsed.data.title ?? "Nouvelle conversation",
        deep: parsed.data.deep,
        dealId: parsed.data.dealId ?? null,
      },
      select: { id: true, agentId: true, title: true, deep: true, updatedAt: true },
    });
    return jsonOk({ conversation }, 201);
  } catch (error) {
    return serverError("POST /api/conversations", error);
  }
}
