"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

/**
 * La forme « cartes » d'un tableau, sous `lg`.
 *
 * Un tableau de 850 px sur un écran de 390 ne se lit pas : il se fait défiler
 * latéralement, colonne par colonne, en perdant le nom de la ligne. La carte
 * inverse le compromis — nom et société en tête, deux ou trois faits dessous,
 * **et le reste à un tap** : toucher la carte ouvre la fiche, qui porte tout.
 *
 * Le composant ne connaît pas les colonnes : chaque vue décide de ses deux ou
 * trois faits, comme elle décide de ses colonnes par défaut. Il ne rend rien
 * au-dessus de `lg` (`lg:hidden`) — le tableau, enveloppé de `max-lg:hidden`
 * par l'appelant, reste la forme de bureau. Même donnée, mêmes lignes, deux
 * rendus : aucune « version mobile » séparée.
 */
export interface CardFact {
  readonly label: string;
  readonly value: ReactNode;
}

export function CardList<T>({
  rows,
  rowKey,
  title,
  subtitle,
  facts,
  trailing,
  onSelect,
}: {
  readonly rows: readonly T[];
  readonly rowKey: (row: T) => string;
  readonly title: (row: T) => ReactNode;
  readonly subtitle?: (row: T) => ReactNode;
  /** Deux ou trois faits par carte — au-delà, c'est le tableau qui revient. */
  readonly facts: (row: T) => readonly CardFact[];
  /** Action au bord droit (un `tel:`…) — elle stoppe la propagation elle-même. */
  readonly trailing?: (row: T) => ReactNode;
  readonly onSelect?: (row: T) => void;
}) {
  return (
    <ul className="grid gap-2 lg:hidden">
      {rows.map((row) => {
        const sub = subtitle?.(row);
        return (
          <li
            key={rowKey(row)}
            onClick={onSelect === undefined ? undefined : () => onSelect(row)}
            tabIndex={onSelect === undefined ? undefined : 0}
            onKeyDown={
              onSelect === undefined
                ? undefined
                : (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(row);
                    }
                  }
            }
            className={`min-w-0 rounded-card border border-line bg-surface px-3.5 py-3 shadow-card ${
              onSelect === undefined ? "" : "cursor-pointer transition-colors active:bg-surface-2"
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14.5px] font-semibold">{title(row)}</div>
                {sub !== undefined && sub !== null && sub !== "" && (
                  <div className="truncate text-[12px] text-muted">{sub}</div>
                )}
              </div>
              {trailing?.(row)}
            </div>
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {facts(row).map((fact) => (
                <div key={fact.label} className="flex items-baseline gap-1.5">
                  <dt className="font-mono text-[9.5px] tracking-[0.1em] text-muted uppercase">
                    {fact.label}
                  </dt>
                  <dd className="text-[12.5px]">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

/** Le lien d'appel des cartes : 44 px, et il n'ouvre pas la fiche au passage. */
export function CardCallLink({ phone, name }: { readonly phone: string; readonly name: string }) {
  const trimmed = phone.trim();
  if (trimmed === "") return null;
  return (
    <a
      href={`tel:${trimmed.replace(/\s/g, "")}`}
      onClick={(event) => event.stopPropagation()}
      aria-label={`Appeler ${name} au ${trimmed}`}
      className="flex size-11 shrink-0 items-center justify-center rounded-control border border-line text-brand-d transition-colors active:bg-paper"
    >
      <Icon name="phone" size={19} />
    </a>
  );
}
