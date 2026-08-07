"use client";

import { useState } from "react";
import type { DealRecord } from "@/lib/api/deals";
import { updateContact } from "@/lib/client/crm-api";

/**
 * Promotion du contact en « Client » après un gain.
 *
 * Proposée, jamais automatique : c'est une écriture sur une autre fiche que
 * celle qu'on manipule, et rien ne dit qu'une affaire gagnée fasse du
 * signataire le client — l'acheteur peut être un intermédiaire. La carte
 * disparaît dès que le contact porte déjà le bon cycle de vie.
 */
interface PromoteContactProps {
  readonly deal: DealRecord;
  readonly onChanged: () => void;
}

export function PromoteContact({ deal, onChanged }: PromoteContactProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const contact = deal.contact;
  if (
    dismissed ||
    contact === null ||
    deal.status !== "won" ||
    contact.lifecycle === "Client"
  ) {
    return null;
  }

  const promote = async () => {
    setBusy(true);
    setError(null);
    const result = await updateContact(contact.id, { lifecycle: "Client" });
    setBusy(false);
    if (result.ok) onChanged();
    else setError(result.message);
  };

  return (
    <div className="mt-5 rounded-card border border-[#B9E7DC] bg-flux-l px-3.5 py-3">
      <p className="text-[13px] leading-relaxed text-flux-d">
        Affaire gagnée. <b>{contact.firstName} {contact.lastName}</b> est encore
        « {contact.lifecycle} » — le passer en « Client » ?
      </p>
      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void promote()}
          className="rounded-control bg-flux px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-flux-d disabled:opacity-50"
        >
          {busy ? "…" : "Promouvoir en Client"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="rounded-control border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-surface-2"
        >
          Plus tard
        </button>
      </div>
      {error !== null && (
        <p className="mt-2 text-[12.5px] text-[#B2311F]">{error}</p>
      )}
    </div>
  );
}
