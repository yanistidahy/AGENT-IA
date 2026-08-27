"use client";

import type { DealRecord } from "@/lib/api/deals";
import { daysSince } from "@/lib/domain/dates";
import { dealHeat, dealProb } from "@/lib/domain/pipeline";
import type { DealHeat, PilotageSettings, StageLike } from "@/lib/domain/types";
import { moneyShort } from "@/lib/format";
import { CardMenu } from "./card-menu";

/**
 * La carte d'une affaire dans le kanban.
 *
 * Extraite du tableau quand le menu d'actions l'a fait passer la limite de 250
 * lignes : le tableau porte le glisser-déposer et l'optimisme, la carte porte
 * l'affichage d'une affaire. Elle n'écrit rien elle-même — elle remonte
 * l'intention, comme la ligne de la file d'accueil, pour qu'il n'existe qu'un
 * seul endroit qui sache ce qui est réellement en base.
 */
const HEAT_BORDER: Record<DealHeat, string> = {
  hot: "var(--color-win)",
  warm: "var(--color-gold)",
  cold: "var(--color-pulse)",
};

export function KanbanCard({
  deal,
  stages,
  currentStageId,
  settings,
  dragging,
  onDragStart,
  onDragEnd,
  onSelect,
  onMove,
  onLost,
}: {
  readonly deal: DealRecord;
  readonly stages: readonly StageLike[];
  readonly currentStageId: string;
  readonly settings: PilotageSettings;
  readonly dragging: boolean;
  readonly onDragStart: () => void;
  readonly onDragEnd: () => void;
  readonly onSelect: () => void;
  readonly onMove: (stageId: string) => void;
  readonly onLost: (reason: string) => void;
}) {
  const now = new Date();
  const heat = dealHeat(deal, settings, now);
  const idle = daysSince(deal.lastActivityAt ?? deal.createdAt, now);

  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", deal.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSelect();
      }}
      style={{ borderLeftColor: HEAT_BORDER[heat] }}
      className={`cursor-grab rounded-control border-l-[3px] bg-surface px-3 py-2.5 shadow-sm transition-transform hover:-translate-y-px hover:shadow-md active:cursor-grabbing ${
        dragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <h4 className="text-[13.5px] leading-snug font-semibold">{deal.name}</h4>
          <p className="mt-0.5 mb-2 text-[12px] text-muted">
            {deal.company?.name ?? "Sans société"}
          </p>
        </div>
        <CardMenu
          dealName={deal.name}
          stages={stages}
          currentStageId={currentStageId}
          onMove={onMove}
          onOpen={onSelect}
          onLost={onLost}
        />
      </div>

      <div className="h-[3px] overflow-hidden rounded bg-line-2">
        <i
          className="block h-full rounded transition-[width] duration-300"
          style={{
            width: `${dealProb(deal, deal.stage)}%`,
            backgroundColor: deal.stage.color,
          }}
        />
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="font-mono text-[13px] font-semibold">{moneyShort(deal.amount)}</span>
        <span className="ml-auto font-mono text-[10.5px] text-muted">{idle} j</span>
      </div>
    </article>
  );
}
