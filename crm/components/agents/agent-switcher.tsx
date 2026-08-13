"use client";

import { Icon } from "@/components/ui/icon";
import { Portrait } from "./portrait";
import type { AgentProfile } from "@/lib/api/agents";

/**
 * Bande de portraits en tête du fil, pour changer d'agent sans le quitter des
 * yeux.
 *
 * Le roster de droite reste la vue d'ensemble — nom, rôle, lecture seule. Cette
 * bande-ci sert à autre chose : changer d'interlocuteur au milieu d'une pensée,
 * là où le regard est déjà. D'où les portraits seuls, sans texte.
 *
 * Vignette `thumb` : c'est la taille déjà stockée, et 28 px n'en demandent pas
 * une troisième. Le cadrage rond est propre à cette bande — la même image sert
 * en 3/4 dans le roster.
 */
export function AgentSwitcher({
  agents,
  activeSlug,
  onSelect,
}: {
  readonly agents: readonly AgentProfile[];
  readonly activeSlug: string;
  readonly onSelect: (agent: AgentProfile) => void;
}) {
  if (agents.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label="Changer d'agent"
      className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-[#1E2430] px-4 py-2.5"
    >
      {agents.map((agent) => {
        const active = agent.slug === activeSlug;
        return (
          <button
            key={agent.slug}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${agent.name} — ${agent.role}`}
            title={`${agent.name} — ${agent.role}`}
            onClick={() => onSelect(agent)}
            className={`relative shrink-0 rounded-full transition-opacity ${
              active
                ? // L'anneau se pose en dehors du portrait : un anneau intérieur
                  // rognerait le visage, ce qu'on vient justement d'éviter.
                  "opacity-100 ring-2 ring-brand-lift ring-offset-2 ring-offset-[#0B1030]"
                : "opacity-45 hover:opacity-80"
            }`}
          >
            <Portrait
              agent={agent}
              size="thumb"
              className="size-7 rounded-full"
              initialsClassName="text-[9px]"
            />
            {agent.locked && (
              <Icon
                name="lock"
                size={9}
                className="absolute -right-0.5 -bottom-0.5 rounded-full bg-[#0B1030] text-gold"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
