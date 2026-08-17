"use client";

import { useCallback, useEffect, useState } from "react";
import { useAgentChat } from "@/lib/client/use-agent-chat";
import type { AgentProfile } from "@/lib/api/agents";
import { RecommendationCard, type RecommendationView } from "@/components/recommendations/recommendation-card";
import { AgentStage, type StageStats } from "./agent-stage";
import { AgentSwitcher } from "./agent-switcher";
import { Composer } from "./composer";
import { LockedModal } from "./locked-modal";
import { Conversations, Roster } from "./sidebars";
import { Thread } from "./thread";
import { type ConversationSummary } from "./types";

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
  const [agentId, setAgentId] = useState(defaultAgentId);
  const [deep, setDeep] = useState(false);
  const [locked, setLocked] = useState<AgentProfile | null>(null);
  const [pending, setPending] = useState<readonly RecommendationView[]>([]);

  /**
   * Toute la mécanique du fil vit dans `useAgentChat` depuis le jalon 33 : le
   * panneau latéral du rail en a besoin à l'identique, et deux implémentations
   * du streaming, des outils et de la confirmation auraient divergé.
   */
  const chat = useAgentChat({
    agentId,
    deep,
    onCreated: (created) => setConversations((current) => [created as ConversationSummary, ...current]),
    onOpened: (info) => {
      if (typeof info.agentId === "string") setAgentId(info.agentId);
      if (typeof info.deep === "boolean") setDeep(info.deep);
    },
  });

  const agent = agents.find((candidate) => candidate.slug === agentId);

  /**
   * Les constats de l'agent affiché.
   *
   * Chargés à la sélection plutôt que tous d'avance : deux agents feraient deux
   * listes dont une ne serait jamais lue. Un échec est silencieux — le bloc
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

  /**
   * Changer d'agent ouvre un fil neuf.
   *
   * Un même fil ne peut pas changer d'interlocuteur : la conversation porte
   * `agentId` en base, et rejouer l'historique d'un agent sous un autre prompt
   * produirait une réponse qui contredit ce qui est affiché au-dessus.
   */
  const selectAgent = useCallback(
    (selected: AgentProfile) => {
      if (selected.locked) {
        setLocked(selected);
        return;
      }
      setAgentId(selected.slug);
      chat.reset();
    },
    [chat],
  );

  return (
    // Colonne sur mobile, rails latéraux à partir de `lg`. L'ordre vertical est
    // celui de l'usage : on choisit un agent, on le voit, on lui parle.
    <div className="flex h-full flex-col lg:flex-row">
      <Conversations
        conversations={conversations}
        activeId={chat.activeId}
        onSelect={(id) => void chat.openConversation(id)}
        onCreate={() => chat.reset()}
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
          if (chat.activeId === id) chat.reset();
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
        <AgentSwitcher agents={agents} activeSlug={agentId} onSelect={selectAgent} />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Thread
            items={chat.items}
            agent={agent}
            streaming={chat.streaming}
            error={chat.error}
            onDecide={(toolUseId, decision) => void chat.decide(toolUseId, decision)}
            onAsk={(question) => void chat.send(question)}
          />
        </div>
        <Composer
          agentName={agent?.name ?? "un agent"}
          disabled={agent === undefined || agent.locked}
          streaming={chat.streaming}
          deep={deep}
          onDeepChange={(next) => {
            setDeep(next);
            if (chat.activeId !== null) {
              void fetch(`/api/conversations/${chat.activeId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ deep: next }),
              });
            }
          }}
          onSend={(text) => void chat.send(text)}
        />
      </main>

      <Roster
        agents={agents}
        activeId={agentId}
        onSelect={selectAgent}
      />

      <LockedModal agent={locked} onClose={() => setLocked(null)} />
    </div>
  );
}
