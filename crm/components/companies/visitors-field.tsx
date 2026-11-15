"use client";

import { useState } from "react";
import { updateCompany } from "@/lib/client/crm-api";
import { parseVisitors, valueSourceLabel, VISITORS_HELP } from "@/lib/domain/company-profile";
import { SIZE_SHORT, sizeBucketOf, visitorsBadge, visitorsLabel } from "@/lib/domain/size-buckets";

/**
 * **Le trafic d'une marque : sa badge, et le champ qui la remplit.**
 *
 * Un seul composant pour les trois surfaces qui le portent — la fiche société,
 * la ligne société d'un contact, la cellule du tableau — parce que le brief
 * demande la même chose aux trois : voir le segment **et** pouvoir taper le
 * nombre sans aller ailleurs. Trois copies auraient fini par accepter trois
 * écritures différentes de « 8 000 ».
 *
 * ## Trois décisions
 *
 * 1. **la valeur est lue avant d'être envoyée**, par `parseVisitors`, la
 *    fonction du domaine. « beaucoup » est refusé **avec sa phrase**, jamais
 *    rangé à zéro, et jamais envoyé au serveur pour qu'il le refuse à son tour —
 *    une erreur qui revient après un aller-retour réseau se lit comme une panne ;
 * 2. **vider le champ efface le trafic**, et ce n'est pas une erreur : c'est la
 *    seule façon de dire « je m'étais trompé, je ne sais pas ». La phrase d'aide
 *    le dit, parce que personne ne devine qu'un champ vide est une intention ;
 * 3. **la badge se met à jour sans rechargement.** L'état local porte la valeur
 *    enregistrée, et `onSaved` laisse le parent rafraîchir les écrans serveur
 *    (les cartes de segment, la puce « Trafic non renseigné ») — les deux
 *    ensemble font que l'écran ne ment jamais, même une seconde.
 */
export function VisitorsField({
  companyId,
  visitors,
  source,
  onSaved,
  compact = false,
}: {
  readonly companyId: string;
  readonly visitors: number | null;
  readonly source: string;
  readonly onSaved?: () => void;
  /** Dans une cellule de tableau : pas de phrase d'aide, pas de bouton large. */
  readonly compact?: boolean;
}) {
  const [value, setValue] = useState<number | null>(visitors);
  const [from, setFrom] = useState(source);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(visitors === null ? "" : String(visitors));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = () => {
    setDraft(value === null ? "" : String(value));
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    const parsed = parseVisitors(draft);
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    setBusy(true);
    setError(null);
    const result = await updateCompany(companyId, { monthlyVisitors: parsed.value });
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setValue(parsed.value);
    // La provenance suit la valeur : on vient de la taper, donc « saisi ».
    setFrom(parsed.value === null ? "" : "crm");
    setEditing(false);
    onSaved?.();
  };

  if (editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <input
          autoFocus
          data-visitors-input={companyId}
          value={draft}
          inputMode="numeric"
          placeholder="8000, 8 000, 8k…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save();
            if (event.key === "Escape") setEditing(false);
          }}
          onClick={(event) => event.stopPropagation()}
          className="w-[128px] rounded-control border border-line bg-surface px-2 py-1 text-[12.5px] outline-none focus:border-brand"
        />
        <button
          type="button"
          data-visitors-save={companyId}
          disabled={busy}
          onClick={(event) => {
            event.stopPropagation();
            void save();
          }}
          className="rounded-control bg-brand px-2.5 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50"
        >
          Enregistrer
        </button>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setEditing(false);
          }}
          className="rounded-control border border-line px-2 py-1 text-[12px] text-muted transition-colors hover:bg-surface-2"
        >
          Annuler
        </button>
        {error !== null && (
          <span data-visitors-error className="block w-full text-[12px] text-[#B2311F]">
            {error}
          </span>
        )}
        {!compact && error === null && (
          <span className="block w-full text-[11.5px] text-muted">{VISITORS_HELP}</span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span
        data-visitors-badge={companyId}
        data-visitors-bucket={sizeBucketOf(value)}
        data-visitors={value === null ? "" : value}
        className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-medium ${
          value === null ? "border-line bg-surface-2 text-closed" : "border-brand/30 bg-brand-l text-brand-d"
        }`}
      >
        {/*
          **La phrase entière sur une fiche, la forme courte dans une cellule.**

          « Grosse marque · 24 000 visiteurs/mois » est la bonne lecture quand on
          regarde **une** marque ; répétée sur quarante lignes elle double la
          hauteur du tableau et noie la colonne d'à côté. Les deux formes
          viennent du domaine (`visitorsBadge`, `SIZE_SHORT` + `visitorsLabel`) :
          la vue choisit laquelle montrer, elle n'en compose aucune.
        */}
        {compact && value !== null
          ? `${visitorsLabel(value)} · ${SIZE_SHORT[sizeBucketOf(value)]}`
          : visitorsBadge(value)}
      </span>
      {from !== "" && value !== null && (
        <span data-value-source={from} className="text-[11px] text-muted">
          ({valueSourceLabel(from)})
        </span>
      )}
      <button
        type="button"
        data-visitors-edit={companyId}
        onClick={(event) => {
          event.stopPropagation();
          open();
        }}
        className="rounded-control border border-line px-2 py-0.5 text-[11.5px] font-medium text-brand-d transition-colors hover:bg-surface-2"
      >
        {value === null ? "Saisir" : "Modifier"}
      </button>
    </span>
  );
}
