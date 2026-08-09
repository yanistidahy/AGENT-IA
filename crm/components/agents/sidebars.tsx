"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Portrait } from "./portrait";
import type { AgentProfile } from "@/lib/api/agents";
import type { ConversationSummary } from "./types";

/** Regroupement par jour, comme dans les captures. */
function bucketOf(date: Date, now: Date): string {
  const day = 86_400_000;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = start - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (diff <= 0) return "Aujourd'hui";
  if (diff <= day) return "Hier";
  if (diff <= 7 * day) return "7 derniers jours";
  return "Plus ancien";
}

const ORDER = ["Aujourd'hui", "Hier", "7 derniers jours", "Plus ancien"] as const;

interface ConversationsProps {
  readonly conversations: readonly ConversationSummary[];
  readonly activeId: string | null;
  readonly onSelect: (id: string) => void;
  readonly onCreate: () => void;
  readonly onRename: (id: string, title: string) => void;
  readonly onDelete: (id: string) => void;
}

export function Conversations({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: ConversationsProps) {
  const [menu, setMenu] = useState<string | null>(null);
  const now = new Date();

  const groups = new Map<string, ConversationSummary[]>();
  for (const conversation of conversations) {
    const key = bucketOf(new Date(conversation.updatedAt), now);
    groups.set(key, [...(groups.get(key) ?? []), conversation]);
  }

  return (
    // Masquée sous `lg` : sur un téléphone, l'historique prendrait tout l'écran
    // au profit de ce qu'on vient précisément y lire — la conversation.
    <aside className="hidden w-[240px] shrink-0 flex-col overflow-hidden border-r border-[#1E2430] lg:flex">
      <div className="flex flex-none items-center gap-2 px-4 py-3">
        <span className="font-display text-[13px] font-semibold text-white">
          Mes conversations
        </span>
        <button
          type="button"
          onClick={onCreate}
          aria-label="Nouvelle conversation"
          className="ml-auto rounded-control border border-[#2A3240] p-1 text-[#8FA3AE] transition-colors hover:border-flux hover:text-flux"
        >
          <Icon name="plus" size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {conversations.length === 0 && (
          <p className="px-2 py-4 text-[12.5px] leading-relaxed text-[#5F6B7C]">
            Aucune conversation. Choisissez un agent et posez votre première question.
          </p>
        )}

        {ORDER.filter((key) => groups.has(key)).map((key) => (
          <div key={key} className="mb-3">
            <div className="px-2 py-1.5 font-mono text-[9px] tracking-[0.14em] text-[#4E5867] uppercase">
              {key}
            </div>
            {(groups.get(key) ?? []).map((conversation) => (
              <div key={conversation.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(conversation.id)}
                  className={`w-full truncate rounded-control px-2 py-1.5 pr-7 text-left text-[12.5px] transition-colors ${
                    activeId === conversation.id
                      ? "bg-[#1E2430] text-white"
                      : "text-[#98A3B4] hover:bg-[#171B24] hover:text-white"
                  }`}
                >
                  {conversation.title}
                </button>
                <button
                  type="button"
                  aria-label="Actions"
                  onClick={() => setMenu(menu === conversation.id ? null : conversation.id)}
                  className="absolute top-1.5 right-1 px-1 text-[#5F6B7C] opacity-0 transition-opacity group-hover:opacity-100 hover:text-white"
                >
                  ⋯
                </button>

                {menu === conversation.id && (
                  <div className="absolute right-1 z-10 mt-1 w-36 rounded-control border border-[#2A3240] bg-[#161A23] py-1 shadow-float">
                    <button
                      type="button"
                      className="block w-full px-3 py-1.5 text-left text-[12px] text-[#98A3B4] hover:bg-[#1E2430] hover:text-white"
                      onClick={() => {
                        const title = window.prompt("Nouveau titre", conversation.title);
                        setMenu(null);
                        if (title !== null && title.trim() !== "") {
                          onRename(conversation.id, title.trim());
                        }
                      }}
                    >
                      Renommer
                    </button>
                    <button
                      type="button"
                      className="block w-full px-3 py-1.5 text-left text-[12px] text-[#FF9E8E] hover:bg-[#1E2430]"
                      onClick={() => {
                        setMenu(null);
                        onDelete(conversation.id);
                      }}
                    >
                      Supprimer
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

interface RosterProps {
  readonly agents: readonly AgentProfile[];
  readonly activeId: string;
  readonly onSelect: (agent: AgentProfile) => void;
}

export function Roster({ agents, activeId, onSelect }: RosterProps) {
  return (
    // Bande défilante horizontalement sur mobile, colonne à partir de `lg` :
    // pouvoir changer d'agent reste indispensable sur petit écran.
    <aside className="order-first flex shrink-0 gap-1.5 overflow-x-auto border-b border-[#1E2430] px-2 py-2 lg:order-none lg:w-[248px] lg:flex-col lg:gap-0 lg:overflow-x-visible lg:overflow-y-auto lg:border-b-0 lg:border-l lg:px-2 lg:py-3">
      <div className="hidden px-2 pb-2 font-mono text-[9px] tracking-[0.14em] text-[#4E5867] uppercase lg:block">
        Le conseil
      </div>

      {agents.map((agent) => (
        <button
          key={agent.slug}
          type="button"
          onClick={() => onSelect(agent)}
          aria-current={activeId === agent.slug ? "true" : undefined}
          className={`flex shrink-0 items-center gap-2.5 rounded-control px-2 py-2 text-left transition-colors lg:mb-0.5 lg:w-full ${
            agent.locked
              ? // La désaturation du portrait porte déjà le verrou : cumuler
                // deux atténuations rendrait la ligne illisible.
                "opacity-75 hover:opacity-100"
              : activeId === agent.slug
                ? "bg-[#1E2430]"
                : "hover:bg-[#171B24]"
          }`}
        >
          {/* Vignette verticale plutôt que ronde : un cercle de 32 px rogne le
              front et le menton, c'est-à-dire ce qui rend un visage
              reconnaissable. Le 3/4 garde la tête entière. */}
          <Portrait
            agent={agent}
            size="thumb"
            className="h-11 w-8 shrink-0 rounded-[4px]"
            initialsClassName="text-[11px]"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[13px] font-semibold text-white">{agent.name}</span>
              {agent.locked && <Icon name="lock" size={11} className="shrink-0 text-gold" />}
            </span>
            <span className="block truncate text-[11px] text-[#6E7A8C]">
              {agent.role}
              {agent.readOnly && !agent.locked && " · lecture seule"}
            </span>
          </span>
        </button>
      ))}
    </aside>
  );
}
