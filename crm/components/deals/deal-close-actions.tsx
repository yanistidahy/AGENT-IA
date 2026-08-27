"use client";

import { useState } from "react";
import type { DealRecord } from "@/lib/api/deals";
import {
  deleteDeal,
  markDealLost,
  readDeletionReport,
  reopenDeal,
  type DeletionPayload,
} from "@/lib/client/deals-api";
import { DEAL_LOST_REASONS, OPT_OUT_REDIRECT } from "@/lib/domain/deal-loss";
import { describeDeletion } from "@/lib/domain/deal-deletion";
import { money } from "@/lib/format";

/**
 * Sortir une affaire du pipeline — les deux chemins, et leur écart de gravité.
 *
 * « Marquer perdue » est le geste de tous les jours : un bouton, un motif, et
 * l'affaire s'en va en gardant tout. « Supprimer » est l'exception, et l'écran
 * le montre — elle vit en bas, en rouge, derrière une confirmation qui nomme
 * l'affaire, son montant et ce qui partira avec elle. **Elle n'existe que
 * dans le tiroir** : une carte du kanban ne la propose pas, parce qu'effacer
 * doit demander d'avoir ouvert la fiche.
 */
export function DealCloseActions({
  deal,
  onChanged,
  onDeleted,
}: {
  readonly deal: DealRecord;
  readonly onChanged: () => void;
  /** La fiche vient de disparaître : le tiroir se referme, la liste se relit. */
  readonly onDeleted: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "losing" | "deleting">("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DeletionPayload | null>(null);

  const fail = (message: string) => {
    setBusy(false);
    setError(message);
  };

  const confirmLoss = async () => {
    setBusy(true);
    setError(null);
    const result = await markDealLost(deal.id, reason);
    if (!result.ok) return fail(result.message);
    setBusy(false);
    setMode("idle");
    setReason("");
    onChanged();
  };

  const reopen = async () => {
    setBusy(true);
    setError(null);
    const result = await reopenDeal(deal.id);
    if (!result.ok) return fail(result.message);
    setBusy(false);
    onChanged();
  };

  // Les faits d'abord, la question ensuite : la confirmation doit pouvoir
  // nommer ce qu'elle détruit, et le refus arriver avant qu'on ait cliqué.
  const askDelete = async () => {
    setBusy(true);
    setError(null);
    const result = await readDeletionReport(deal.id);
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setReport(result.data);
    setMode("deleting");
  };

  const confirmDelete = async () => {
    setBusy(true);
    setError(null);
    const result = await deleteDeal(deal.id);
    if (!result.ok) return fail(result.message);
    setBusy(false);
    setMode("idle");
    onDeleted();
  };

  return (
    <section className="mt-6 border-t border-line pt-4">
      {deal.status === "lost" ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[12.5px] text-muted">
            Affaire perdue
            {deal.lostReason === "" ? "" : ` — ${deal.lostReason}`}.
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() => void reopen()}
            className="rounded-control border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-surface-2 disabled:opacity-50 max-lg:min-h-11"
          >
            {busy ? "…" : "Rouvrir"}
          </button>
        </div>
      ) : mode === "losing" ? (
        <div className="rounded-card border border-line bg-surface-2 px-3.5 py-3">
          <h4 className="font-display text-[13.5px] font-semibold">
            Pourquoi cette affaire est-elle perdue ?
          </h4>
          <p className="mt-1 text-[12px] leading-relaxed text-muted">
            Elle sortira du pipeline en gardant son montant, son historique et son
            motif — et comptera dans les statistiques de perte.
          </p>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {DEAL_LOST_REASONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setReason(option)}
                className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors max-lg:min-h-11 ${
                  reason === option
                    ? "border-brand bg-brand text-white"
                    : "border-line bg-surface hover:bg-paper"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <label className="mt-2.5 block">
            <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
              Ou un motif à vous
            </span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="parti chez un intégrateur…"
              className="w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[13.5px] outline-none focus:border-brand"
            />
          </label>

          {/* L'opposition au démarchage n'est pas un motif d'affaire : elle se
              note sur la personne, seule fiche que les séquences relisent. */}
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted">{OPT_OUT_REDIRECT}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || reason.trim() === ""}
              onClick={() => void confirmLoss()}
              className="rounded-control bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50 max-lg:min-h-11"
            >
              {busy ? "…" : "Marquer perdue"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode("idle");
                setReason("");
              }}
              className="rounded-control border border-line px-3 py-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:bg-surface-2 max-lg:min-h-11"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => setMode("losing")}
          className="rounded-control border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-surface-2 disabled:opacity-50 max-lg:min-h-11"
        >
          Marquer perdue
        </button>
      )}

      {mode === "deleting" && report !== null ? (
        <div className="mt-3 rounded-card border border-[#F5D5CF] bg-pulse-l px-3.5 py-3">
          {report.verdict.deletable ? (
            <>
              <p className="text-[13px] leading-relaxed text-[#B2311F]">
                {describeDeletion(report.name, money(report.amount), {
                  deletable: true,
                  blockers: [],
                  collateral: report.verdict.collateral,
                })}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void confirmDelete()}
                  className="rounded-control bg-[#B2311F] px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#8E2718] disabled:opacity-50 max-lg:min-h-11"
                >
                  {busy ? "…" : "Supprimer définitivement"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setMode("idle")}
                  className="rounded-control border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-surface-2 max-lg:min-h-11"
                >
                  Annuler
                </button>
              </div>
            </>
          ) : (
            // Le refus arrive **avant** la question, avec le geste de
            // remplacement : « impossible » seul laisserait chercher.
            <>
              <p className="text-[13px] leading-relaxed text-[#B2311F]">{report.refusal}</p>
              <button
                type="button"
                onClick={() => setMode("idle")}
                className="mt-2.5 rounded-control border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-surface-2 max-lg:min-h-11"
              >
                J'ai compris
              </button>
            </>
          )}
        </div>
      ) : (
        mode !== "losing" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void askDelete()}
            className="mt-2 block text-[12px] text-muted underline transition-colors hover:text-[#B2311F] disabled:opacity-50 max-lg:min-h-11"
          >
            Supprimer cette affaire…
          </button>
        )
      )}

      {error !== null && (
        <p className="mt-2.5 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}
    </section>
  );
}
