"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { requestJson } from "@/lib/client/http";
import type { EnrollSelectionOutcome } from "@/lib/api/campaigns";
import { describeAddOutcome, type AddOutcome } from "@/lib/domain/contact-lists";
import {
  clearSelection,
  readSelection,
  writeSelection,
  type SelectionScope,
} from "@/lib/client/selection";

/**
 * La barre de sélection de /contacts — **une seule barre, trois destinations**.
 *
 * **Elle est collée en haut de l'écran** (`sticky`) : le compteur et les boutons
 * doivent rester atteignables pendant qu'on parcourt cent cinquante lignes. Une
 * barre qui défile hors du champ obligerait à remonter pour confirmer, et on
 * finirait par cocher sans jamais valider.
 *
 * La sélection vit dans `sessionStorage`, pas dans l'URL ni dans l'état React :
 * filtrer est une navigation, et une sélection perdue au changement de filtre
 * rendrait tout l'écran inutilisable — voir `lib/client/selection.ts`.
 *
 * ### Pourquoi une seule barre plutôt qu'une par destination
 *
 * Le geste est le même — cocher des fiches au fil des filtres — et seule la
 * phrase finale change : les inscrire à une campagne, les ranger dans une liste,
 * ou les retirer de celle qu'on regarde. Deux barres auraient dupliqué le
 * compteur, le « Vider » et la promesse de survie au filtre, et c'est toujours
 * la seconde qu'on oublie de corriger (jalons 55, 64 et 66).
 */

function isOutcome(value: unknown): value is { outcome: EnrollSelectionOutcome } {
  return typeof value === "object" && value !== null && "outcome" in value;
}

function isAddOutcome(value: unknown): value is { outcome: AddOutcome } {
  return typeof value === "object" && value !== null && "outcome" in value;
}

function isRemoved(value: unknown): value is { removed: number } {
  return typeof value === "object" && value !== null && "removed" in value;
}

/** La sélection à mémoriser : l'URL courante, moins ce qui n'en fait pas partie. */
function selectionOf(params: URLSearchParams): string {
  const kept = new URLSearchParams(params);
  // `campagne` désigne la campagne, pas les contacts ; `fiche` est le tiroir
  // ouvert — ni l'un ni l'autre ne décrit le public.
  kept.delete("campagne");
  kept.delete("fiche");
  return kept.toString();
}

export interface ListOption {
  readonly id: string;
  readonly name: string;
}

const ACTION =
  "min-h-[44px] rounded-control bg-brand px-3 text-[12.5px] font-medium text-white hover:bg-brand-d disabled:opacity-50 lg:min-h-0 lg:py-1";
const SECONDARY =
  "min-h-[44px] rounded-control border border-line bg-surface px-3 text-[12.5px] lg:min-h-0 lg:py-1";

export function SelectionBar({
  params,
  shown,
  selected,
  onCleared,
  campaign,
  lists,
  listScope,
  onChanged,
}: {
  readonly params: URLSearchParams;
  readonly shown: number;
  /** Les identifiants cochés, tenus par la vue — la barre ne fait que les lire. */
  readonly selected: ReadonlySet<string>;
  readonly onCleared: () => void;
  /** La campagne dont on choisit le public, quand on arrive par /campagnes. */
  readonly campaign: { readonly id: string; readonly name: string } | null;
  /** Les listes existantes, pour y ranger la sélection. */
  readonly lists: readonly ListOption[];
  /** La liste qu'on est en train de regarder, quand on vient de /listes. */
  readonly listScope: { readonly id: string; readonly name: string } | null;
  /** Rejoue la page : c'est le serveur qui redit ce qui reste, pas le navigateur. */
  readonly onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"enroll" | "remove" | null>(null);
  const [adding, setAdding] = useState(false);
  const [newList, setNewList] = useState("");

  const scope = selected.size;
  const plural = scope > 1 ? "s" : "";

  const reset = () => {
    setError(null);
    setMessage(null);
  };

  /*
    **Inscrire n'écrit aucun brouillon**, depuis le jalon 70 : c'était le geste
    qui coûtait de l'argent sans le dire dans son intitulé. L'écriture vit sur la
    page de la campagne, sous « Écrire les mails », avec son estimation de coût.
  */
  const enroll = async () => {
    if (campaign === null) return;
    setBusy(true);
    reset();
    const result = await requestJson(
      "/api/campaigns",
      {
        method: "PUT",
        body: JSON.stringify({
          campaignId: campaign.id,
          selection: selectionOf(params),
          // **Les fiches cochées font foi quand il y en a.** Le filtre n'est
          // alors qu'un souvenir de la façon dont on les a trouvées.
          contactIds: [...selected],
        }),
      },
      isOutcome,
    );
    setBusy(false);
    setConfirming(null);
    if (result.ok) {
      const outcome = result.data.outcome;
      setMessage(
        `${outcome.enrolled} inscrite${outcome.enrolled > 1 ? "s" : ""}` +
          (outcome.already > 0 ? ` · ${outcome.already} déjà inscrite${outcome.already > 1 ? "s" : ""}` : "") +
          (outcome.refused > 0
            ? ` · ${outcome.refused} refusée${outcome.refused > 1 ? "s" : ""} (${outcome.refusedReasons.join(" ; ")})`
            : ""),
      );
      clearScope();
    } else {
      setError(result.message);
    }
  };

  const clearScope = () => {
    onCleared();
  };

  /** Ranger la sélection dans une liste existante, ou dans une liste à créer. */
  const addTo = async (listId: string) => {
    setBusy(true);
    reset();
    const result = await requestJson(
      "/api/lists",
      {
        method: "PUT",
        body: JSON.stringify({
          listId,
          selection: selectionOf(params),
          contactIds: [...selected],
        }),
      },
      isAddOutcome,
    );
    setBusy(false);
    setAdding(false);
    if (result.ok) {
      setMessage(describeAddOutcome(result.data.outcome));
      clearScope();
      onChanged();
    } else {
      setError(result.message);
    }
  };

  const createAndAdd = async () => {
    setBusy(true);
    reset();
    const created = await requestJson(
      "/api/lists",
      { method: "POST", body: JSON.stringify({ name: newList }) },
      (value): value is { id: string } =>
        typeof value === "object" && value !== null && "id" in value,
    );
    if (!created.ok) {
      setBusy(false);
      setError(created.message);
      return;
    }
    setNewList("");
    setBusy(false);
    await addTo(created.data.id);
  };

  /**
   * Retirer de la liste **sans toucher aux fiches**, et la confirmation le dit :
   * c'est la question qu'on se pose la première fois qu'on clique.
   */
  const removeFromList = async () => {
    if (listScope === null) return;
    setBusy(true);
    reset();
    const result = await requestJson(
      "/api/lists",
      {
        method: "DELETE",
        body: JSON.stringify({ listId: listScope.id, contactIds: [...selected] }),
      },
      isRemoved,
    );
    setBusy(false);
    setConfirming(null);
    if (result.ok) {
      setMessage(
        `${result.data.removed} fiche${result.data.removed > 1 ? "s" : ""} retirée${result.data.removed > 1 ? "s" : ""} de la liste. Aucune fiche n'a été modifiée.`,
      );
      clearScope();
      onChanged();
    } else {
      setError(result.message);
    }
  };

  /*
    **La barre reste tant qu'elle a quelque chose à dire.** Trouvé au navigateur,
    pas à la lecture : vider la sélection après un ajout faisait disparaître la
    barre — donc le « 8 ajoutées · 2 déjà dans la liste » avec elle, au moment
    précis où l'on veut le lire. Elle décide donc elle-même de son affichage,
    plutôt que de le laisser à une condition de la vue.
  */
  if (scope === 0 && campaign === null && message === null && error === null) return null;

  return (
    <div className="sticky top-0 z-20 mb-2 rounded-card border border-brand-lift bg-brand-l px-3 py-2 text-[12.5px] shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        {campaign !== null && (
          <span>
            Sélection pour <strong className="font-semibold">{campaign.name}</strong>
          </span>
        )}
        <strong className="font-mono tabular-nums">
          {scope} sélectionné{plural}
        </strong>
        <span className="text-muted">
          · {shown} affichée{shown > 1 ? "s" : ""}
        </span>

        <span className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              reset();
              setAdding((open) => !open);
            }}
            disabled={busy || scope === 0}
            className={ACTION}
          >
            Ajouter à une liste
          </button>

          {campaign !== null && (
            <button
              type="button"
              onClick={() => {
                reset();
                setConfirming("enroll");
              }}
              disabled={busy || scope === 0}
              className={ACTION}
            >
              {busy ? "Un instant…" : `Inscrire ${scope} contact${plural}`}
            </button>
          )}

          {listScope !== null && (
            <button
              type="button"
              onClick={() => {
                reset();
                setConfirming("remove");
              }}
              disabled={busy || scope === 0}
              className={SECONDARY}
            >
              Retirer de la liste
            </button>
          )}

          {scope > 0 && (
            <button
              type="button"
              onClick={clearScope}
              className="min-h-[44px] text-[12.5px] text-brand-d hover:underline lg:min-h-0"
            >
              Vider
            </button>
          )}
          {campaign !== null && (
            <Link href="/campagnes" className="min-h-[44px] text-brand-d hover:underline lg:min-h-0">
              Retour
            </Link>
          )}
        </span>
      </div>

      <p className="mt-1 text-[12px] text-brand-d">
        La sélection suit les changements de filtre : cochez ici, filtrez autrement, cochez
        encore — tout est conservé jusqu&apos;à ce que vous en fassiez quelque chose.
      </p>

      {adding && (
        <div className="mt-1.5 rounded-control border border-brand bg-surface px-3 py-2">
          <p className="mb-1.5">
            Ranger <strong className="font-semibold">{scope} fiche{plural}</strong> dans une
            liste. Une liste ne change jamais toute seule : elle ne contiendra que ce que vous y
            mettez.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {lists.map((list) => (
              <button
                key={list.id}
                type="button"
                disabled={busy}
                onClick={() => void addTo(list.id)}
                className={SECONDARY}
              >
                {list.name}
              </button>
            ))}
            {lists.length === 0 && (
              <span className="text-muted">Aucune liste pour l&apos;instant.</span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              value={newList}
              onChange={(event) => setNewList(event.target.value)}
              placeholder="Nouvelle liste…"
              className="min-h-[44px] rounded-control border border-line bg-surface px-2.5 text-[12.5px] lg:min-h-0 lg:py-1"
            />
            <button
              type="button"
              disabled={busy || newList.trim() === ""}
              onClick={() => void createAndAdd()}
              className={ACTION}
            >
              Créer et ajouter
            </button>
            <button type="button" onClick={() => setAdding(false)} className={SECONDARY}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {confirming === "enroll" && campaign !== null && (
        <div className="mt-1.5 rounded-control border border-brand bg-surface px-3 py-2">
          <p>
            <strong className="font-semibold">
              {scope} inscription{plural}
            </strong>{" "}
            dans « {campaign.name} ». Aucun message n&apos;est écrit ni envoyé : l&apos;écriture se
            déclenche depuis la campagne, sous « Écrire les mails ».
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => void enroll()} disabled={busy} className={ACTION}>
              {busy ? "En cours…" : "Confirmer"}
            </button>
            <button type="button" onClick={() => setConfirming(null)} className={SECONDARY}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {confirming === "remove" && listScope !== null && (
        <div className="mt-1.5 rounded-control border border-brand bg-surface px-3 py-2">
          <p>
            Retirer <strong className="font-semibold">{scope} fiche{plural}</strong> de «{" "}
            {listScope.name} ». Les fiches, leur historique et leurs autres listes ne sont pas
            touchés : seule l&apos;appartenance à cette liste prend fin.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void removeFromList()}
              disabled={busy}
              className={ACTION}
            >
              {busy ? "En cours…" : "Retirer"}
            </button>
            <button type="button" onClick={() => setConfirming(null)} className={SECONDARY}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {message !== null && <p className="mt-1.5">{message}</p>}
      {error !== null && <p className="mt-1.5 text-danger">{error}</p>}
    </div>
  );
}

/**
 * La sélection, tenue par la vue et **rechargée depuis `sessionStorage`** à
 * chaque montage — c'est-à-dire à chaque changement de filtre, puisque filtrer
 * navigue.
 */
export function useContactSelection(scope: SelectionScope): {
  readonly selected: ReadonlySet<string>;
  readonly toggle: (id: string) => void;
  readonly toggleAll: (ids: readonly string[], checked: boolean) => void;
  readonly reset: () => void;
} {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set<string>());

  useEffect(() => {
    // Au montage seulement : la lecture touche `window`, absent au rendu
    // serveur. Sans cet effet, la page échouerait à l'hydratation.
    setSelected(readSelection(scope));
  }, [scope]);

  const commit = (next: Set<string>) => {
    setSelected(next);
    writeSelection(scope, next);
  };

  return {
    selected,
    toggle: (id) => {
      const next = new Set(selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      commit(next);
    },
    toggleAll: (ids, checked) => {
      const next = new Set(selected);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      commit(next);
    },
    reset: () => {
      clearSelection(scope);
      commit(new Set<string>());
    },
  };
}
