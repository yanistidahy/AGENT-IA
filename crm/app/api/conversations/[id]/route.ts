import { z } from "zod";
import { prisma } from "@/lib/db";
import { loadMessages } from "@/lib/agents/messages";
import { badRequest, invalidPayload, jsonOk, notFound, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";

export const dynamic = "force-dynamic";

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(120).optional(),
    deep: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Aucun champ à mettre à jour",
  });

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (conversation === null) return notFound("Conversation introuvable.");

    const messages = await loadMessages(id);
    return jsonOk({ conversation, messages });
  } catch (error) {
    return serverError(`GET /api/conversations/${id}`, error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = patchSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const conversation = await prisma.conversation.update({
      where: { id },
      data: parsed.data,
      select: { id: true, agentId: true, title: true, deep: true, updatedAt: true },
    });
    return jsonOk({ conversation });
  } catch {
    return notFound("Conversation introuvable.");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    await prisma.conversation.delete({ where: { id } });
    return jsonOk({ deleted: true });
  } catch {
    return notFound("Conversation introuvable.");
  }
}
