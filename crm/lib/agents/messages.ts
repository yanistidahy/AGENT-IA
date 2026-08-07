import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";

/**
 * Persistance des messages.
 *
 * Le contenu est stocké en JSON sérialisé (voir schema.prisma). Le rôle `tool`
 * est une convention interne : côté API Anthropic, les résultats d'outils
 * voyagent dans un message `user`.
 */

export type StoredRole = "user" | "assistant" | "tool";

export interface StoredMessage {
  readonly id: string;
  readonly role: StoredRole;
  readonly blocks: readonly Anthropic.ContentBlockParam[];
  readonly createdAt: Date;
}

function isRole(value: string): value is StoredRole {
  return value === "user" || value === "assistant" || value === "tool";
}

/**
 * Les blocs viennent de notre propre base, écrits par ce module à partir de
 * réponses de l'API. On vérifie la forme minimale — un tableau — sans
 * revalider chaque variante de bloc, dont la liste évolue avec le SDK.
 */
function parseBlocks(raw: string): Anthropic.ContentBlockParam[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Anthropic.ContentBlockParam[]) : [];
  } catch {
    return [];
  }
}

export async function loadMessages(conversationId: string): Promise<StoredMessage[]> {
  const rows = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
  });

  return rows
    .filter((row) => isRole(row.role))
    .map((row) => ({
      id: row.id,
      role: row.role as StoredRole,
      blocks: parseBlocks(row.content),
      createdAt: row.createdAt,
    }));
}

export async function appendMessage(
  conversationId: string,
  role: StoredRole,
  blocks: readonly Anthropic.ContentBlockParam[],
): Promise<string> {
  const row = await prisma.message.create({
    data: { conversationId, role, content: JSON.stringify(blocks) },
  });
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
  return row.id;
}

export async function replaceMessage(
  messageId: string,
  blocks: readonly Anthropic.ContentBlockParam[],
): Promise<void> {
  await prisma.message.update({
    where: { id: messageId },
    data: { content: JSON.stringify(blocks) },
  });
}

/** Conversion vers le format attendu par l'API : `tool` devient `user`. */
export function toAnthropicMessages(
  messages: readonly StoredMessage[],
): Anthropic.MessageParam[] {
  return messages
    .filter((message) => message.blocks.length > 0)
    .map((message) => ({
      role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: [...message.blocks],
    }));
}

/** Titre dérivé du premier message, tronqué proprement. */
export function titleFrom(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (clean === "") return "Nouvelle conversation";
  return clean.length <= 60 ? clean : `${clean.slice(0, 57)}…`;
}
