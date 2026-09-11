"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import type { CampaignView } from "@/lib/api/campaigns";
import { historyLossWarning, nameConfirms } from "@/lib/domain/campaign-deletion";

/**
 * Supprimer une campagne — deux chemins, une seule friction proportionnée.
 *
 * **Vide** (`campaign.deletable`) : « Supprimer » ouvre une confirmation
 * ordinaire, comme depuis le jalon 55. Rien n'a été mesuré, rien ne se perd.
 *
 * **A envoyé** : « Supprimer » n'apparaît pas — un bouton qui échouerait neuf
 * fois sur dix se lit comme cassé. À la place, le nombre qui bloque le chemin
 * simple, et un second geste explicite, moins visible, pour qui veut vraiment
 * forcer le passage : « Supprimer quand même ». Sa confirmation **nomme les
 * comptes exacts** (`historyLossWarning`, la même fonction que le serveur
 * revérifie) et **exige de taper le nom de la campagne** — la friction
 * demandée contre un clic qui toucherait des chiffres qu'on relit chaque
 * semaine.
 *
 * Le verdict fait toujours foi **au moment d'écrire**, dans le service : la
 * confirmation peut rester ouverte pendant qu'un départ part, et c'est
 * exactement l'instant où une campagne vide cesse de l'être (jalon 47).
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
  const [forcing, setForcing] = useState(false);
  const [typedName, setTypedName] = useState("");
  const { funnel } = campaign;

  const call = async (confirmName?: string) => {
    onBusy(true);
    onError(null);
    const query =
      confirmName === undefined
        ? ""
        : `&confirmName=${encodeURIComponent(confirmName)}`;
    const result = await requestJson(
      `/api/campaigns?id=${encodeURIComponent(campaign.id)}${query}`,
      { method: "DELETE" },
      isCampaigns,
    );
    onBusy(false);
    setConfirming(false);
    setForcing(false);
    setTypedName("");
    if (result.ok) {
      onChanged(result.data.campaigns);
      onRefresh();
    } else {
      onError(result.message);
    }
  };

  if (campaign.deletable) {
    return (
      <>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={busy}
          className="ml-auto min-h-[44px] text-muted hover:text-danger disabled:opacity-50 lg:min-h-0"
        >
          Supprimer
        </button>

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
                onClick={() => void call()}
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

  return (
    <>
      <span className="ml-auto text-[12px] text-muted">
        {funnel.messages} message{funnel.messages > 1 ? "s" : ""} envoyé
        {funnel.messages > 1 ? "s" : ""} : archivez pour la sortir de la liste sans rien perdre.
      </span>
      <button
        type="button"
        onClick={() => setForcing(true)}
        disabled={busy}
        className="min-h-[44px] text-[12px] text-muted hover:text-danger disabled:opacity-50 lg:min-h-0"
      >
        Supprimer quand même
      </button>

      {forcing && (
        <div className="mt-2 w-full rounded-control border border-danger bg-pulse-l px-3 py-2">
          <p>
            Supprimer « <strong className="font-semibold">{campaign.name}</strong> » définitivement ?{" "}
            {historyLossWarning({
              messages: funnel.messages,
              opens: funnel.opened,
              replies: funnel.replied,
            })}
          </p>
          <label className="mt-2 block text-[12px] font-semibold text-muted">
            Tapez « {campaign.name} » pour confirmer
            <input
              value={typedName}
              onChange={(event) => setTypedName(event.target.value)}
              placeholder={campaign.name}
              autoComplete="off"
              className="mt-1 block min-h-[44px] w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] font-normal outline-none focus:border-danger lg:min-h-0"
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void call(typedName)}
              disabled={busy || !nameConfirms(typedName, campaign.name)}
              className="min-h-[44px] rounded-control bg-danger px-3 font-medium text-white disabled:opacity-50 lg:min-h-0 lg:py-1"
            >
              Supprimer définitivement, avec son historique
            </button>
            <button
              type="button"
              onClick={() => {
                setForcing(false);
                setTypedName("");
              }}
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
