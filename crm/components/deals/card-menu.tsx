"use client";

import { useEffect, useRef, useState } from "react";
import type { StageLike } from "@/lib/domain/types";
import { DEAL_LOST_REASONS } from "@/lib/domain/deal-loss";

/**
 * Le menu d'une carte du kanban.
 *
 * ## Pourquoi il existe
 *
 * Le tableau ne se pilotait qu'au glisser-déposer, qui **n'existe pas au
 * doigt** : sur un téléphone, faire avancer une affaire demandait d'ouvrir la
 * fiche, de trouver « Faire avancer », de viser une étape. « Déplacer vers »
 * met les mêmes étapes à un tap, et c'est ce qui rend le pipeline utilisable en
 * mobilité — le reste du menu suit la même règle : agir sans ouvrir le tiroir.
 *
 * ## Ce qu'il ne propose pas
 *
 * **Jamais « Supprimer ».** Effacer une affaire doit demander d'avoir ouvert sa
 * fiche : un geste destructeur à deux taps depuis une liste, c'est un geste
 * qu'on finit par faire par erreur. La suppression vit dans le tiroir, en bas,
 * derrière une confirmation qui nomme l'affaire — voir `deal-close-actions`.
 *
 * Le motif de perte se choisit **dans le menu lui-même** plutôt que dans une
 * boîte de dialogue : deux taps au total, et la perte reste aussi rapide que
 * le geste qu'elle remplace.
 */
export function CardMenu({
  dealName,
  stages,
  currentStageId,
  onMove,
  onOpen,
  onLost,
}: {
  readonly dealName: string;
  readonly stages: readonly StageLike[];
  readonly currentStageId: string;
  readonly onMove: (stageId: string) => void;
  readonly onOpen: () => void;
  readonly onLost: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState(false);
  const node = useRef<HTMLDivElement>(null);

  // Fermer au clic extérieur et à Échap — mêmes règles que le tiroir et le
  // menu de la file d'accueil : deux surfaces flottantes qui se refermeraient
  // différemment se remarquent tout de suite.
  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpen(false);
      setAsking(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={node} className="relative shrink-0" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label={`Actions pour ${dealName}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
          setAsking(false);
        }}
        className="flex items-center justify-center rounded-control text-muted transition-colors hover:bg-paper hover:text-ink max-lg:size-11 max-lg:text-[17px] lg:size-7 lg:text-[13px]"
      >
        ⋯
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-1 w-56 overflow-hidden rounded-card border border-line bg-surface py-1 shadow-float"
        >
          {asking ? (
            <>
              <p className="px-3 py-1.5 font-mono text-[9.5px] tracking-[0.12em] text-muted uppercase">
                Motif de la perte
              </p>
              {DEAL_LOST_REASONS.map((reason) => (
                <Item
                  key={reason}
                  onClick={() => {
                    setOpen(false);
                    setAsking(false);
                    onLost(reason);
                  }}
                >
                  {reason}
                </Item>
              ))}
              {/* Un motif à soi demande de la place : c'est le tiroir qui
                  l'offre, et le menu le dit plutôt que de le taire. */}
              <Item
                onClick={() => {
                  setOpen(false);
                  setAsking(false);
                  onOpen();
                }}
              >
                <span className="text-muted">Autre motif — ouvrir la fiche…</span>
              </Item>
            </>
          ) : (
            <>
              <p className="px-3 py-1.5 font-mono text-[9.5px] tracking-[0.12em] text-muted uppercase">
                Déplacer vers
              </p>
              {stages
                .filter((stage) => stage.id !== currentStageId)
                .map((stage) => (
                  <Item
                    key={stage.id}
                    onClick={() => {
                      setOpen(false);
                      onMove(stage.id);
                    }}
                  >
                    <span
                      aria-hidden
                      className="mr-2 inline-block size-2 rounded-full align-middle"
                      style={{ backgroundColor: stage.color }}
                    />
                    {stage.name}
                  </Item>
                ))}

              <div className="my-1 border-t border-line-2" />
              <Item
                onClick={() => {
                  setOpen(false);
                  onOpen();
                }}
              >
                Ouvrir la fiche
              </Item>
              <Item
                tone="danger"
                onClick={(event) => {
                  // Le menu reste ouvert : la perte demande un motif, et le
                  // demander ici évite d'ouvrir le tiroir pour un seul choix.
                  event.stopPropagation();
                  setAsking(true);
                }}
              >
                Marquer perdue…
              </Item>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Item({
  children,
  onClick,
  tone,
}: {
  readonly children: React.ReactNode;
  readonly onClick: (event: React.MouseEvent) => void;
  readonly tone?: "danger";
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`block w-full px-3 py-1.5 text-left text-[12.5px] transition-colors hover:bg-surface-2 max-lg:min-h-11 max-lg:py-3 max-lg:text-[13.5px] ${
        tone === "danger" ? "text-[#B2311F]" : ""
      }`}
    >
      {children}
    </button>
  );
}
