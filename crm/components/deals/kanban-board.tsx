"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DealRecord } from "@/lib/api/deals";
import Link from "next/link";
import { autoTaskNotice, moveDealStage } from "@/lib/client/deals-api";
import { daysSince } from "@/lib/domain/dates";
import { dealHeat, dealProb } from "@/lib/domain/pipeline";
import type { DealHeat, PilotageSettings, StageLike } from "@/lib/domain/types";
import { moneyShort } from "@/lib/format";

/**
 * Kanban du pipeline, glisser-déposer natif (aucune librairie).
 *
 * L'interface est optimiste : la carte change de colonne immédiatement, l'appel
 * réseau suit. En cas d'échec, l'état est restauré et le message affiché — un
 * déplacement qui semble réussir mais n'est pas persisté serait pire que pas de
 * glisser-déposer du tout.
 */
interface KanbanBoardProps {
  readonly deals: readonly DealRecord[];
  readonly stages: readonly StageLike[];
  readonly settings: PilotageSettings;
  readonly onSelect: (deal: DealRecord) => void;
}

const HEAT_BORDER: Record<DealHeat, string> = {
  hot: "var(--color-flux)",
  warm: "var(--color-gold)",
  cold: "var(--color-pulse)",
};

export function KanbanBoard({ deals, stages, settings, onSelect }: KanbanBoardProps) {
  const router = useRouter();
  const [placement, setPlacement] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const stageOf = (deal: DealRecord) => placement[deal.id] ?? deal.stageId;

  const drop = async (dealId: string, stageId: string) => {
    const deal = deals.find((candidate) => candidate.id === dealId);
    if (deal === undefined || stageOf(deal) === stageId) return;

    const previous = stageOf(deal);
    setPlacement((current) => ({ ...current, [dealId]: stageId }));
    setError(null);
    setNotice(null);

    const result = await moveDealStage(dealId, stageId);
    if (result.ok) {
      setNotice(result.data.autoTask === null ? null : autoTaskNotice(result.data.autoTask));
      router.refresh();
      return;
    }

    setPlacement((current) => ({ ...current, [dealId]: previous }));
    setError(result.message);
  };

  return (
    <>
      {error !== null && (
        <p className="mb-3 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}

      {notice !== null && (
        <p className="mb-3 flex flex-wrap items-center gap-2 rounded-control border border-[#B9E7DC] bg-flux-l px-3 py-2 text-[12.5px] text-flux-d">
          {notice}
          <Link href="/taches" className="font-semibold underline">
            Ouvrir /taches
          </Link>
        </p>
      )}

      <div className="flex items-start gap-3 overflow-x-auto pb-3.5">
        {stages.map((stage) => {
          const column = deals.filter((deal) => stageOf(deal) === stage.id);
          const amount = column.reduce((sum, deal) => sum + deal.amount, 0);

          return (
            <section
              key={stage.id}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(stage.id);
              }}
              onDragLeave={() => setOver((current) => (current === stage.id ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setOver(null);
                const id = dragging ?? event.dataTransfer.getData("text/plain");
                if (id !== "") void drop(id, stage.id);
              }}
              className={`flex max-h-[calc(100vh-300px)] w-[268px] shrink-0 flex-col gap-2 rounded-card p-2.5 transition-colors ${
                over === stage.id ? "bg-flux-l ring-2 ring-flux ring-inset" : "bg-[#E5EBE9]"
              }`}
            >
              <div
                aria-hidden
                className="mx-1 h-[3px] rounded"
                style={{ backgroundColor: stage.color }}
              />
              <header className="flex items-center gap-1.5 px-1">
                <b className="font-display text-[13px] font-semibold">{stage.name}</b>
                <span className="rounded-full bg-surface px-1.5 font-mono text-[10.5px] text-muted">
                  {column.length}
                </span>
                <span className="ml-auto font-mono text-[11px] font-medium text-muted">
                  {moneyShort(amount)}
                </span>
              </header>

              <div className="flex min-h-[60px] flex-col gap-2 overflow-y-auto p-0.5">
                {column.length === 0 ? (
                  <p className="px-2 py-4 text-center text-[12px] text-[#8DA39E]">
                    Déposez une affaire ici
                  </p>
                ) : (
                  column.map((deal) => (
                    <Card
                      key={deal.id}
                      deal={deal}
                      settings={settings}
                      dragging={dragging === deal.id}
                      onDragStart={() => setDragging(deal.id)}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onSelect={() => onSelect(deal)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function Card({
  deal,
  settings,
  dragging,
  onDragStart,
  onDragEnd,
  onSelect,
}: {
  deal: DealRecord;
  settings: PilotageSettings;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onSelect: () => void;
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
      <h4 className="text-[13.5px] leading-snug font-semibold">{deal.name}</h4>
      <p className="mt-0.5 mb-2 text-[12px] text-muted">
        {deal.company?.name ?? "Sans société"}
      </p>

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
