"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import {
  INSTAGRAM_PRESETS,
  activePreset,
  describeCombination,
  presetParams,
  type AccountState,
  type DmState,
} from "@/lib/domain/instagram-filter";

/**
 * La puce « Instagram » et ses quatre lectures.
 *
 * ## Une puce qui ouvre, plutôt que quatre de plus
 *
 * La rangée en portait déjà huit ; en ajouter trois l'aurait rendue illisible
 * avant de la rendre utile. Les états Instagram forment une famille — ils
 * répondent tous à « où en suis-je avec cette marque sur ce canal » — et une
 * famille se replie derrière un seul point d'entrée. C'est le même geste que le
 * bouton « Filtres » qui replie la seconde rangée depuis le jalon 21, et que le
 * menu ⋯ des cartes du pipeline au jalon 47.
 *
 * **La puce dit ce qu'elle cache** : quand un état est actif, elle porte son
 * libellé court et reste en surbrillance. Un filtre actif dont rien à l'écran
 * ne dit le nom est un écran qui ment — c'est la règle du filtre orphelin du
 * jalon 31, appliquée à un menu.
 *
 * ## Les compteurs
 *
 * Ils portent sur **tout le portefeuille**, jamais sur la liste filtrée : une
 * puce qui compte son propre résultat afficherait toujours le total de ce
 * qu'elle vient de sélectionner. « Compte connu, à DM » est celui qui compte —
 * c'est la file du matin.
 */
export function InstagramChip({
  account,
  dm,
  counts,
  onChange,
}: {
  readonly account: AccountState | undefined;
  readonly dm: DmState | undefined;
  readonly counts: Readonly<Record<string, number>>;
  readonly onChange: (updates: Record<string, string | null>) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = account !== undefined || dm !== undefined;
  const preset = activePreset(account, dm);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Un couple actif sans préréglage n'arrive que par URL écrite à la main. Il
  // est **nommé quand même** plutôt que de laisser une puce muette au-dessus
  // d'une liste filtrée.
  const label = active
    ? (preset?.short ?? describeCombination(account, dm))
    : "Instagram";

  return (
    <div className="relative" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className={`flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors max-lg:min-h-11 ${
          active
            ? "border-brand bg-brand-l text-brand-d"
            : "border-line bg-surface text-muted hover:bg-surface-2"
        }`}
      >
        <Icon name="instagram" size={14} className="shrink-0" />
        {label}
        {!active && counts["a-dm"] !== undefined && counts["a-dm"] > 0 && (
          // Hors sélection, la puce porte le seul nombre qui déclenche une
          // action : combien de marques attendent un DM.
          <span className="font-normal opacity-80">({counts["a-dm"]} à DM)</span>
        )}
        <span aria-hidden className="text-[9px] opacity-60">
          ▼
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 z-30 mt-1 w-64 overflow-hidden rounded-card border border-line bg-surface py-1 shadow-float"
        >
          <MenuItem
            selected={!active}
            onClick={() => {
              setOpen(false);
              onChange(presetParams(null));
            }}
          >
            Toutes les fiches
          </MenuItem>

          <div className="my-1 border-t border-line-2" />

          {INSTAGRAM_PRESETS.map((entry) => (
            <MenuItem
              key={entry.key}
              selected={preset?.key === entry.key}
              count={counts[entry.key]}
              onClick={() => {
                setOpen(false);
                // Les noms de paramètres sont décidés dans le domaine, où un
                // test les confronte au schéma qui les relit.
                onChange(presetParams(entry));
              }}
            >
              {entry.label}
            </MenuItem>
          ))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  children,
  onClick,
  selected,
  count,
}: {
  readonly children: React.ReactNode;
  readonly onClick: () => void;
  readonly selected: boolean;
  readonly count?: number;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] transition-colors hover:bg-surface-2 max-lg:min-h-11 max-lg:py-3 max-lg:text-[13.5px] ${
        selected ? "font-semibold text-brand-d" : ""
      }`}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {count !== undefined && (
        <span className="shrink-0 font-mono text-[11.5px] text-muted tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}
