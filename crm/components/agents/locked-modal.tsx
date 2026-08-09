"use client";

import { useEffect } from "react";
import { Icon } from "@/components/ui/icon";
import type { AgentProfile } from "@/lib/api/agents";

/**
 * Modale d'explication d'un agent verrouillé.
 *
 * Cliquer sur Étienne ouvre ceci, jamais une erreur : le verrou est un choix de
 * produit, pas une panne, et l'interface doit le dire.
 */
export function LockedModal({
  agent,
  onClose,
}: {
  agent: AgentProfile | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (agent === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [agent, onClose]);

  if (agent === null) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="locked-title"
        className="fixed top-1/2 left-1/2 z-50 w-[min(440px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-card border border-[#2A3240] bg-[#161A23] p-6 shadow-float"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-11 place-items-center rounded-full font-display text-[13px] font-semibold text-white"
            style={{ backgroundColor: agent.color }}
          >
            {agent.initials}
          </span>
          <div>
            <h2 id="locked-title" className="flex items-center gap-2 font-display text-[17px] font-semibold text-white">
              {agent.name}
              <Icon name="lock" size={14} className="text-gold" />
            </h2>
            <p className="text-[12px] text-[#6E7A8C]">{agent.role}</p>
          </div>
        </div>

        <p className="mt-4 text-[13px] leading-relaxed text-[#A9B2C4]">
          {agent.name} n&apos;est pas encore actif sur ce déploiement. Son domaine reste à
          définir avec l&apos;équipe : tant qu&apos;il n&apos;a pas de spécialité propre,
          l&apos;activer ajouterait un neuvième avis sans ajouter de compétence.
        </p>

        <p className="mt-3 text-[13px] leading-relaxed text-[#A9B2C4]">
          Pour le débloquer, passez la variable{" "}
          <code className="rounded bg-[#0F1117] px-1.5 py-0.5 font-mono text-[11.5px] text-flux">
            AGENT_ETIENNE_ENABLED
          </code>{" "}
          à <code className="font-mono text-[11.5px] text-flux">true</code> sur le service, et
          écrivez sa personnalité dans{" "}
          <code className="font-mono text-[11.5px] text-[#8B97A8]">
            lib/agents/prompts/etienne.ts
          </code>
          .
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-control bg-[#242C3A] py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#2E3746]"
        >
          J&apos;ai compris
        </button>
      </div>
    </>
  );
}
