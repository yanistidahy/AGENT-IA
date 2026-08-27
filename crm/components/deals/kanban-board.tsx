"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DealRecord } from "@/lib/api/deals";
import Link from "next/link";
import { autoTaskNotice, markDealLost, moveDealStage } from "@/lib/client/deals-api";
import { KanbanCard } from "./kanban-card";
import type { PilotageSettings, StageLike } from "@/lib/domain/types";
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

  /**
   * Perdre depuis la carte. La ligne disparaît **après** la réponse, pas avant :
   * le kanban ne montre que les affaires en cours, une carte retirée d'office
   * puis remise en cas d'échec clignoterait sans rien apprendre. Le déplacement
   * d'étape, lui, reste optimiste — il est réversible, celui-ci l'est par un
   * autre geste.
   */
  const lose = async (dealId: string, reason: string) => {
    setError(null);
    setNotice(null);
    const result = await markDealLost(dealId, reason);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setNotice(`Affaire marquée perdue — motif : ${reason}.`);
    router.refresh();
  };

  return (
    <>
      {error !== null && (
        <p className="mb-3 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}

      {notice !== null && (
        <p className="mb-3 flex flex-wrap items-center gap-2 rounded-control border border-[#D3CEFA] bg-brand-l px-3 py-2 text-[12.5px] text-brand-d">
          {notice}
          <Link href="/taches" className="font-semibold underline">
            Ouvrir /taches
          </Link>
        </p>
      )}

      {/* Sur téléphone, les colonnes s'empilent : un kanban de 1 700 px ne se
          « lit » pas en défilant latéralement — on parcourt les étapes de haut
          en bas, chaque colonne à pleine largeur. Le glisser-déposer reste une
          affaire d'écran large ; le tiroir sait toujours changer l'étape. */}
      <div className="flex items-start gap-3 pb-3.5 max-lg:flex-col lg:overflow-x-auto">
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
              className={`flex flex-col gap-2 rounded-card p-2.5 transition-colors max-lg:w-full lg:max-h-[calc(100vh-300px)] lg:w-[268px] lg:shrink-0 ${
                over === stage.id ? "bg-brand-l ring-2 ring-brand ring-inset" : "bg-[#E4E6EF]"
              }`}
            >
              <div
                aria-hidden
                className="mx-1 h-[3px] rounded"
                style={{ backgroundColor: stage.color }}
              />
              <header className="flex items-center gap-1.5 px-1">
                {/*
                  Le critère de sortie au survol, et dans `title` plutôt que
                  dans une info-bulle maison : il doit rester lisible au clavier
                  et par une aide technique, ce qu'un `div` positionné en CSS ne
                  garantit pas. Il est écrit du point de vue de l'engagement de
                  l'acheteur — voir la migration `9_qualification`.
                */}
                <b
                  className="font-display text-[13px] font-semibold"
                  title={
                    stage.exitCriterion !== undefined && stage.exitCriterion !== ""
                      ? `Sortie : ${stage.exitCriterion}`
                      : undefined
                  }
                >
                  {stage.name}
                </b>
                <span className="rounded-full bg-surface px-1.5 font-mono text-[10.5px] text-muted">
                  {column.length}
                </span>
                <span className="ml-auto font-mono text-[11px] font-medium text-muted">
                  {moneyShort(amount)}
                </span>
              </header>

              <div className="flex min-h-[60px] flex-col gap-2 overflow-y-auto p-0.5">
                {column.length === 0 ? (
                  <p className="px-2 py-4 text-center text-[12px] text-muted">
                    Déposez une affaire ici
                  </p>
                ) : (
                  column.map((deal) => (
                    <KanbanCard
                      key={deal.id}
                      deal={deal}
                      stages={stages}
                      currentStageId={stageOf(deal)}
                      settings={settings}
                      dragging={dragging === deal.id}
                      onDragStart={() => setDragging(deal.id)}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onSelect={() => onSelect(deal)}
                      onMove={(stageId) => void drop(deal.id, stageId)}
                      onLost={(reason) => void lose(deal.id, reason)}
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
