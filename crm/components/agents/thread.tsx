"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import type { AgentProfile } from "@/lib/api/agents";
import type { ThreadItem } from "./types";

interface ThreadProps {
  readonly items: readonly ThreadItem[];
  readonly agent: AgentProfile | undefined;
  readonly streaming: boolean;
  readonly error: string | null;
  readonly onDecide: (toolUseId: string, decision: "confirm" | "refuse") => void;
}

export function Thread({ items, agent, streaming, error, onDecide }: ThreadProps) {
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items, streaming]);

  if (items.length === 0 && error === null) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center">
        <div className="max-w-sm">
          <p className="font-display text-[17px] font-semibold text-white">
            {agent === undefined ? "Choisissez un agent" : `${agent.name} vous écoute`}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-[#7F8B9C]">
            {agent === undefined
              ? "Sélectionnez un membre du conseil dans la colonne de droite."
              : `${agent.role}. Il lit vos données réelles avant de répondre.`}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-6 py-6">
      {items.map((item, index) =>
        item.kind === "user" ? (
          <div key={index} className="flex justify-end">
            <p className="max-w-[80%] rounded-card rounded-br-sm bg-violet px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap text-white">
              {item.text}
            </p>
          </div>
        ) : (
          <AgentTurn key={index} item={item} agent={agent} onDecide={onDecide} />
        ),
      )}

      {error !== null && (
        <div className="rounded-card border border-[#5A2D2D] bg-[#2A1A1A] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#FF9E8E]">
            La conversation s&apos;est interrompue
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#C99]">{error}</p>
        </div>
      )}

      <div ref={bottom} />
    </div>
  );
}

function AgentTurn({
  item,
  agent,
  onDecide,
}: {
  item: Extract<ThreadItem, { kind: "agent" }>;
  agent: AgentProfile | undefined;
  onDecide: (toolUseId: string, decision: "confirm" | "refuse") => void;
}) {
  const [openThinking, setOpenThinking] = useState(false);

  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full font-display text-[10px] font-semibold text-white"
        style={{ backgroundColor: agent?.color ?? "#63807A" }}
      >
        {agent?.initials ?? "??"}
      </span>

      <div className="min-w-0 flex-1">
        {item.thinking !== "" && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setOpenThinking((open) => !open)}
              className="font-mono text-[10px] tracking-[0.12em] text-[#6E7A8C] uppercase transition-colors hover:text-[#9AA7B8]"
            >
              {openThinking ? "▾" : "▸"} cheminement
            </button>
            {openThinking && (
              <p className="mt-1.5 rounded-control border border-[#232A36] bg-[#141821] px-3 py-2 text-[12px] leading-relaxed whitespace-pre-wrap text-[#8B97A8]">
                {item.thinking}
              </p>
            )}
          </div>
        )}

        {item.chips.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {item.chips.map((chip, index) => (
              <span
                key={`${chip.name}-${index}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#242C3A] bg-[#161A23] px-2 py-[3px] text-[11px] text-[#8B97A8]"
              >
                <i
                  aria-hidden
                  className={`size-1.5 rounded-full ${
                    chip.running ? "animate-pulse bg-violet" : chip.empty ? "bg-gold" : "bg-flux"
                  }`}
                />
                {chip.label}
                {chip.empty && " — rien en base"}
              </span>
            ))}
          </div>
        )}

        {item.text !== "" && (
          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap text-[#DDE4EC]">
            {item.text}
          </p>
        )}

        {item.action !== null && (
          <ActionCard item={item} onDecide={onDecide} />
        )}
      </div>
    </div>
  );
}

function ActionCard({
  item,
  onDecide,
}: {
  item: Extract<ThreadItem, { kind: "agent" }>;
  onDecide: (toolUseId: string, decision: "confirm" | "refuse") => void;
}) {
  const action = item.action;
  if (action === null) return null;

  const settled = item.actionState === "confirmed" || item.actionState === "refused";

  return (
    <div className="mt-3 rounded-card border border-[#3A3260] bg-[#1A1730] p-3.5">
      <p className="font-mono text-[9.5px] tracking-[0.14em] text-violet uppercase">
        Action proposée
      </p>
      <p className="mt-1.5 text-[13.5px] font-semibold text-white">
        {action.agentName} veut : {action.headline}
      </p>

      {action.details.length > 0 && (
        <ul className="mt-2 space-y-1">
          {action.details.map((detail, index) => (
            <li key={index} className="text-[12.5px] leading-relaxed text-[#A9B2C4]">
              — {detail}
            </li>
          ))}
        </ul>
      )}

      {settled ? (
        <p className="mt-3 text-[12.5px] font-semibold text-[#8B97A8]">
          {item.actionState === "confirmed" ? "✓ Action exécutée" : "✕ Action refusée"}
        </p>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onDecide(action.toolUseId, "confirm")}
            className="inline-flex items-center gap-1.5 rounded-control bg-flux px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-flux-d"
          >
            <Icon name="check" size={13} />
            Confirmer
          </button>
          <button
            type="button"
            onClick={() => onDecide(action.toolUseId, "refuse")}
            className="rounded-control border border-[#3D4759] px-3 py-1.5 text-[12.5px] font-semibold text-[#A9B2C4] transition-colors hover:border-[#5A6478] hover:text-white"
          >
            Refuser
          </button>
        </div>
      )}
    </div>
  );
}
