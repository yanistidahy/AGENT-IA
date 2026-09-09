"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import type { CampaignView } from "@/lib/api/campaigns";

/**
 * Supprimer une campagne — et le refus qui l'accompagne.
 *
 * « Supprimer » **n'apparaît que sur une campagne qui n'a rien envoyé**. Absent
 * plutôt que grisé : un bouton grisé invite à chercher comment l'activer, un
 * bouton absent ne pose pas la question (jalon 26) — et l'explication est
 * donnée juste à côté, avec le nombre de messages qui retiennent la
 * suppression.
 *
 * Le verdict fait toujours foi **au moment d'écrire**, dans le service : la
 * confirmation peut rester ouverte pendant qu'un départ part, et c'est
 * exactement l'instant où la campagne cesse d'être supprimable (jalon 47).
 */

function isCampaigns(value: unknown): value is { campaigns: CampaignView[] } {
  return typeof value === "object" && value !== null && "campaigns" in value;
}

export function CampaignDelete({
  campaign,
  busy,
  onBusy,
  onChanged,
  onRefresh,
  onError,
}: {
  readonly campaign: CampaignView;
  readonly busy: boolean;
  readonly onBusy: (value: boolean) => void;
  readonly onChanged: (campaigns: CampaignView[]) => void;
  readonly onRefresh: () => void;
  readonly onError: (message: string | null) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { funnel } = campaign;

  const destroy = async () => {
    onBusy(true);
    onError(null);
    const result = await requestJson(
      `/api/campaigns?id=${encodeURIComponent(campaign.id)}`,
      { method: "DELETE" },
      isCampaigns,
    );
    onBusy(false);
    setConfirming(false);
    if (result.ok) {
      onChanged(result.data.campaigns);
      onRefresh();
    } else {
      onError(result.message);
    }
  };

  return (
    <>
      {campaign.deletable ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy}
          className="ml-auto min-h-[44px] text-muted hover:text-danger disabled:opacity-50 lg:min-h-0"
        >
          Supprimer
        </button>
      ) : (
        <span className="ml-auto text-[12px] text-muted">
          {funnel.messages} message{funnel.messages > 1 ? "s" : ""} envoyé
          {funnel.messages > 1 ? "s" : ""} : suppression impossible, archivez.
        </span>
      )}

      {confirming && (
        <div className="mt-2 w-full rounded-control border border-danger bg-pulse-l px-3 py-2">
          <p>
            Supprimer « <strong className="font-semibold">{campaign.name}</strong> » définitivement ?
            Partiront avec elle : sa séquence, ses étapes et ses {funnel.enrolled} inscription
            {funnel.enrolled > 1 ? "s" : ""}.{" "}
            <strong className="font-semibold">Les contacts ne sont pas touchés</strong> — ils restent
            dans le CRM avec tout leur historique.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void destroy()}
              disabled={busy}
              className="min-h-[44px] rounded-control bg-danger px-3 font-medium text-white disabled:opacity-50 lg:min-h-0 lg:py-1"
            >
              Supprimer définitivement
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="min-h-[44px] rounded-control border border-line px-3 lg:min-h-0 lg:py-1"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  );
}
