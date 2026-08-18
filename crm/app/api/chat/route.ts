import { z } from "zod";
import { prisma } from "@/lib/db";
import { appendMessage, titleFrom } from "@/lib/agents/messages";
import { findAgent, isUnlocked } from "@/lib/agents/registry";
import { streamConversation } from "@/lib/agents/runtime/loop";
import { badRequest, invalidPayload, notFound, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const chatSchema = z.object({
  conversationId: z.string(),
  /** Absent = reprise après confirmation, sans nouveau message utilisateur. */
  message: z.string().trim().min(1).optional(),
  /** Ce que cet appel sert — voir `Purpose`. Absent vaut « conversation ». */
  purpose: z.enum(["chat", "revision"]).optional(),
});

/**
 * Flux de conversation (SSE).
 *
 * Un seul appel en vol par conversation : un second envoi pendant le streaming
 * est refusé côté serveur en plus du verrou côté client, pour que deux onglets
 * ne puissent pas entrelacer leurs tours.
 */
const inFlight = new Set<string>();

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = chatSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  const { conversationId, message, purpose = "chat" } = parsed.data;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { _count: { select: { messages: true } } },
    });
    if (conversation === null) return notFound("Conversation introuvable.");

    const agent = findAgent(conversation.agentId);
    if (agent === undefined) return notFound("Agent introuvable.");
    if (!isUnlocked(agent)) {
      return badRequest(`${agent.name} est verrouillé sur ce déploiement.`);
    }

    if (inFlight.has(conversationId)) {
      return badRequest("Une réponse est déjà en cours sur cette conversation.");
    }

    if (message !== undefined) {
      await appendMessage(conversationId, "user", [{ type: "text", text: message }]);
      if (conversation._count.messages === 0) {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { title: titleFrom(message) },
        });
      }
    }

    inFlight.add(conversationId);
    const stream = streamConversation(
      conversationId,
      conversation.agentId,
      conversation.deep,
      purpose,
    );

    return new Response(
      stream.pipeThrough(
        new TransformStream({
          flush() {
            inFlight.delete(conversationId);
          },
        }),
      ),
      {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
        },
      },
    );
  } catch (error) {
    inFlight.delete(conversationId);
    return serverError("POST /api/chat", error);
  }
}
