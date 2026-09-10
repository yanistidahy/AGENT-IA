"use client";

import { useEffect, useState } from "react";
import {
  ADDED_LABELS,
  ADDED_PRESETS,
  ADDED_SHORT,
  describeWindow,
  type AddedPreset,
} from "@/lib/domain/added-window";

/**
 * La puce « Ajoutés » : quatre préréglages, plus une plage libre.
 *
 * Même geste que la puce Instagram du jalon 49 : une famille de lectures se
 * replie derrière un seul point d'entrée plutôt que d'allonger une rangée qui
 * en portait déjà neuf. Et la même règle, qui vient du jalon 31 : **la puce dit
 * ce qu'elle cache**. Quand un filtre est actif, elle porte son libellé et
 * reste en surbrillance, y compris pour une plage écrite à la main dans l'URL,
 * parce qu'une liste filtrée dont rien ne nomme le filtre est un écran qui ment.
 *
 * Hors sélection, elle porte **le nombre de la semaine** : c'est celui qui dit
 * si le sourcing tourne. « 23 cette semaine » se lit d'un coup d'œil, et zéro
 * se lit tout aussi vite.
 */
export function AddedChip({
  preset,
  from,
  to,
  weekCount,
  onChange,
}: {
  readonly preset: AddedPreset | undefined;
  readonly from: string | undefined;
  readonly to: string | undefined;
  /** Combien de fiches ajoutées cette semaine, sur tout le portefeuille. */
  readonly weekCount: number;
  readonly onChange: (updates: Record<string, string | null>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from ?? "");
  const [draftTo, setDraftTo] = useState(to ?? "");

  const rangeActive = from !== undefined || to !== undefined;
  const active = preset !== undefined || rangeActive;

  useEffect(() => {
    setDraftFrom(from ?? "");
    setDraftTo(to ?? "");
  }, [from, to]);

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

  const label = preset !== undefined
    ? ADDED_SHORT[preset]
    : rangeActive
      ? describeWindow(from, to)
      : "Ajoutés";

  // Un préréglage efface la plage, et réciproquement : deux fenêtres actives à
  // la fois ne décrivent aucune question, et l'URL doit rester lisible.
  const choosePreset = (value: AddedPreset | null) => {
    setOpen(false);
    onChange({ ajout: value, du: null, au: null });
  };

  const applyRange = () => {
    if (draftFrom === "" && draftTo === "") return;
    setOpen(false);
    onChange({
      ajout: null,
      du: draftFrom === "" ? null : draftFrom,
      au: draftTo === "" ? null : draftTo,
    });
  };

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
        {label}
        {!active && weekCount > 0 && (
          <span className="font-normal opacity-80">({weekCount} cette semaine)</span>
        )}
        <span aria-hidden className="text-[9px] opacity-60">
          ▼
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 z-30 mt-1 w-72 overflow-hidden rounded-card border border-line bg-surface py-1 shadow-float"
        >
          <MenuItem selected={!active} onClick={() => choosePreset(null)}>
            Toutes les fiches
          </MenuItem>

          <div className="my-1 border-t border-line-2" />

          {ADDED_PRESETS.map((entry) => (
            <MenuItem
              key={entry}
              selected={preset === entry}
              onClick={() => choosePreset(entry)}
            >
              {ADDED_LABELS[entry]}
            </MenuItem>
          ))}

          <div className="my-1 border-t border-line-2" />

          <div className="px-3 py-2">
            <p className="mb-1.5 font-mono text-[10px] tracking-[0.08em] text-muted uppercase">
              Plage libre
            </p>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={draftFrom}
                onChange={(event) => setDraftFrom(event.target.value)}
                aria-label="Ajoutés depuis le"
                className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2 py-1 text-[12px] outline-none focus:border-brand max-lg:min-h-11"
              />
              <span className="text-[11px] text-muted">au</span>
              <input
                type="date"
                value={draftTo}
                onChange={(event) => setDraftTo(event.target.value)}
                aria-label="Ajoutés jusqu'au"
                className="min-w-0 flex-1 rounded-control border border-line bg-surface px-2 py-1 text-[12px] outline-none focus:border-brand max-lg:min-h-11"
              />
            </div>
            {/* Une seule borne suffit : « depuis le 1er mars » est une question
                légitime, et exiger la seconde ferait saisir une date qu'on n'a
                pas en tête. */}
            <button
              type="button"
              onClick={applyRange}
              disabled={draftFrom === "" && draftTo === ""}
              className="mt-2 w-full rounded-control bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-d disabled:opacity-50 max-lg:min-h-11"
            >
              Appliquer la plage
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  selected,
  onClick,
  children,
}: {
  readonly selected: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex w-full items-center justify-between px-3 py-2 text-left text-[12.5px] transition-colors max-lg:min-h-11 ${
        selected ? "bg-brand-l font-semibold text-brand-d" : "hover:bg-surface-2"
      }`}
    >
      {children}
      {selected && <span aria-hidden>✓</span>}
    </button>
  );
}
