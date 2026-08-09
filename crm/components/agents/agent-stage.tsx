"use client";

import { Icon } from "@/components/ui/icon";
import { Portrait } from "./portrait";
import type { AgentProfile } from "@/lib/api/agents";

/**
 * L'agent sélectionné, en pied.
 *
 * Le portrait est grand et vertical parce que c'est le sujet : une pastille
 * ronde de 32 px transforme une personne en puce de liste. La colonne donne
 * aussi les trois faits qui disent si l'agent travaille — dernière vacation,
 * constats en attente, périmètre — pour que ce ne soit pas qu'une image.
 *
 * En dessous de `lg`, la colonne devient un bandeau horizontal : sur un
 * téléphone, la conversation prime sur le portrait, et une colonne de 260 px ne
 * laisserait plus rien à lire.
 */
export interface StageStats {
  /** Dernière vacation, déjà formatée côté serveur. Vide si aucune. */
  readonly lastRun: string;
  readonly openRecommendations: number;
}

interface AgentStageProps {
  readonly agent: AgentProfile;
  readonly stats: StageStats | undefined;
  readonly children?: React.ReactNode;
}

function Stat({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[#1E2430] py-1.5 last:border-b-0">
      <span className="font-mono text-[9px] tracking-[0.12em] text-[#4E5867] uppercase">
        {label}
      </span>
      <span className="text-right text-[12px] text-[#B8C2D0]">{value}</span>
    </div>
  );
}

export function AgentStage({ agent, stats, children }: AgentStageProps) {
  return (
    <aside
      className="flex shrink-0 flex-col gap-3 border-b border-[#1E2430] px-4 py-4 lg:w-[260px] lg:overflow-y-auto lg:border-r lg:border-b-0"
      aria-label={`Fiche de ${agent.name}`}
    >
      <div className="flex items-start gap-3 lg:block">
        <Portrait
          agent={agent}
          size="portrait"
          className="h-28 w-20 shrink-0 rounded-card lg:h-auto lg:w-full lg:aspect-[2/3]"
          initialsClassName="text-[28px] lg:text-[44px]"
        />

        <div className="min-w-0 flex-1 lg:mt-3">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate font-display text-[20px] leading-tight font-semibold text-white lg:text-[23px]">
              {agent.name}
            </h2>
            {agent.locked && <Icon name="lock" size={13} className="shrink-0 text-gold" />}
          </div>
          <p className="mt-0.5 text-[12.5px] text-[#8290A3]">{agent.role}</p>
          {agent.readOnly && !agent.locked && (
            <p className="mt-0.5 font-mono text-[9px] tracking-[0.12em] text-[#4E5867] uppercase">
              Lecture seule
            </p>
          )}
        </div>
      </div>

      <p className="text-[12px] leading-relaxed text-[#7F8B9C]">{agent.scope}</p>

      <div className="rounded-card border border-[#1E2430] px-3 py-1">
        <Stat
          label="Dernière vacation"
          value={stats === undefined || stats.lastRun === "" ? "Jamais" : stats.lastRun}
        />
        <Stat
          label="En attente"
          value={
            stats === undefined || stats.openRecommendations === 0
              ? "Aucun constat"
              : `${stats.openRecommendations} constat${stats.openRecommendations > 1 ? "s" : ""}`
          }
        />
        <Stat
          label="Vacation"
          value={
            agent.cadence === "daily"
              ? "Chaque jour"
              : agent.cadence === "weekly"
                ? "Chaque semaine"
                : "Sur demande"
          }
        />
      </div>

      {children}
    </aside>
  );
}
