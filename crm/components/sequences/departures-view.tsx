"use client";

import { useState } from "react";
import type { ResearchCard } from "@/lib/domain/research";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/client/http";
import { ComposePanel } from "@/components/emails/compose-panel";
import { describeGroup, groupDepartures } from "@/lib/domain/departure-groups";
import { DepartureCard } from "./departure-card";
import { DeparturesClear } from "./departures-clear";

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
  /** La fiche **est** une fiche de démonstration. Voir `isDemoContact`. */
  demoData: boolean;
  /** Ce qu'Alex a lu sur la maison de ce contact. Voir `ResearchNote`. */
  research: ResearchCard;
  /** Une affirmation produit qu'aucune page lue ne soutient. */
  ungrounded: string | null;
  /** La relance répète le message précédent — vide quand elle ne le fait pas. */
  echo: string;
  companyName: string;
  campaignName: string;
  /** Le nombre d'étapes de sa séquence, pour dire « étape 2 sur 3 ». */
  stepsTotal: number;
  /** Sa campagne est en pause : rien ne partira tant qu'elle l'est. */
  campaignPaused: boolean;
  /** La boîte d'envoi de sa campagne, vide avant le jalon 54. */
  mailboxId: string;
  /** Sa boîte a atteint son plafond du jour : ce départ est reporté. */
  carried: boolean;
  /**
   * Les phrases que le rendu a retirées pour ce contact, avec leur raison.
   *
   * Recalculées à la lecture depuis le gabarit de l'étape : le corps composé ne
   * les porte plus, et c'est précisément pourquoi il faut le dire ici.
   */
  dropped: { tag: string; label: string; sentence: string }[];
  /**
   * Pourquoi ce départ est vide — vide quand il a de quoi partir.
   *
   * Rendu par la fonction que l'envoi appelle : la carte annonce donc le refus
   * que « Envoyer » rendrait, pas une seconde appréciation.
   */
  empty: string;
  /** Composé avant la dernière modification de la séquence. */
  stale: boolean;
  /** Retouché à la main : la resynchronisation le conserve (jalon 97). */
  edited: boolean;
}

function isPayload(value: unknown): value is {
  departures: Departure[];
  message?: string;
  /** Présent depuis le jalon 91 : un échec rend la file **et** son refus. */
  ok?: boolean;
} {
  return typeof value === "object" && value !== null && "departures" in value;
}

export function DeparturesView({
  initial,
  campaignId,
}: {
  readonly initial: readonly Departure[];
  /**
   * La portée de l'écran, reprise telle quelle par « Vider les départs ».
   *
   * Le compte annoncé dans la confirmation est donc exactement celui des lignes
   * qu'on a sous les yeux : vider une file filtrée en emportant celle des autres
   * campagnes serait la pire des surprises.
   */
  readonly campaignId?: string;
}) {
  const [departures, setDepartures] = useState<readonly Departure[]>(initial);
  /** La confirmation de vidage est ouverte : on n'efface jamais au premier clic. */
  const [clearing, setClearing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * Le verdict du dernier geste, **rattaché à sa carte**.
   *
   * Un seul à la fois : deux refus affichés ensemble sur deux cartes
   * éloignées feraient relire l'écran entier pour savoir lequel vient du clic
   * qu'on a fait.
   */
  const [outcome, setOutcome] = useState<{ id: string; ok: boolean; message: string } | null>(null);
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

  const decide = async (id: string, action: "send" | "postpone" | "remove" | "rewrite" | "drop") => {
    setBusy(id);
    setError(null);
    setNotice(null);
    setOutcome(null);
    const result = await requestJson(
      "/api/departures",
      // La portée voyage avec la décision : sans elle, la réponse rendrait
      // toute la file, et l'écran cesserait de décrire son propre bandeau.
      { method: "POST", body: JSON.stringify({ id, action, campaignId }) },
      isPayload,
    );
    setBusy(null);

    /*
      **Le refus s'affiche sur la carte, pas en tête de page.**

      C'était la cause du défaut signalé : le message partait dans un bandeau
      rendu au-dessus des groupes, et la page des départs fait plusieurs écrans
      de haut depuis le jalon 88. Cliquer « Envoyer » sur une carte du bas
      écrivait donc la cause hors du champ de vision — « rien ne se passe », la
      carte reste, et l'échec ressemble à un bouton mort.

      La carte qu'on vient de cliquer est le seul endroit dont on est certain
      qu'il est sous les yeux.
    */
    if (!result.ok) {
      // Panne de transport (réseau, 500) : la file n'a pas été rendue.
      setOutcome({ id, ok: false, message: result.message });
      return;
    }

    setDepartures(result.data.departures);
    if (result.data.ok === false) {
      /*
        **Si la carte a quitté la file, le verdict remonte en tête de page.**

        Un refus définitif — étape déjà envoyée, fiche close, opposition — écarte
        le départ : la carte disparaît, et un verdict qui lui serait rattaché
        disparaîtrait avec elle. Trouvé à la recette, pas à la lecture : l'écran
        redevenait muet exactement dans les cas les plus graves.
      */
      const stillListed = result.data.departures.some((row) => row.id === id);
      if (stillListed) setOutcome({ id, ok: false, message: result.data.message ?? "Envoi refusé." });
      else setError(`Rien n'est parti. ${result.data.message ?? "Envoi refusé."}`);
      return;
    }
    setNotice(result.data.message ?? null);
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

  /**
   * Vide la file en attente, dans la portée de l'écran.
   *
   * **Ne touche ni aux envois, ni aux fiches** : la route ne supprime que des
   * lignes de départ jamais parties (`clearDepartures`). Ce qui est envoyé est
   * un fait, et /emails continue de le compter.
   */
  const clear = async () => {
    setClearing(false);
    setBusy("clear");
    setError(null);
    setNotice(null);
    const result = await requestJson(
      "/api/departures/clear",
      { method: "POST", body: JSON.stringify(campaignId === undefined ? {} : { campaignId }) },
      (value): value is { departures: Departure[]; cleared: number } =>
        typeof value === "object" && value !== null && "departures" in value && "cleared" in value,
    );
    setBusy(null);
    if (result.ok) {
      setDepartures(result.data.departures);
      setNotice(
        result.data.cleared === 0
          ? "Aucun départ à vider."
          : `${result.data.cleared} départ${result.data.cleared > 1 ? "s" : ""} retiré${
              result.data.cleared > 1 ? "s" : ""
            } de la file. Les envois passés et les fiches n'ont pas bougé.`,
      );
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

        <DeparturesClear
          count={departures.length}
          scoped={campaignId !== undefined}
          open={clearing}
          busy={busy !== null}
          onOpen={() => setClearing(true)}
          onCancel={() => setClearing(false)}
          onConfirm={() => void clear()}
        />
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
        /*
          **Groupé par campagne, avec un en-tête qui tient au défilement.**
          Sans lui, savoir ce qu'on relit demande de relire la métadonnée de
          chaque carte (voir `lib/domain/departure-groups.ts`).
        */
        <div className="space-y-6">
          {groupDepartures(departures).map((group) => (
            <section key={group.key}>
              <h2 className="sticky top-0 z-10 -mx-6 mb-2.5 flex flex-wrap items-baseline gap-x-2 border-b border-line bg-paper px-6 py-2">
                <span className="font-display text-[14px] font-semibold text-ink">
                  {group.title}
                </span>
                <span className="text-[11.5px] text-muted">{describeGroup(group.rows)}</span>
              </h2>
              <ul className="space-y-3">
                {group.rows.map((departure) => (
                  <li key={departure.id}>
                    <DepartureCard
                      departure={departure}
                      busy={busy}
                      expanded={open === departure.id}
                      onExpand={() => setOpen(open === departure.id ? null : departure.id)}
                      editing={editing?.id === departure.id ? editing : null}
                      onEdit={() =>
                        setEditing({
                          id: departure.id,
                          subject: departure.subject,
                          body: departure.body,
                        })
                      }
                      onEditChange={(change) =>
                        setEditing((current) =>
                          current === null ? current : { ...current, ...change },
                        )
                      }
                      onEditCancel={() => setEditing(null)}
                      onEditSave={() => void save()}
                      onRework={() => setReworking(departure)}
                      onDecide={(action) => void decide(departure.id, action)}
                      feedback={outcome?.id === departure.id ? outcome : null}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
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
