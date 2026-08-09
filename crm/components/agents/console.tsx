"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgentProfile } from "@/lib/api/agents";
import { confirmAction, readChatStream, startChat } from "@/lib/client/chat-stream";
import { RecommendationCard, type RecommendationView } from "@/components/recommendations/recommendation-card";
import { AgentStage, type StageStats } from "./agent-stage";
import { Composer } from "./composer";
import { LockedModal } from "./locked-modal";
import { Conversations, Roster } from "./sidebars";
import { Thread } from "./thread";
import { EMPTY_TURN, itemsFromMessages, type ConversationSummary, type ThreadItem } from "./types";

interface ConsoleProps {
  readonly agents: readonly AgentProfile[];
  readonly initialConversations: readonly ConversationSummary[];
  readonly defaultAgentId: string;
  /** Statistiques par slug, calculées au rendu serveur. */
  readonly stats: Readonly<Record<string, StageStats>>;
}

export function Console({ agents, initialConversations, defaultAgentId, stats }: ConsoleProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([
    ...initialConversations,
  ]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState(defaultAgentId);
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [deep, setDeep] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState<AgentProfile | null>(null);
  const [pending, setPending] = useState<readonly RecommendationView[]>([]);

  const agent = agents.find((candidate) => candidate.slug === agentId);

  /**
   * Les constats de l'agent affiché.
   *
   * Chargés à la sélection plutôt que tous d'avance : huit agents feraient huit
   * listes dont sept ne seraient jamais lues. Un échec est silencieux — le bloc
   * disparaît, la conversation reste utilisable.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `/api/recommendations?agentId=${encodeURIComponent(agentId)}&scope=open`,
        );
        if (!response.ok) return;
        const payload: unknown = await response.json();
        if (
          !cancelled &&
          typeof payload === "object" &&
          payload !== null &&
          "recommendations" in payload &&
          Array.isArray(payload.recommendations)
        ) {
          setPending(payload.recommendations as RecommendationView[]);
        }
      } catch {
        if (!cancelled) setPending([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

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
          message === undefined ? { conversationId } : { conversationId, message },
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

    const created = payload.conversation as ConversationSummary;
    setConversations((current) => [created, ...current]);
    setActiveId(created.id);
    return created.id;
  }, [activeId, agentId, deep]);

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

  const openConversation = useCallback(async (id: string) => {
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
      if (typeof conversation?.agentId === "string") setAgentId(conversation.agentId);
      if (typeof conversation?.deep === "boolean") setDeep(conversation.deep);
    }
  }, []);

  return (
    // Colonne sur mobile, rails latéraux à partir de `lg`. L'ordre vertical est
    // celui de l'usage : on choisit un agent, on le voit, on lui parle.
    <div className="flex h-full flex-col lg:flex-row">
      <Conversations
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => void openConversation(id)}
        onCreate={() => {
          setActiveId(null);
          setItems([]);
          setError(null);
        }}
        onRename={(id, title) => {
          setConversations((current) =>
            current.map((c) => (c.id === id ? { ...c, title } : c)),
          );
          void fetch(`/api/conversations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
          });
        }}
        onDelete={(id) => {
          setConversations((current) => current.filter((c) => c.id !== id));
          if (activeId === id) {
            setActiveId(null);
            setItems([]);
          }
          void fetch(`/api/conversations/${id}`, { method: "DELETE" });
        }}
      />

      {agent !== undefined && (
        <AgentStage agent={agent} stats={stats[agent.slug]}>
          {pending.length > 0 && (
            <div>
              <div className="pb-1.5 font-mono text-[9px] tracking-[0.12em] text-[#4E5867] uppercase">
                À décider
              </div>
              <ul className="grid gap-1.5">
                {pending.map((item) => (
                  <RecommendationCard key={item.id} item={item} />
                ))}
              </ul>
            </div>
          )}
        </AgentStage>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Thread
            items={items}
            agent={agent}
            streaming={streaming}
            error={error}
            onDecide={(toolUseId, decision) => void decide(toolUseId, decision)}
          />
        </div>
        <Composer
          agentName={agent?.name ?? "un agent"}
          disabled={agent === undefined || agent.locked}
          streaming={streaming}
          deep={deep}
          onDeepChange={(next) => {
            setDeep(next);
            if (activeId !== null) {
              void fetch(`/api/conversations/${activeId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deep: next }),
              });
            }
          }}
          onSend={(text) => void send(text)}
        />
      </main>

      <Roster
        agents={agents}
        activeId={agentId}
        onSelect={(selected) => {
          if (selected.locked) {
            setLocked(selected);
            return;
          }
          setAgentId(selected.slug);
          setActiveId(null);
          setItems([]);
          setError(null);
        }}
      />

      <LockedModal agent={locked} onClose={() => setLocked(null)} />
    </div>
  );
}
