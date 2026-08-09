"use client";

import { Portrait } from "./portrait";
import type { AgentProfile } from "@/lib/api/agents";

/**
 * Écran d'ouverture d'un fil vide.
 *
 * Une conversation vide affichait une phrase et rien d'autre : il fallait
 * inventer sa première question. Les quatre amorces viennent du périmètre de
 * l'agent (`lib/agents/starters.ts`) — elles montrent ce qu'il sait faire au
 * lieu de le décrire, et un clic vaut un message envoyé.
 *
 * Le portrait est en taille `portrait`, la seule des deux qui supporte 200 px
 * sans bouillie. Il disparaît dès le premier message : c'est un seuil, pas un
 * en-tête.
 */
export function Welcome({
  agent,
  onAsk,
  disabled,
}: {
  readonly agent: AgentProfile;
  readonly onAsk: (question: string) => void;
  readonly disabled: boolean;
}) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-10">
      <Portrait
        agent={agent}
        size="portrait"
        className="size-32 rounded-full sm:size-48 lg:size-[200px]"
        initialsClassName="text-[40px] sm:text-[56px]"
      />

      <h2 className="mt-5 text-center font-display text-[22px] leading-tight font-semibold text-white sm:text-[26px]">
        {agent.name}, à votre service.
      </h2>
      <p className="mt-1 text-center text-[13px] text-[#7F8B9C]">{agent.role}</p>

      {agent.starters.length > 0 && (
        <div className="mt-7 grid w-full max-w-[560px] gap-2 sm:grid-cols-2">
          {agent.starters.map((starter) => (
            <button
              key={starter.question}
              type="button"
              disabled={disabled}
              onClick={() => onAsk(starter.question)}
              className="rounded-card border border-[#242C3A] bg-[#141821] px-3.5 py-3 text-left transition-colors hover:border-flux hover:bg-[#181D28] disabled:opacity-50"
            >
              <span className="block text-[13px] font-semibold text-white">
                {starter.question}
              </span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-[#7F8B9C]">
                {starter.subtitle}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
