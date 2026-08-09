"use client";

import { useState } from "react";
import type { SequenceOption } from "@/components/activities/run-sequence";
import { runSequence } from "@/lib/client/activity-api";
import type { DealRecord } from "@/lib/api/deals";

/**
 * Proposition de la séquence post-vente après un gain.
 *
 * Proposée, jamais appliquée d'office — même règle que la promotion du contact
 * en « Client » au jalon 3 : une séquence crée d'un coup trois tâches datées, et
 * toutes les affaires gagnées ne justifient pas un suivi post-vente.
 *
 * La séquence est reconnue à son nom (« post-vente »), pas à un identifiant
 * codé en dur : les séquences sont éditables dans Réglages, et `q3` du seed peut
 * être renommé, désactivé ou supprimé.
 */
interface PostWinSequenceProps {
  readonly deal: DealRecord;
  readonly sequences: readonly SequenceOption[];
  readonly onChanged: () => void;
}

function findPostSale(sequences: readonly SequenceOption[]): SequenceOption | null {
  return (
    sequences.find(
      (sequence) =>
        sequence.active &&
        /post[- ]?vente/i.test(`${sequence.name} ${sequence.trigger}`),
    ) ?? null
  );
}

export function PostWinSequence({ deal, sequences, onChanged }: PostWinSequenceProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const sequence = findPostSale(sequences);
  if (dismissed || sequence === null || deal.status !== "won") return null;

  const start = deal.closedAt ?? new Date();

  const run = async () => {
    setBusy(true);
    setError(null);
    const result = await runSequence(sequence.id, {
      dealId: deal.id,
      owner: deal.owner,
      start: start.toISOString(),
    });
    setBusy(false);
    if (result.ok) onChanged();
    else setError(result.message);
  };

  return (
    <div className="mt-3 rounded-card border border-[#C7C0F2] bg-violet-l px-3.5 py-3">
      <p className="text-[13px] leading-relaxed text-[#4B37C0]">
        Lancer « {sequence.name} » sur cette affaire ? {sequence.steps.length} tâches seront
        créées, comptées depuis la date de clôture.
      </p>
      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void run()}
          className="rounded-control bg-violet px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "…" : `Créer ${sequence.steps.length} tâches`}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-control border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-surface-2"
        >
          Plus tard
        </button>
      </div>
      {error !== null && <p className="mt-2 text-[12.5px] text-[#B2311F]">{error}</p>}
    </div>
  );
}
