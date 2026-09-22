"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import type { CampaignView } from "@/lib/api/campaigns";
import { EmailSequencesPanel, type SequenceView } from "@/components/settings/email-sequences-panel";
import { FunnelRow } from "@/components/emails/funnel-row";
import type { CampaignMember } from "@/lib/domain/campaign-members";
import type { MailboxOption } from "@/lib/domain/signatory-choice";
import { sequenceProgress } from "@/lib/domain/campaign-status";
import { CampaignMembers } from "./campaign-members";
import { ComposeAction } from "./compose-action";
import { CampaignDelete } from "./campaign-delete";
import { CampaignHeader } from "./campaign-header";
import { ReopenAction } from "./reopen-action";

/**
 * Une campagne, en entier — le second niveau de `/campagnes`.
 *
 * L'ordre des blocs est celui des questions qu'on se pose en arrivant : où
 * en est-elle (l'entonnoir et l'avancement), à qui écrit-elle (la sélection et
 * les inscrits), et qu'est-ce qu'elle dit (les étapes). Les actions sont dans
 * l'en-tête, sous les yeux, parce qu'on vient souvent ici pour en faire une.
 *
 * **Rien n'est recalculé ici.** L'entonnoir vient de `readFunnelFacts`, la
 * fonction qui sert /emails, borné à cette campagne ; l'état et l'avancement
 * viennent du domaine. Un second calcul sur ce même écran finirait par
 * contredire la vignette d'à côté.
 */

function isCampaigns(value: unknown): value is { campaigns: CampaignView[] } {
  return typeof value === "object" && value !== null && "campaigns" in value;
}

const BUTTON =
  "min-h-[44px] rounded-control border border-line px-3 hover:border-brand disabled:opacity-50 lg:min-h-0 lg:py-1";

export function CampaignDetail({
  campaign: initial,
  sequence,
  members,
  mailboxes,
}: {
  readonly campaign: CampaignView;
  readonly sequence: SequenceView | null;
  readonly members: readonly CampaignMember[];
  readonly mailboxes: readonly MailboxOption[];
}) {
  const router = useRouter();
  const [campaign, setCampaign] = useState(initial);
  const [name, setName] = useState(initial.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Les routes renvoient **toutes** les campagnes ; on ne garde que la nôtre.
  // Adopter la liste entière est exactement ce qui avait fait adopter au
  // panneau embarqué les séquences de tout le CRM (jalon 70).
  const adopt = (campaigns: readonly CampaignView[]) => {
    const mine = campaigns.find((entry) => entry.id === campaign.id);
    if (mine !== undefined) setCampaign(mine);
  };

  const send = async (path: string, body: Record<string, unknown>, method = "POST") => {
    setBusy(true);
    setError(null);
    const result = await requestJson(path, { method, body: JSON.stringify(body) }, isCampaigns);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    adopt(result.data.campaigns);
    router.refresh();
  };

  const { funnel } = campaign;
  const running = sequence?.active ?? false;
  const progress = sequenceProgress({
    enrolled: funnel.enrolled,
    steps: campaign.steps,
    delivered: campaign.delivered,
  });
  const contactsHref = `/contacts?campagne=${encodeURIComponent(campaign.id)}${
    campaign.selection === "" ? "" : `&${campaign.selection}`
  }`;

  return (
    <section className="mt-3">
      <CampaignHeader
        campaign={campaign}
        name={name}
        onName={setName}
        onRename={() => {
          if (name.trim() !== "" && name !== campaign.name) {
            void send("/api/campaigns", { id: campaign.id, name: name.trim() }, "PATCH");
          }
        }}
        onMailbox={(id) => void send("/api/campaigns", { id: campaign.id, mailboxId: id }, "PATCH")}
        mailboxes={mailboxes}
        busy={busy}
        actions={
          <>
            <ComposeAction campaignId={campaign.id} onDone={() => router.refresh()} />

            {/*
              **La porte de secours.** Elle ne dépend d'aucun état du
              formulaire d'étapes : elle part des étapes enregistrées et pose
              la même question au même service. Le jalon 81 a montré qu'un
              déclencheur porté par l'éditeur pouvait se dérober en silence ;
              celui-ci est toujours là, et il dit toujours ce qu'il fera.
            */}
            {sequence !== null && sequence.steps.length > 1 && (
              <ReopenAction
                sequenceId={sequence.id}
                steps={sequence.steps}
                onDone={() => router.refresh()}
                className={BUTTON}
              />
            )}

            {/*
              **Lancer n'est pas désarchiver.** La pause coupe l'envoi et laisse
              tout le monde où il en est ; l'archivage clôt la campagne. Deux
              gestes, deux portées, et le titre de chacun le dit.
            */}
            <button
              type="button"
              onClick={() =>
                void send("/api/campaigns/actions", {
                  action: "running",
                  campaignId: campaign.id,
                  running: !running,
                })
              }
              disabled={busy || campaign.archivedAt !== null}
              title={
                running
                  ? "Coupe l'envoi et l'écriture. Les inscrits restent où ils en sont, et relancer reprend là."
                  : "Remet la campagne en état d'écrire et d'envoyer. Rien ne part sans validation à la main."
              }
              className={BUTTON}
            >
              {running ? "Mettre en pause" : "Lancer"}
            </button>

            <button
              type="button"
              onClick={() =>
                void send("/api/campaigns/actions", {
                  action: "archive",
                  campaignId: campaign.id,
                  archived: campaign.archivedAt === null,
                })
              }
              disabled={busy}
              title={
                campaign.archivedAt === null
                  ? "Sort de la liste active et arrête les envois. L'histoire et les statistiques restent."
                  : "Remet la campagne dans la liste active. La séquence reste en pause tant qu'on ne la relance pas."
              }
              className={BUTTON}
            >
              {campaign.archivedAt === null ? "Archiver" : "Désarchiver"}
            </button>

            <CampaignDelete
              campaign={campaign}
              busy={busy}
              onBusy={setBusy}
              onChanged={adopt}
              onRefresh={() => router.push("/campagnes")}
              onError={setError}
            />
          </>
        }
      />

      {error !== null && <p className="mb-3 text-[12px] text-danger">{error}</p>}

      <div className="mb-4 rounded-card border border-line bg-surface p-4 shadow-card">
        <FunnelRow steps={funnel.steps} />
        <div className="mt-3">
          <div
            className="h-1.5 overflow-hidden rounded-full bg-line-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.ratio * 100)}
            aria-label={`Avancement de la séquence : ${progress.label}`}
          >
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.round(progress.ratio * 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[12px] text-muted">
            {progress.label} · {funnel.running} inscription
            {funnel.running > 1 ? "s" : ""} active{funnel.running > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="mb-4 rounded-control border border-line-2 px-3 py-2 text-[12.5px]">
        <span className="font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
          Sélection
        </span>{" "}
        {campaign.selection === "" ? (
          <span className="text-muted">aucune — personne n'est encore désigné.</span>
        ) : (
          <code className="break-all text-[12px]">{campaign.selection}</code>
        )}
        <div className="mt-1 flex flex-wrap gap-3">
          <Link href={contactsHref} className="text-brand-d hover:underline">
            Choisir les contacts sur /contacts, puis inscrire depuis là-bas
          </Link>
          {/*
            Les départs de cette campagne, dans la file du matin — filtrés sur
            elle plutôt que recopiés ici : la file est un écran de travail, avec
            ses trois décisions et sa retouche à la main, et en faire une seconde
            copie ferait deux endroits où valider un même brouillon.
          */}
          <Link
            href={`/departs?campagne=${encodeURIComponent(campaign.id)}`}
            className="text-brand-d hover:underline"
          >
            Voir ses départs du jour
          </Link>
        </div>
      </div>

      <div className="mb-4">
        {/*
          Le bloc porte son titre : la carte dépliable d'avant annonçait « Voir
          les N inscrits » sur son bouton, et ce bouton n'existe plus ici — une
          table sans en-tête laisse deviner ce qu'elle liste.
        */}
        <h2 className="mb-2 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
          Inscrits ({funnel.enrolled})
        </h2>
        <CampaignMembers members={members} onChanged={() => router.refresh()} />
      </div>

      {/*
        Les étapes : l'éditeur du jalon 38, monté tel quel. Mêmes règles — trois
        étapes au plus, mode automatique à double verrou —, même route.
      */}
      {sequence !== null && <EmailSequencesPanel initial={[sequence]} embedded />}
    </section>
  );
}
