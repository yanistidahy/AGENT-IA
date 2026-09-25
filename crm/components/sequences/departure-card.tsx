"use client";

import { formatDate } from "@/lib/format";
import { stepLabel } from "@/lib/domain/departure-groups";
import { ResearchNote } from "./research-note";
import type { Departure } from "./departures-view";

/**
 * **Un départ, dans sa propre carte.**
 *
 * La file se lisait comme un bloc de texte courant : nom, objet et corps
 * s'enchaînaient au même poids, et rien ne disait où un brouillon finissait et
 * où le suivant commençait. Trois séparations valent tout le reste ici :
 *
 * 1. **la carte est bornée** — bordure, ombre, fond propre, espace entre elles.
 *    Sans cela, l'œil ne sait pas combien d'objets il regarde ;
 * 2. **le message est un encadré à part**, avec son objet sur sa propre ligne :
 *    c'est ce qui part chez quelqu'un, il ne se mélange pas à la métadonnée ;
 * 3. **les actions vivent sous un filet**, groupées. Des boutons intercalés
 *    dans le texte font cliquer en lisant.
 *
 * La hiérarchie suit la question qu'on se pose dans cet ordre : **à qui**
 * (nom et société, en tête, en gros), **dans quel cadre** (étape, campagne,
 * canal, échéance — une ligne compacte), **quoi** (le message), **est-ce sûr**
 * (recherche, garde d'écho), **alors quoi** (les actions).
 *
 * Rien n'est retiré de ce que les jalons 73 à 87 ont posé : la carte de
 * recherche, l'avertissement d'écho, la retouche à la main et les trois
 * décisions sont là, **rangés** plutôt que mêlés.
 */

const BUTTON =
  "min-h-[44px] rounded-control px-3 text-[12px] font-semibold transition-colors disabled:opacity-50 lg:min-h-0 lg:py-1.5";

const FIELD =
  "w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[13px] focus:border-brand focus:outline-none";

/**
 * Le rappel de vérification, gradué.
 *
 * Au-delà de deux jours, l'avertissement change de ton : c'est la fenêtre du
 * week-end, celle où une réponse a pu arriver sans être vue (jalon 38).
 */
function StaleHint({ days, at }: { readonly days: number | null; readonly at: string | null }) {
  if (days === null) {
    return (
      <span className="font-semibold text-[#9A6410]">aucune interaction consignée</span>
    );
  }
  const label = days === 0 ? "aujourd'hui" : days === 1 ? "il y a 1 j" : `il y a ${days} j`;
  const loud = days >= 2;
  return (
    <span
      className={loud ? "font-semibold text-[#9A6410]" : undefined}
      title={at === null ? undefined : formatDate(new Date(at))}
    >
      dernière interaction {label}
      {loud && " — ouvrez votre boîte avant d'envoyer"}
    </span>
  );
}

export interface DepartureCardProps {
  readonly departure: Departure;
  readonly busy: string | null;
  readonly expanded: boolean;
  readonly onExpand: () => void;
  readonly editing: { readonly subject: string; readonly body: string } | null;
  readonly onEdit: () => void;
  readonly onEditChange: (change: { subject?: string; body?: string }) => void;
  readonly onEditCancel: () => void;
  readonly onEditSave: () => void;
  readonly onRework: () => void;
  readonly onDecide: (action: "send" | "postpone" | "remove") => void;
}

export function DepartureCard({
  departure,
  busy,
  expanded,
  onExpand,
  editing,
  onEdit,
  onEditChange,
  onEditCancel,
  onEditSave,
  onRework,
  onDecide,
}: DepartureCardProps) {
  const failed = departure.status === "failed";
  const working = busy === departure.id;
  const locked = busy !== null || failed;

  return (
    <article className="rounded-card border border-line bg-surface shadow-card">
      {/* 1 · À QUI — le seul bloc en gros caractères. */}
      <header className="border-b border-line-2 px-4 pt-3.5 pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="font-display text-[16px] leading-tight font-semibold text-ink">
            {departure.contactName}
            {departure.companyName !== "" && (
              <span className="ml-2 text-[13px] font-normal text-muted">
                {departure.companyName}
              </span>
            )}
          </h3>
          <span className="font-mono text-[11.5px] break-all text-muted">{departure.to}</span>
        </div>

        {/*
          2 · DANS QUEL CADRE — une seule ligne compacte, séparée du nom par le
          poids et la taille, jamais par une ligne vide de plus.
        */}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted">
          <span className="rounded-full bg-brand-l px-2 py-0.5 font-semibold text-brand-d">
            {stepLabel(departure.step, departure.stepsTotal)}
          </span>
          <span aria-hidden>·</span>
          <span>{departure.campaignName === "" ? departure.sequenceName : departure.campaignName}</span>
          <span aria-hidden>·</span>
          <span>email</span>
          <span aria-hidden>·</span>
          <StaleHint days={departure.lastActivityDays} at={departure.lastActivityAt} />
        </p>
      </header>

      {/* 3 · QUOI — le message, dans son propre encadré. */}
      <div className="px-4 py-3">
        {failed ? (
          <p className="rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
            Brouillon non composé : {departure.detail}
          </p>
        ) : editing !== null ? (
          /*
            La retouche à la main : deux champs et un bouton, sans un seul appel
            au modèle. « Annuler » remet le texte du serveur, resté intact tant
            qu'on n'a pas enregistré (jalon 68).
          */
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
                Objet
              </span>
              <input
                value={editing.subject}
                onChange={(event) => onEditChange({ subject: event.target.value })}
                className={FIELD}
              />
            </label>
            <label className="block">
              <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
                Message
              </span>
              <textarea
                value={editing.body}
                rows={14}
                onChange={(event) => onEditChange({ body: event.target.value })}
                className={`${FIELD} leading-relaxed`}
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={`${BUTTON} bg-brand text-white hover:bg-brand-d`}
                disabled={
                  busy !== null || editing.subject.trim() === "" || editing.body.trim() === ""
                }
                onClick={onEditSave}
              >
                {working ? "…" : "Enregistrer"}
              </button>
              <button
                type="button"
                className={`${BUTTON} border border-line hover:bg-surface-2`}
                disabled={busy !== null}
                onClick={onEditCancel}
              >
                Annuler
              </button>
              <span className="text-[11.5px] text-muted">
                Enregistré tel quel, sans passer par Alex.
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-control border border-line-2 bg-surface-2">
            <p className="border-b border-line-2 px-3 py-2 text-[13px] font-semibold text-ink">
              <span className="mr-2 font-mono text-[10px] font-normal tracking-[0.1em] text-muted uppercase">
                Objet
              </span>
              {departure.subject}
            </p>
            <div className="px-3 py-2.5">
              {/*
                `whitespace-pre-line` plutôt que `pre-wrap` : les paragraphes du
                brouillon sont séparés par des lignes vides, et c'est cette
                respiration qu'on veut voir — un corps rendu d'un bloc est
                illisible même quand il est correct.
              */}
              <p
                className={`whitespace-pre-line text-[12.5px] leading-relaxed text-ink-2 ${
                  expanded ? "" : "line-clamp-4"
                }`}
              >
                {departure.body}
              </p>
              <button
                type="button"
                className="mt-1.5 text-[11.5px] font-semibold text-brand underline"
                onClick={onExpand}
              >
                {expanded ? "Replier" : "Lire en entier"}
              </button>
            </div>
          </div>
        )}

        {/*
          4 · EST-CE SÛR — ce qu'Alex avait sous la main, ce qu'il a lu, et la
          garde d'écho. Sous le message parce que ces trois-là le jugent.
        */}
        {!failed && editing === null && (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
            <span>Données de démonstration : {departure.demoSource}</span>
            <ResearchNote research={departure.research} ungrounded={departure.ungrounded} />
            {departure.echo !== "" && (
              <span className="rounded-control border border-danger bg-pulse-l px-2 py-1 text-danger">
                {departure.echo}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 5 · ALORS QUOI — sous un filet, jamais dans le texte. */}
      <footer className="flex flex-wrap items-center gap-2 border-t border-line-2 bg-surface-2/60 px-4 py-3">
        <button
          type="button"
          className={`${BUTTON} bg-brand text-white hover:bg-brand-d`}
          disabled={locked}
          onClick={() => onDecide("send")}
        >
          {working ? "…" : "Envoyer"}
        </button>
        {/*
          **Corriger soi-même passe avant demander de l'aide**, et c'est l'ordre
          des boutons qui le dit : une virgule manquante ne vaut pas un appel au
          modèle (jalon 68).
        */}
        <button
          type="button"
          className={`${BUTTON} border border-line bg-surface hover:bg-surface-2`}
          disabled={locked}
          onClick={onEdit}
        >
          Modifier
        </button>
        <button
          type="button"
          className={`${BUTTON} border border-brand bg-surface text-brand-d hover:bg-brand-l`}
          disabled={locked}
          onClick={onRework}
        >
          Retravailler avec Alex
        </button>
        <span className="flex-1" />
        <button
          type="button"
          className={`${BUTTON} border border-line bg-surface hover:bg-surface-2`}
          disabled={busy !== null}
          onClick={() => onDecide("postpone")}
        >
          Reporter à demain
        </button>
        <button
          type="button"
          className={`${BUTTON} border border-[#F0C9C2] bg-surface text-[#B2311F] hover:bg-pulse-l`}
          disabled={busy !== null}
          onClick={() => onDecide("remove")}
        >
          Retirer
        </button>
      </footer>
    </article>
  );
}
