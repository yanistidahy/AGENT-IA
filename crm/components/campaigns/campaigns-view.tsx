"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import type { CampaignView } from "@/lib/api/campaigns";
import {
  chosenSignatory,
  signatoryOptionLabel,
  type MailboxOption,
} from "@/lib/domain/signatory-choice";
import { CampaignTile } from "./campaign-tile";
import { SignatoryPreview } from "./signatory-preview";

/**
 * `/campagnes` — configuration et lancement au même endroit.
 *
 * La définition des séquences a déménagé de /reglages : une séquence
 * n'existe plus qu'au sein d'une campagne, qui dit **d'où** elle part (la
 * boîte, donc la signature), **à qui** elle écrit (la sélection, dans le
 * vocabulaire de /contacts), et **ce qu'elle produit** (l'entonnoir).
 *
 * Aucun garde-fou ne bouge : la première étape passe toujours par la file des
 * départs du matin, les fiches closes et les oppositions sont refusées à
 * l'envoi, les plafonds de débit s'appliquent, et une réponse arrête la
 * séquence de la personne — tout cela vit dans `sequence-rules.ts` et
 * `departures.ts`, que cet écran ne fait qu'utiliser.
 */

export type { MailboxOption };

function isCampaigns(value: unknown): value is { campaigns: CampaignView[] } {
  return typeof value === "object" && value !== null && "campaigns" in value;
}

const CONTROL =
  "rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";

export function CampaignsView({
  initial,
  mailboxes,
}: {
  readonly initial: readonly CampaignView[];
  readonly mailboxes: readonly MailboxOption[];
}) {
  const [campaigns, setCampaigns] = useState<CampaignView[]>([...initial]);
  const [name, setName] = useState("");
  const [mailboxId, setMailboxId] = useState(mailboxes[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/campaigns",
      { method: "POST", body: JSON.stringify({ name, mailboxId }) },
      isCampaigns,
    );
    setBusy(false);
    if (result.ok) {
      setCampaigns(result.data.campaigns);
      setName("");
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="px-6 py-6">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Campagnes</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Une boîte d'envoi, une sélection de contacts, une séquence d'étapes — et
          l'entonnoir de chacune. Les angles par rôle (Réglages) s'appliquent à chaque
          destinataire.
        </p>
      </header>

      <section className="mb-5 rounded-card border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-[220px] flex-1">
            <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
              Nouvelle campagne
            </span>
            <input
              value={name}
              placeholder="Prospection SAV — septembre"
              onChange={(event) => setName(event.target.value)}
              className={`${CONTROL} w-full`}
            />
          </label>
          <label className="block">
            {/*
              L'intitulé nomme **les deux choses** que ce menu décide. Il ne
              disait que la boîte, alors qu'il choisit aussi qui signe — et
              c'est le signataire qu'on cherche quand on crée une campagne.
            */}
            <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
              Boîte d'envoi et signataire
            </span>
            <select
              value={mailboxId}
              onChange={(event) => setMailboxId(event.target.value)}
              className={CONTROL}
            >
              {mailboxes.map((box) => (
                <option key={box.id} value={box.id}>
                  {signatoryOptionLabel(box)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy || name.trim() === "" || mailboxId === ""}
            className="min-h-[44px] rounded-control bg-brand px-3 text-[13px] font-medium text-white hover:bg-brand-d disabled:opacity-60 lg:min-h-0 lg:py-1.5"
          >
            Créer
          </button>
        </div>
        <SignatoryPreview signatory={chosenSignatory(mailboxes, mailboxId)} />
        {error !== null && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      </section>

      {campaigns.length === 0 ? (
        <p className="rounded-card border border-dashed border-line px-4 py-6 text-[13px] text-muted">
          Aucune campagne. Créez-en une, choisissez sa boîte, puis désignez ses contacts
          depuis /contacts avec les filtres habituels.
        </p>
      ) : (
        /*
          **Une grille, pas une pile.** Les cartes faisaient toute la hauteur de
          l'écran chacune : on faisait défiler beaucoup pour voir peu, et la
          seule question qu'on se pose en arrivant — laquelle ? — demandait de
          lire les étapes, les inscrits et l'entonnoir de la première avant
          d'apercevoir la seconde. Une vignette répond à cette question ; le
          reste vit dans la page de la campagne.

          Sous `lg` la grille retombe à une colonne (jalon 46) : à 390 px, deux
          vignettes côte à côte ne laisseraient de place ni aux trois nombres ni
          au nom.
        */
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignTile key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </div>
  );
}
