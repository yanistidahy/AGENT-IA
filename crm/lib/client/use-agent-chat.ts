"use client";

import { useCallback, useState } from "react";
import { confirmAction, readChatStream, startChat } from "./chat-stream";
import { EMPTY_TURN, itemsFromMessages, type ThreadItem } from "@/components/agents/types";

/**
 * **La conversation avec un agent, en un seul exemplaire.**
 *
 * Extrait de `Console` au jalon 33, quand le panneau latéral du rail a eu besoin
 * exactement de la même mécanique : créer un fil, envoyer, lire le flux, gérer
 * les outils, confirmer une action, rouvrir un historique.
 *
 * Deux implémentations auraient divergé — c'est la leçon du test de parité
 * SQL/mémoire du jalon 12 et de la double façade `scripts/` / `/api/maintenance`
 * du jalon 12. Ici l'enjeu est explicite dans la demande : « le panneau porte le
 * même fil que `/conseil` — mêmes conversations, mêmes messages, une seule
 * source ». Une source, donc un module.
 *
 * Le hook ne connaît **ni la mise en page ni le roster** : il tient l'état d'un
 * fil et rien d'autre. La console l'entoure de ses trois colonnes, le panneau
 * d'un tiroir de 480 px.
 */
export interface AgentChat {
  readonly items: readonly ThreadItem[];
  readonly streaming: boolean;
  readonly error: string | null;
  readonly activeId: string | null;
  readonly send: (text: string) => Promise<void>;
  readonly decide: (toolUseId: string, decision: "confirm" | "refuse") => Promise<void>;
  readonly openConversation: (id: string) => Promise<void>;
  /** Repart d'un fil vide sans changer d'agent. */
  readonly reset: () => void;
  readonly setError: (message: string | null) => void;
}

export interface AgentChatOptions {
  readonly agentId: string;
  readonly deep?: boolean;
  /** `revision` depuis le panneau de rédaction — voir `StartChatInput`. */
  readonly purpose?: "chat" | "revision";
  /** Prévenu à la création d'un fil, pour que la liste des conversations suive. */
  readonly onCreated?: (conversation: { id: string; agentId: string; title: string; deep: boolean; updatedAt: Date }) => void;
  /** Prévenu quand l'ouverture d'un fil révèle un autre agent ou un autre mode. */
  readonly onOpened?: (info: { agentId?: string; deep?: boolean }) => void;
}

export function useAgentChat({
  agentId,
  deep = false,
  purpose = "chat",
  onCreated,
  onOpened,
}: AgentChatOptions): AgentChat {
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Applique une mise à jour au dernier tour d'agent du fil. */
  const patchLast = useCallback(
    (patch: (turn: Extract<ThreadItem, { kind: "agent" }>) => ThreadItem) => {
      setItems((current) => {
        const last = current[current.length - 1];
        if (last === undefined || last.kind !== "agent") return current;
        return [...current.slice(0, -1), patch(last)];
      });
    },
    [],
  );

  const consume = useCallback(
    async (conversationId: string, message?: string) => {
      setStreaming(true);
      setError(null);
      setItems((current) => [...current, EMPTY_TURN]);

      try {
        const response = await startChat(
          message === undefined
            ? { conversationId, purpose }
            : { conversationId, message, purpose },
        );

        if (!response.ok) {
          setError("Le serveur a refusé la demande.");
          return;
        }

        for await (const event of readChatStream(response)) {
          switch (event.type) {
            case "text":
              patchLast((turn) => ({ ...turn, text: turn.text + event.text }));
              break;
            case "thinking":
              patchLast((turn) => ({ ...turn, thinking: turn.thinking + event.text }));
              break;
            case "tool_start":
              patchLast((turn) => ({
                ...turn,
                chips: [
                  ...turn.chips,
                  { name: event.name, label: event.label, empty: false, running: true },
                ],
              }));
              break;
            case "tool_end":
              patchLast((turn) => ({
                ...turn,
                chips: turn.chips.map((chip) =>
                  chip.name === event.name && chip.running
                    ? { ...chip, running: false, empty: event.empty }
                    : chip,
                ),
              }));
              break;
            case "action_proposed":
              patchLast((turn) => ({ ...turn, action: event.action, actionState: "pending" }));
              break;
            case "error":
              setError(event.message);
              break;
            case "done":
              break;
          }
        }
      } catch {
        setError("La connexion au serveur a été interrompue.");
      } finally {
        setStreaming(false);
      }
    },
    [patchLast],
  );

  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (activeId !== null) return activeId;

    const response = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, deep }),
    });
    if (!response.ok) {
      setError("Impossible de créer la conversation.");
      return null;
    }

    const payload: unknown = await response.json();
    if (
      typeof payload !== "object" ||
      payload === null ||
      !("conversation" in payload) ||
      typeof payload.conversation !== "object" ||
      payload.conversation === null ||
      !("id" in payload.conversation) ||
      typeof payload.conversation.id !== "string"
    ) {
      setError("Réponse inattendue du serveur.");
      return null;
    }

    const created = payload.conversation as {
      id: string;
      agentId: string;
      title: string;
      deep: boolean;
      updatedAt: Date;
    };
    setActiveId(created.id);
    onCreated?.(created);
    return created.id;
  }, [activeId, agentId, deep, onCreated]);

  const send = useCallback(
    async (text: string) => {
      if (streaming) return;
      const id = await ensureConversation();
      if (id === null) return;
      setItems((current) => [...current, { kind: "user", text }]);
      await consume(id, text);
    },
    [consume, ensureConversation, streaming],
  );

  const decide = useCallback(
    async (toolUseId: string, decision: "confirm" | "refuse") => {
      if (activeId === null || streaming) return;

      const result = await confirmAction(activeId, toolUseId, decision);
      if (!result.ok) {
        setError(result.message ?? "L'action n'a pas pu être exécutée.");
        return;
      }

      patchLast((turn) => ({
        ...turn,
        actionState: decision === "confirm" ? "confirmed" : "refused",
      }));

      if (result.turnComplete) await consume(activeId);
    },
    [activeId, consume, patchLast, streaming],
  );

  const openConversation = useCallback(
    async (id: string) => {
      setActiveId(id);
      setError(null);
      const response = await fetch(`/api/conversations/${id}`);
      if (!response.ok) {
        setItems([]);
        return;
      }
      const payload: unknown = await response.json();
      if (typeof payload === "object" && payload !== null && "messages" in payload) {
        const { messages, conversation } = payload as {
          messages: { role: string; blocks: { type: string; text?: string; name?: string }[] }[];
          conversation?: { agentId?: string; deep?: boolean };
        };
        setItems(itemsFromMessages(messages));
        onOpened?.({ agentId: conversation?.agentId, deep: conversation?.deep });
      }
    },
    [onOpened],
  );

  const reset = useCallback(() => {
    setActiveId(null);
    setItems([]);
    setError(null);
  }, []);

  return { items, streaming, error, activeId, send, decide, openConversation, reset, setError };
}
