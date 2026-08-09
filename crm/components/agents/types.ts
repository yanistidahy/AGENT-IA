import type { ProposedAction } from "@/lib/agents/runtime/events";
import { toolLabel } from "@/lib/agents/runtime/events";

export interface ConversationSummary {
  readonly id: string;
  readonly agentId: string;
  readonly title: string;
  readonly deep: boolean;
  readonly updatedAt: string | Date;
}

export interface Chip {
  readonly name: string;
  readonly label: string;
  readonly empty: boolean;
  readonly running: boolean;
}

export type ThreadItem =
  | { readonly kind: "user"; readonly text: string }
  | {
      readonly kind: "agent";
      readonly text: string;
      readonly thinking: string;
      readonly chips: readonly Chip[];
      readonly action: ProposedAction | null;
      readonly actionState: "pending" | "confirmed" | "refused" | null;
    };

/** Tour d'agent vide, point de départ du streaming. */
export const EMPTY_TURN: ThreadItem = {
  kind: "agent",
  text: "",
  thinking: "",
  chips: [],
  action: null,
  actionState: null,
};

interface StoredBlock {
  readonly type: string;
  readonly text?: string;
  readonly name?: string;
}

interface StoredMessagePayload {
  readonly role: string;
  readonly blocks: readonly StoredBlock[];
}

/**
 * Reconstruit le fil à partir des messages persistés, au rechargement de page.
 *
 * Les blocs `thinking` ne sont pas rejoués : leur contenu n'est renvoyé par
 * l'API que pendant le streaming en mode approfondi, et l'historique n'a pas
 * vocation à conserver un raisonnement que l'utilisateur a déjà pu déplier.
 */
export function itemsFromMessages(messages: readonly StoredMessagePayload[]): ThreadItem[] {
  const items: ThreadItem[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      const text = message.blocks
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("");
      if (text !== "") items.push({ kind: "user", text });
      continue;
    }

    if (message.role !== "assistant") continue;

    const text = message.blocks
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("");

    const chips: Chip[] = message.blocks
      .filter((block) => block.type === "tool_use")
      .map((block) => ({
        name: block.name ?? "",
        label: toolLabel(block.name ?? ""),
        empty: false,
        running: false,
      }));

    if (text !== "" || chips.length > 0) {
      items.push({
        kind: "agent",
        text,
        thinking: "",
        chips,
        action: null,
        actionState: null,
      });
    }
  }

  return items;
}
