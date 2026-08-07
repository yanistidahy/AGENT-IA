import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { appendMessage, loadMessages, replaceMessage } from "@/lib/agents/messages";
import { findAgent } from "@/lib/agents/registry";
import { findTool } from "@/lib/agents/tools";
import { badRequest, invalidPayload, jsonOk, notFound, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";

export const dynamic = "force-dynamic";

const confirmSchema = z.object({
  conversationId: z.string(),
  toolUseId: z.string(),
  decision: z.enum(["confirm", "refuse"]),
});

/**
 * Exécution d'une action proposée par un agent.
 *
 * C'est le seul endroit du code où un outil `mode: "write"` s'exécute, et il
 * n'est atteignable que par un clic de l'utilisateur. L'écriture et la
 * consignation du résultat se font dans la même transaction logique : soit
 * l'action a eu lieu et la conversation le sait, soit ni l'un ni l'autre.
 *
 * Un refus n'est pas un échec : il produit un `tool_result` explicite pour que
 * l'agent en prenne acte et poursuive au lieu de rester bloqué.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = confirmSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  const { conversationId, toolUseId, decision } = parsed.data;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (conversation === null) return notFound("Conversation introuvable.");

    const agent = findAgent(conversation.agentId);
    if (agent === undefined) return notFound("Agent introuvable.");

    const messages = await loadMessages(conversationId);

    // Retrouve le tool_use visé dans le dernier tour d'assistant.
    const assistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (assistant === undefined) return notFound("Aucun tour d'assistant à confirmer.");

    const use = assistant.blocks.find(
      (block): block is Anthropic.ToolUseBlockParam =>
        block.type === "tool_use" && block.id === toolUseId,
    );
    if (use === undefined) return notFound("Action introuvable ou déjà traitée.");

    const tool = findTool(use.name);
    if (tool === undefined) return notFound("Outil inconnu.");
    if (tool.mode !== "write") {
      return badRequest("Cet outil ne demande pas de confirmation.");
    }
    if (!agent.tools.includes(use.name)) {
      return badRequest(`${agent.name} n'a pas accès à cet outil.`);
    }

    // Le message `tool` du tour courant, s'il existe déjà (lectures du même tour).
    const index = messages.indexOf(assistant);
    const existing = messages[index + 1];
    const toolMessage = existing !== undefined && existing.role === "tool" ? existing : undefined;

    const already = (toolMessage?.blocks ?? []).filter(
      (block): block is Anthropic.ToolResultBlockParam => block.type === "tool_result",
    );
    if (already.some((block) => block.tool_use_id === toolUseId)) {
      return badRequest("Cette action a déjà été traitée.");
    }

    const payload =
      decision === "refuse"
        ? { exécutée: false, refusée: true, message: "L'utilisateur a refusé cette action." }
        : (await tool.run(use.input)).data;

    const result: Anthropic.ToolResultBlockParam = {
      type: "tool_result",
      tool_use_id: toolUseId,
      content: [{ type: "text", text: JSON.stringify(payload) }],
    };

    const blocks = [...already, result];
    if (toolMessage === undefined) {
      await appendMessage(conversationId, "tool", blocks);
    } else {
      await replaceMessage(toolMessage.id, blocks);
    }

    const pending = assistant.blocks.filter(
      (block): block is Anthropic.ToolUseBlockParam => block.type === "tool_use",
    ).length;

    return jsonOk({
      decision,
      executed: decision === "confirm",
      /** Le client relance /api/chat quand tout le tour est réglé. */
      turnComplete: blocks.length === pending,
    });
  } catch (error) {
    return serverError("POST /api/actions/confirm", error);
  }
}
