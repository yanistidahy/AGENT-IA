"use client";

import Link from "next/link";
import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import type { CampaignView } from "@/lib/api/campaigns";
import { EmailSequencesPanel, type SequenceView } from "@/components/settings/email-sequences-panel";
import { FunnelRow } from "@/components/emails/funnel-row";
import { CampaignMembers } from "./campaign-members";
import type { CampaignMember } from "@/lib/domain/campaign-members";

/**
 * Une campagne : son entonnoir, sa boîte, sa sélection, ses étapes.
 *
 * L'entonnoir d'abord — c'est la réponse à « laquelle marche ? », et c'est
 * pour elle que l'écran existe. Mêmes définitions que /emails, bornées à cette
 * campagne : personnes écrites, ouvertes (estimation, jalon 37), répondues,
 * rendez-vous.
 */

interface MailboxOption {
  readonly id: string;
  readonly label: string;
  readonly signName: string;
}

function isCampaigns(value: unknown): value is { campaigns: CampaignView[] } {
  return typeof value === "object" && value !== null && "campaigns" in value;
}

const CONTROL =
  "rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";

function Stat({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="min-w-[86px] rounded-control border border-line-2 px-2.5 py-1.5">
      <div className="font-mono text-[10px] tracking-[0.08em] text-muted uppercase">{label}</div>
      <div className="font-display text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export function CampaignCard({
  campaign,
  sequence,
  members,
  mailboxes,
  onChanged,
  onRefresh,
}: {
  readonly campaign: CampaignView;
  readonly sequence: SequenceView | null;
  readonly members: readonly CampaignMember[];
  readonly mailboxes: readonly MailboxOption[];
  readonly onChanged: (campaigns: CampaignView[]) => void;
  /** Recharge la page : les inscrits sont rendus côté serveur. */
  readonly onRefresh: () => void;
}) {
  const [name, setName] = useState(campaign.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [open, setOpen] = useState(false);

  const patch = async (change: { name?: string; mailboxId?: string }) => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/campaigns",
      { method: "PATCH", body: JSON.stringify({ id: campaign.id, ...change }) },
      isCampaigns,
    );
    setBusy(false);
    if (result.ok) onChanged(result.data.campaigns);
    else setError(result.message);
  };

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/campaigns/actions",
      { method: "POST", body: JSON.stringify(body) },
      isCampaigns,
    );
    setBusy(false);
    if (result.ok) {
      onChanged(result.data.campaigns);
      onRefresh();
    } else {
      setError(result.message);
    }
  };

  const destroy = async () => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      `/api/campaigns?id=${encodeURIComponent(campaign.id)}`,
      { method: "DELETE" },
      isCampaigns,
    );
    setBusy(false);
    setConfirming(false);
    if (result.ok) {
      onChanged(result.data.campaigns);
      onRefresh();
    } else {
      setError(result.message);
    }
  };

  const { funnel } = campaign;
  const contactsHref = `/contacts?campagne=${encodeURIComponent(campaign.id)}${
    campaign.selection === "" ? "" : `&${campaign.selection}`
  }`;

  return (
    <section className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {campaign.archivedAt !== null && (
          <span className="rounded-control border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
            Archivée
          </span>
        )}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={() => {
            if (name.trim() !== "" && name !== campaign.name) void patch({ name: name.trim() });
          }}
          className={`${CONTROL} min-w-[220px] flex-1 font-display text-[15px] font-semibold`}
        />
        <label className="flex items-center gap-2 text-[12.5px] text-muted">
          Envoyée depuis
          <select
            value={campaign.mailboxId}
            disabled={busy}
            onChange={(event) => void patch({ mailboxId: event.target.value })}
            className={CONTROL}
          >
            {mailboxes.map((box) => (
              <option key={box.id} value={box.id}>
                {box.label} · {box.signName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <Stat label="Inscrits" value={funnel.enrolled} />
        <Stat label="En cours" value={funnel.running} />
      </div>

      {/*
        **Le même entonnoir que /emails, et le même composant.** Les nombres
        viennent de `readFunnelFacts`, la fonction qui sert la page des emails,
        bornée à cette campagne : deux additions d'une même chose finiraient par
        se contredire, et personne ne saurait laquelle croire.
      */}
      <div className="mb-3">
        <FunnelRow steps={funnel.steps} />
      </div>

      <div className="mb-3 rounded-control border border-line-2 px-3 py-2 text-[12.5px]">
        <span className="font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
          Sélection
        </span>{" "}
        {campaign.selection === "" ? (
          <span className="text-muted">aucune — personne n'est encore désigné.</span>
        ) : (
          <code className="break-all text-[12px]">{campaign.selection}</code>
        )}
        <div className="mt-1">
          <Link href={contactsHref} className="text-brand-d hover:underline">
            Choisir les contacts sur /contacts, puis inscrire depuis là-bas
          </Link>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 border-t border-line-2 pt-3 text-[12.5px]">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="min-h-[44px] rounded-control border border-line px-3 hover:border-brand lg:min-h-0 lg:py-1"
        >
          {open ? "Masquer les inscrits" : `Voir les ${funnel.enrolled} inscrit${funnel.enrolled > 1 ? "s" : ""}`}
        </button>

        <button
          type="button"
          onClick={() =>
            void act({
              action: "archive",
              campaignId: campaign.id,
              archived: campaign.archivedAt === null,
            })
          }
          disabled={busy}
          title={
            campaign.archivedAt === null
              ? "Sort de la liste active et arrête les envois. L'histoire et les statistiques restent."
              : "Remet la campagne dans la liste active. La séquence reste inactive tant qu'on ne la rouvre pas."
          }
          className="min-h-[44px] rounded-control border border-line px-3 hover:border-brand disabled:opacity-50 lg:min-h-0 lg:py-1"
        >
          {campaign.archivedAt === null ? "Archiver" : "Désarchiver"}
        </button>

        {/*
          « Supprimer » n'apparaît que sur une campagne qui n'a rien envoyé.
          Absent plutôt que grisé : un bouton grisé invite à chercher comment
          l'activer, un bouton absent ne pose pas la question (jalon 26) — et
          l'explication est donnée juste à côté.
        */}
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
      </div>

      {confirming && (
        <div className="mb-3 rounded-control border border-danger bg-pulse-l px-3 py-2 text-[12.5px]">
          <p>
            Supprimer « <strong className="font-semibold">{campaign.name}</strong> »
            définitivement ? Partiront avec elle : sa séquence, ses étapes et ses{" "}
            {funnel.enrolled} inscription{funnel.enrolled > 1 ? "s" : ""}.{" "}
            <strong className="font-semibold">Les contacts ne sont pas touchés</strong> — ils
            restent dans le CRM avec tout leur historique.
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

      {open && <CampaignMembers members={members} onChanged={onRefresh} />}

      {/*
        Les étapes : l'éditeur du jalon 38, monté tel quel. Mêmes règles — trois
        étapes au plus, mode automatique à double verrou —, même route. Le
        déménagement de /reglages vers ici n'a pas créé de second éditeur.
      */}
      {sequence !== null && <EmailSequencesPanel initial={[sequence]} embedded />}

      {error !== null && <p className="mt-2 text-[12px] text-danger">{error}</p>}
    </section>
  );
}
