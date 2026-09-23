"use client";

import { useState } from "react";
import { ResearchNote } from "./research-note";
import type { ResearchCard } from "@/lib/domain/research";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/client/http";
import { formatDate } from "@/lib/format";
import { ComposePanel } from "@/components/emails/compose-panel";

/**
 * « Départs du jour » — la file du matin.
 *
 * **Un geste par ligne, trois choix, rien d'autre.** Une file qui demande de
 * réfléchir deux fois par ligne est contournée dès la deuxième semaine, et
 * c'est alors le mode automatique qu'on activerait trop tôt — exactement ce que
 * son double verrou cherche à empêcher.
 *
 * **L'ancienneté de la dernière interaction est sur chaque ligne**, et c'est le
 * garde-fou de la détection manuelle des réponses. « il y a 2 j » invite à
 * ouvrir sa boîte avant de cliquer ; sans elle, la file du lundi ressemble à
 * celle du mardi alors que deux jours de réponses possibles la séparent de la
 * dernière vérification.
 */

export interface Departure {
  id: string;
  step: number;
  status: string;
  subject: string;
  body: string;
  detail: string;
  sequenceName: string;
  contactId: string;
  contactName: string;
  to: string;
  lastActivityDays: number | null;
  lastActivityAt: string | null;
  /** Ce qu'Alex avait pour nommer la boutique. Voir `describeDemoSource`. */
  demoSource: string;
  /** Ce qu'Alex a lu sur la maison de ce contact. Voir `ResearchNote`. */
  research: ResearchCard;
  /** Une affirmation produit qu'aucune page lue ne soutient. */
  ungrounded: string | null;
  /** La relance répète le message précédent — vide quand elle ne le fait pas. */
  echo: string;
  campaignName: string;
  /** Sa campagne est en pause : rien ne partira tant qu'elle l'est. */
  campaignPaused: boolean;
}

function isPayload(value: unknown): value is { departures: Departure[]; message?: string } {
  return typeof value === "object" && value !== null && "departures" in value;
}

/**
 * Le rappel de vérification, gradué.
 *
 * Au-delà de deux jours, l'avertissement change de ton : c'est la fenêtre du
 * week-end, celle où une réponse a pu arriver sans être vue.
 */
function StaleHint({ days, at }: { readonly days: number | null; readonly at: string | null }) {
  if (days === null) {
    return (
      <span className="text-[11.5px] font-semibold text-[#9A6410]">
        aucune interaction consignée
      </span>
    );
  }
  const label = days === 0 ? "aujourd'hui" : days === 1 ? "il y a 1 j" : `il y a ${days} j`;
  const loud = days >= 2;
  return (
    <span
      className={loud ? "text-[11.5px] font-semibold text-[#9A6410]" : "text-[11.5px] text-muted"}
      title={at === null ? undefined : formatDate(new Date(at))}
    >
      dernière interaction {label}
      {loud && " — ouvrez votre boîte avant d'envoyer"}
    </span>
  );
}

const BUTTON =
  "rounded-control px-3 py-1 text-[12px] font-semibold transition-colors disabled:opacity-50";

const FIELD =
  "w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[13px] focus:border-brand focus:outline-none";

export function DeparturesView({ initial }: { readonly initial: readonly Departure[] }) {
  const [departures, setDepartures] = useState<readonly Departure[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  /** Le départ ouvert dans le panneau de rédaction, le cas échéant. */
  const [reworking, setReworking] = useState<Departure | null>(null);
  /**
   * Le départ en cours de retouche **à la main**, et son texte.
   *
   * Corriger une virgule ne doit pas coûter un appel au modèle : c'est plus
   * lent, c'est facturé, et surtout la réponse peut réécrire autre chose que ce
   * qu'on voulait changer. Le fil avec Alex reste là, pour quand on veut son
   * aide ; il cesse d'être le seul chemin.
   */
  const [editing, setEditing] = useState<{ id: string; subject: string; body: string } | null>(null);
  const router = useRouter();

  const decide = async (id: string, action: "send" | "postpone" | "remove") => {
    setBusy(id);
    setError(null);
    setNotice(null);
    const result = await requestJson(
      "/api/departures",
      { method: "POST", body: JSON.stringify({ id, action }) },
      isPayload,
    );
    setBusy(null);
    if (result.ok) {
      setDepartures(result.data.departures);
      setNotice(result.data.message ?? null);
    } else setError(result.message);
  };

  /** Enregistre la retouche manuelle. **Aucun appel au modèle sur ce chemin.** */
  const save = async () => {
    if (editing === null) return;
    setBusy(editing.id);
    setError(null);
    setNotice(null);
    const result = await requestJson(
      "/api/departures",
      {
        method: "PATCH",
        body: JSON.stringify({
          id: editing.id,
          subject: editing.subject.trim(),
          body: editing.body.trim(),
        }),
      },
      isPayload,
    );
    setBusy(null);
    if (result.ok) {
      setDepartures(result.data.departures);
      setEditing(null);
      setNotice("Brouillon enregistré.");
    } else setError(result.message);
  };

  return (
    <div className="px-6 py-6">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Départs du jour</h1>
        <p className="mt-0.5 max-w-[70ch] text-[13px] text-muted">
          Composés ce matin, à partir de l'état de ce matin — jamais la veille au soir. Rien
          n'est composé ni envoyé le samedi ou le dimanche.
        </p>
      </header>

      {error !== null && (
        <p className="mb-3 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}
      {notice !== null && (
        <p className="mb-3 rounded-control border border-[#BEE3DA] bg-win-l px-3 py-2 text-[12.5px] text-win-d">
          {notice}
        </p>
      )}

      {departures.length === 0 ? (
        <p className="rounded-card border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">
          Aucun départ à valider. Soit aucune étape n'est due aujourd'hui, soit le passage
          quotidien n'a pas encore eu lieu — l'accueil le signale s'il manque.
        </p>
      ) : (
        <ul className="space-y-3">
          {departures.map((departure) => (
            <li
              key={departure.id}
              className="rounded-card border border-line bg-surface p-4 shadow-card"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-display text-[15px] font-semibold">
                  {departure.contactName}
                </span>
                <span className="font-mono text-[12px] break-all text-muted">{departure.to}</span>
                <span className="rounded-full bg-brand-l px-2 py-0.5 text-[11.5px] font-semibold text-brand-d">
                  {departure.sequenceName} · étape {departure.step}
                </span>
                <StaleHint days={departure.lastActivityDays} at={departure.lastActivityAt} />
              </div>

              {departure.status === "failed" ? (
                <p className="mt-2 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
                  Brouillon non composé : {departure.detail}
                </p>
              ) : editing?.id === departure.id ? (
                /*
                  La retouche à la main : deux champs et un bouton, sans un seul
                  appel au modèle. « Annuler » remet le texte du serveur, qui
                  est resté intact tant qu'on n'a pas enregistré.
                */
                <div className="mt-2 space-y-2">
                  <label className="block">
                    <span className="mb-1 block font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
                      Objet
                    </span>
                    <input
                      value={editing.subject}
                      onChange={(event) =>
                        setEditing({ ...editing, subject: event.target.value })
                      }
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
                      onChange={(event) => setEditing({ ...editing, body: event.target.value })}
                      className={`${FIELD} leading-relaxed`}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`${BUTTON} bg-brand text-white hover:bg-brand-d`}
                      disabled={
                        busy !== null ||
                        editing.subject.trim() === "" ||
                        editing.body.trim() === ""
                      }
                      onClick={() => void save()}
                    >
                      {busy === departure.id ? "…" : "Enregistrer"}
                    </button>
                    <button
                      type="button"
                      className={`${BUTTON} border border-line hover:bg-surface-2`}
                      disabled={busy !== null}
                      onClick={() => setEditing(null)}
                    >
                      Annuler
                    </button>
                    <span className="self-center text-[11.5px] text-muted">
                      Enregistré tel quel, sans passer par Alex.
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-[13px] font-medium">{departure.subject}</p>
                  <p
                    className={
                      open === departure.id
                        ? "mt-1 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink-2"
                        : "mt-1 line-clamp-3 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted"
                    }
                  >
                    {departure.body}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button
                      type="button"
                      className="text-[11.5px] font-semibold text-brand underline"
                      onClick={() => setOpen(open === departure.id ? null : departure.id)}
                    >
                      {open === departure.id ? "Replier" : "Lire en entier"}
                    </button>
                    {/*
                      Ce qu'Alex avait pour nommer la boutique. Une phrase
                      générique cesse d'être ambiguë : ou bien la fiche ne porte
                      rien, ou bien le modèle n'a pas utilisé ce qu'on lui a
                      donné, et ce ne sont pas les mêmes gestes.
                    */}
                    <span className="text-[11.5px] text-muted">
                      Données de démonstration : {departure.demoSource}
                    </span>
                    {/*
                      Ce qu'Alex a lu, et ce qu'il n'a pas pu lire. C'est la
                      seule façon de repérer une affirmation fausse **avant**
                      l'envoi plutôt qu'après.
                    */}
                    <ResearchNote
                      research={departure.research}
                      ungrounded={departure.ungrounded}
                    />
                    {/*
                      **La garde d'écho.** Une relance qui refait le premier
                      message ne se voit pas à la relecture : on relit le
                      brouillon du jour, pas celui d'il y a quatre jours. Elle
                      est donc nommée ici, avec la suite de mots reprise, pour
                      qu'on puisse la corriger avant d'envoyer.
                    */}
                    {departure.echo !== "" && (
                      <span className="rounded-control border border-danger bg-pulse-l px-2 py-1 text-[11.5px] text-danger">
                        {departure.echo}
                      </span>
                    )}
                  </div>
                </>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`${BUTTON} bg-brand text-white hover:bg-brand-d`}
                  disabled={busy !== null || departure.status === "failed"}
                  onClick={() => void decide(departure.id, "send")}
                >
                  {busy === departure.id ? "…" : "Envoyer"}
                </button>
                {/*
                  **Retravailler avec Alex, depuis la file.** Le même panneau
                  que la fiche contact — même fil, même reprise depuis le texte
                  affiché, même retour en arrière — parce que c'est le même
                  composant. Deux surfaces de rédaction auraient fini par ne
                  plus se ressembler.
                */}
                {/*
                  **Corriger soi-même passe avant demander de l'aide**, et c'est
                  l'ordre des boutons qui le dit : une virgule manquante ne vaut
                  pas un appel au modèle.
                */}
                <button
                  type="button"
                  className={`${BUTTON} border border-line hover:bg-surface-2`}
                  disabled={busy !== null || departure.status === "failed"}
                  onClick={() =>
                    setEditing({
                      id: departure.id,
                      subject: departure.subject,
                      body: departure.body,
                    })
                  }
                >
                  Modifier
                </button>
                <button
                  type="button"
                  className={`${BUTTON} border border-brand text-brand-d hover:bg-brand-l`}
                  disabled={busy !== null || departure.status === "failed"}
                  onClick={() => setReworking(departure)}
                >
                  Retravailler avec Alex
                </button>
                <button
                  type="button"
                  className={`${BUTTON} border border-line hover:bg-surface-2`}
                  disabled={busy !== null}
                  onClick={() => void decide(departure.id, "postpone")}
                >
                  Reporter à demain
                </button>
                <button
                  type="button"
                  className={`${BUTTON} border border-[#F0C9C2] text-[#B2311F] hover:bg-pulse-l`}
                  disabled={busy !== null}
                  onClick={() => void decide(departure.id, "remove")}
                >
                  Retirer de la séquence
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ComposePanel
        open={reworking !== null}
        contactId={reworking?.contactId ?? null}
        departureId={reworking?.id}
        onClose={() => setReworking(null)}
        onSent={() => setReworking(null)}
        onSaved={() => {
          // La file est rendue par le serveur : c'est lui qui redit le texte
          // enregistré, plutôt que le navigateur qui le devine.
          setReworking(null);
          router.refresh();
        }}
      />
    </div>
  );
}
