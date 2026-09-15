import Link from "next/link";
import type { CampaignView } from "@/lib/api/campaigns";
import {
  STATUS_LABELS,
  campaignStatus,
  draftReason,
  sequenceProgress,
  type CampaignStatus,
} from "@/lib/domain/campaign-status";

/**
 * Une campagne, vue de la grille.
 *
 * **Elle ne porte que ce qui sert à en choisir une** : son nom, d'où elle part
 * et qui la signe, son état, trois nombres et son avancement. Les étapes, les
 * inscrits, l'entonnoir et les départs vivent dans sa page — les empiler ici
 * donnait un écran où l'on faisait défiler beaucoup pour voir peu, et où la
 * seule question qu'on se pose vraiment en arrivant (« laquelle ? ») demandait
 * de lire tout le reste d'abord.
 *
 * C'est un composant **serveur** : une vignette n'a aucun état, et tout ce
 * qu'elle affiche est déjà rendu par la page. Un composant client ici enverrait
 * du JavaScript pour dessiner un lien.
 */

const TONES: Readonly<Record<CampaignStatus, string>> = {
  // `win` porte la réussite, `brand` l'action, et le gris ce qui est rangé —
  // la règle de la palette, pas trois couleurs choisies au cas par cas.
  running: "border-win bg-win-l text-win-d",
  draft: "border-line bg-surface-2 text-muted",
  archived: "border-line bg-surface-2 text-closed",
};

function Figure({ value, label }: { readonly value: number; readonly label: string }) {
  return (
    <div>
      <div className="font-display text-lg font-semibold tabular-nums leading-none">{value}</div>
      <div className="mt-0.5 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
        {label}
      </div>
    </div>
  );
}

export function CampaignTile({ campaign }: { readonly campaign: CampaignView }) {
  const status = campaignStatus({
    archived: campaign.archivedAt !== null,
    hasBrief: campaign.hasBrief,
    enrolled: campaign.funnel.enrolled,
  });
  const progress = sequenceProgress({
    enrolled: campaign.funnel.enrolled,
    steps: campaign.steps,
    delivered: campaign.delivered,
  });
  const reason =
    status === "draft"
      ? draftReason({ hasBrief: campaign.hasBrief, enrolled: campaign.funnel.enrolled })
      : null;

  return (
    <Link
      href={`/campagnes/${campaign.id}`}
      className="flex min-h-[44px] flex-col rounded-card border border-line bg-surface p-3.5 shadow-card transition-colors hover:border-brand focus:border-brand focus:outline-none"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-[15px] font-semibold leading-tight">{campaign.name}</h2>
        <span
          className={`shrink-0 rounded-control border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.08em] uppercase ${TONES[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      {/*
        Une ligne, pas deux : la boîte décide de la signature depuis le jalon 54,
        et les séparer laisserait croire qu'on peut les choisir l'une sans
        l'autre. Le nom manquant est **nommé** plutôt qu'escamoté — une campagne
        sans signataire part sans signature, et cela ne se découvre pas chez le
        destinataire.
      */}
      <p className="mt-1 truncate text-[12px] text-muted">
        {campaign.mailboxLabel} ·{" "}
        {campaign.signName.trim() === "" ? (
          // `gold` plein ne passe pas le seuil sur du blanc : c'est la teinte
          // sombre déjà utilisée pour les avertissements ambre du produit.
          <span className="text-[#9A6410]">signataire non renseigné</span>
        ) : (
          campaign.signName
        )}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Figure value={campaign.funnel.enrolled} label="inscrits" />
        <Figure value={campaign.funnel.messages} label="envoyés" />
        <Figure value={campaign.funnel.replied} label="réponses" />
      </div>

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
        <p className="mt-1 text-[11.5px] text-muted">{reason ?? progress.label}</p>
      </div>
    </Link>
  );
}
