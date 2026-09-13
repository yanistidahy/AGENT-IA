"use client";

import {
  signatoryGap,
  signatureLines,
  type SignatoryLike,
} from "@/lib/domain/signatory-choice";

/**
 * Ce qui partira au bas des messages de cette campagne.
 *
 * Lire « Mohamed » dans un menu ne dit pas quelles lignes le destinataire
 * verra — et c'est pourtant la seule partie du message qui engage un nom. Le
 * même composant sert la création et l'édition : deux rendus de la même
 * promesse finiraient par ne plus dire la même chose (leçon du jalon 55).
 */
export function SignatoryPreview({
  signatory,
}: {
  readonly signatory: SignatoryLike | null;
}) {
  const gap = signatoryGap(signatory);

  if (gap.missing) {
    return (
      <p className="mt-2 rounded-control border border-warn bg-warn-l px-3 py-2 text-[12px] text-warn-d">
        {gap.message}
      </p>
    );
  }

  const lines = signatory === null ? [] : signatureLines(signatory);

  return (
    <div className="mt-2 rounded-control border border-line-2 px-3 py-2 text-[12px] text-muted">
      <span className="font-mono text-[10px] tracking-[0.08em] uppercase">
        Signature des messages
      </span>
      <div className="mt-1 whitespace-pre-line text-ink">{lines.join("\n")}</div>
    </div>
  );
}
