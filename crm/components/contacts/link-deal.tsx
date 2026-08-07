"use client";

import { useState } from "react";
import { updateDeal } from "@/lib/client/deals-api";

/**
 * Rattachement du contact à une affaire existante, depuis la fiche contact.
 *
 * Le lien vit sur l'affaire (`Deal.contactId`), pas sur le contact : on écrit
 * donc sur l'affaire choisie. Faire l'inverse — un champ « affaire » sur le
 * contact — laisserait croire qu'un contact n'en porte qu'une seule.
 */
export interface LinkableDeal {
  readonly id: string;
  readonly name: string;
  readonly contactId: string | null;
}

interface LinkDealProps {
  readonly contactId: string;
  readonly deals: readonly LinkableDeal[];
  readonly onChanged: () => void;
}

export function LinkDeal({ contactId, deals, onChanged }: LinkDealProps) {
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = deals.filter((deal) => deal.contactId !== contactId);
  if (available.length === 0) return null;

  const link = async () => {
    if (choice === "") return;
    setBusy(true);
    setError(null);
    const result = await updateDeal(choice, { contactId });
    setBusy(false);
    if (result.ok) {
      setChoice("");
      onChanged();
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <select
        value={choice}
        onChange={(event) => setChoice(event.target.value)}
        className="min-w-[220px] rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-flux"
      >
        <option value="">Lier à une affaire existante…</option>
        {available.map((deal) => (
          <option key={deal.id} value={deal.id}>
            {deal.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={busy || choice === ""}
        onClick={() => void link()}
        className="rounded-control border border-line px-3 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-surface-2 disabled:opacity-45"
      >
        {busy ? "…" : "Lier"}
      </button>
      {error !== null && <span className="text-[12.5px] text-[#B2311F]">{error}</span>}
    </div>
  );
}
