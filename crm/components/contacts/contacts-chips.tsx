"use client";

import {
  CONTACT_CHIPS,
  CONTACT_FILTER_LABELS,
  isChipFilter,
  isContactFilter,
} from "@/lib/domain/follow-up";
import { LIFECYCLES } from "@/lib/domain/types";
import type { AccountState, DmState } from "@/lib/domain/instagram-filter";
import { InstagramChip } from "./instagram-chip";

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
  account,
  dm,
  instagramCounts,
  expanded,
  onExpand,
  onChange,
}: {
  lifecycle: string;
  followUp: string | null;
  incomplete: boolean;
  incompleteCount: number;
  reminderCounts: { readonly total: number; readonly late: number };
  account: AccountState | undefined;
  dm: DmState | undefined;
  instagramCounts: Readonly<Record<string, number>>;
  expanded: boolean;
  onExpand: () => void;
  onChange: (updates: Record<string, string | null>) => void;
}) {
  const followUpActive = followUp !== null || incomplete;

  // Le filtre actif n'a-t-il pas de puce ? Alors on lui en rend une, le temps
  // qu'il est actif — voir le commentaire à son point de rendu.
  const orphan =
    followUp !== null && isContactFilter(followUp) && !isChipFilter(followUp) ? followUp : null;

  return (
    <>
    {/* `flex-wrap` sous `lg` : six segments coupés au bord de l'écran, c'est
        des cycles de vie qu'on ne peut plus choisir. */}
    <div className="flex overflow-hidden rounded-control border border-line bg-surface max-lg:flex-wrap">
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

    {/* Sur la première rangée, à côté de « Filtres » : c'est une file de
        travail quotidienne, pas un filtre qu'on ouvre une fois sur dix. */}
    <InstagramChip account={account} dm={dm} counts={instagramCounts} onChange={onChange} />

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
      {CONTACT_CHIPS.map((value) => (
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
        Un filtre atteint par URL mais sans puce — aujourd'hui « Déjà contactés »,
        qu'ouvre la bande de l'entonnoir. Il s'affiche **parce qu'il est actif** :
        une liste filtrée dont rien à l'écran ne nomme le filtre est un écran qui
        ment, et on n'aurait aucun moyen de l'annuler autrement qu'en éditant
        l'URL. Il disparaît dès qu'on en choisit un autre.
      */}
      {orphan !== null && (
        <button
          type="button"
          onClick={() => onChange({ followUp: null, incomplete: null })}
          className={`${CHIP} bg-brand text-white`}
        >
          {CONTACT_FILTER_LABELS[orphan]}
        </button>
      )}

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
