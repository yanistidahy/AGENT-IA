"use client";

import { CONTACT_FILTERS, CONTACT_FILTER_LABELS } from "@/lib/domain/follow-up";
import { LIFECYCLES } from "@/lib/domain/types";

/**
 * Les puces de `/contacts` : cycle de vie, puis relances.
 *
 * Extraites parce que la barre de filtres dépassait la limite de 250 lignes, et
 * parce que les deux rangées n'ont pas le même statut. Le cycle de vie se
 * choisit tous les jours et reste visible ; les puces de relance servent une
 * fois sur dix et se replient derrière « Filtres », qui **dit** s'il en cache
 * une active — un filtre invisible et actif est un écran qui ment.
 */
const CHIP =
  "border-r border-line px-3 py-1.5 text-[12.5px] font-semibold transition-colors last:border-r-0";

const LIFECYCLE_FILTERS = ["all", ...LIFECYCLES] as const;

export function ContactChips({
  lifecycle,
  followUp,
  incomplete,
  incompleteCount,
  reminderCounts,
  expanded,
  onExpand,
  onChange,
}: {
  lifecycle: string;
  followUp: string | null;
  incomplete: boolean;
  incompleteCount: number;
  reminderCounts: { readonly total: number; readonly late: number };
  expanded: boolean;
  onExpand: () => void;
  onChange: (updates: Record<string, string | null>) => void;
}) {
  const followUpActive = followUp !== null || incomplete;

  return (
    <>
    <div className="flex overflow-hidden rounded-control border border-line bg-surface">
      {LIFECYCLE_FILTERS.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange({ lifecycle: value })}
          className={`${CHIP} ${
            lifecycle === value ? "bg-brand text-white" : "text-muted hover:bg-surface-2"
          }`}
        >
          {value === "all" ? "Tous" : value}
        </button>
      ))}
    </div>

    <button
      type="button"
      aria-expanded={expanded}
      onClick={() => onExpand()}
      className={`rounded-control border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
        followUpActive
          ? "border-brand bg-brand-l text-brand-d"
          : "border-line bg-surface text-muted hover:bg-surface-2"
      }`}
    >
      Filtres
      {followUpActive && <span className="ml-1 font-normal">· 1 actif</span>}
    </button>

    <div
      className={`${expanded ? "flex" : "hidden"} overflow-hidden rounded-control border border-line bg-surface`}
    >
      <button
        type="button"
        onClick={() => onChange({ followUp: null, incomplete: null })}
        className={`${CHIP} ${
          followUp === null && !incomplete
            ? "bg-brand text-white"
            : "text-muted hover:bg-surface-2"
        }`}
      >
        Tous
      </button>
      {CONTACT_FILTERS.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange({ followUp: value, incomplete: null })}
          className={`${CHIP} ${
            followUp === value ? "bg-brand text-white" : "text-muted hover:bg-surface-2"
          }`}
        >
          {CONTACT_FILTER_LABELS[value]}
          {value === "reminder" && reminderCounts.total > 0 && (
            <span className="ml-1 font-normal opacity-80">
              ({reminderCounts.total}
              {reminderCounts.late > 0 && ` · ${reminderCounts.late} en retard`})
            </span>
          )}
        </button>
      ))}
      {/*
        « Incomplets » : ni adresse ni téléphone, ou un nom marqué à compléter
        par l'import. C'est une file de travail — les fiches qu'on ne sait pas
        joindre — et non un statut de relance, d'où sa place à part.
      */}
      <button
        type="button"
        onClick={() => onChange({ incomplete: incomplete ? null : "1", followUp: null })}
        className={`${CHIP} ${
          incomplete ? "bg-brand text-white" : "text-muted hover:bg-surface-2"
        }`}
      >
        Contacts incomplets
        {incompleteCount > 0 && (
          <span className="ml-1 font-normal opacity-80">({incompleteCount})</span>
        )}
      </button>
    </div>
    </>
  );
}
