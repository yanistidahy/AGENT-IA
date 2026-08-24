"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ActionRow } from "@/lib/api/dashboard";
import { Icon } from "@/components/ui/icon";
import { formatDate } from "@/lib/format";

/**
 * Une ligne de file, dense.
 *
 * Le reproche auquel elle répond : dix cartes empilées, trois boutons chacune,
 * et l'impression de devoir prendre dix décisions. Ici tout tient sur une
 * hauteur de ligne — case, nom, société, téléphone, silence, échéance — avec
 * **une** action primaire visible et le reste sous un menu. Ce qui est rare doit
 * être atteignable, pas exposé.
 *
 * La ligne n'écrit rien elle-même : elle remonte l'intention à la file, qui
 * porte l'optimisme, l'annulation et le compteur. Une ligne qui écrirait en base
 * aurait sa propre idée de l'état, et deux idées de l'état finissent par
 * diverger.
 */
export type RowIntent =
  | { readonly kind: "log" }
  | { readonly kind: "postpone"; readonly days: number }
  | { readonly kind: "lost" }
  | { readonly kind: "complete" };

const CELL = "truncate text-[12.5px]";

export function QueueRow({
  row,
  selected,
  focused,
  onSelect,
  onIntent,
  onFocus,
}: {
  row: ActionRow;
  selected: boolean;
  focused: boolean;
  onSelect: () => void;
  onIntent: (intent: RowIntent) => void;
  onFocus: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const node = useRef<HTMLLIElement>(null);

  // Le curseur clavier doit rester visible quand il sort de l'écran : sans
  // cela, `j` maintenu fait défiler la sélection sous le pli sans que rien ne
  // bouge à l'image.
  useEffect(() => {
    if (focused) node.current?.scrollIntoView({ block: "nearest" });
  }, [focused]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  return (
    <li
      ref={node}
      onMouseDown={onFocus}
      className={`relative flex items-center gap-2.5 border-b border-line-2 px-2.5 last:border-b-0 max-lg:min-h-14 max-lg:gap-2 max-lg:py-1.5 lg:h-12 ${
        focused ? "bg-brand-l" : selected ? "bg-surface-2" : "bg-surface hover:bg-surface-2"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onSelect}
        aria-label={`Sélectionner ${row.title}`}
        className="shrink-0 accent-brand-d max-lg:size-5 lg:size-3.5"
      />

      {/* Sur téléphone, nom et société s'empilent dans la même cellule : la
          ligne garde une seule hauteur de décision, pas une par colonne. */}
      <span className="flex min-w-0 flex-[2] flex-col lg:contents">
        <span className={`${CELL} min-w-0 font-semibold lg:flex-[2]`}>{row.title}</span>
        <span className={`${CELL} min-w-0 text-muted max-lg:text-[11px] lg:flex-[2]`}>
          {row.company ?? ""}
        </span>
        {/* L'échéance suit le nom sur téléphone : la colonne dédiée n'a pas
            la place, et une relance en retard doit rester rouge. */}
        {row.due !== null && (
          <span className="font-mono text-[10.5px] text-[#B2311F] tabular-nums lg:hidden">
            échéance {formatDate(row.due)}
          </span>
        )}
      </span>

      {row.phone === "" ? (
        <span className="hidden w-28 shrink-0 lg:block" />
      ) : (
        <>
          <a
            href={`tel:${row.phone.replace(/\s/g, "")}`}
            onClick={(event) => event.stopPropagation()}
            className="hidden w-28 shrink-0 truncate font-mono text-[11.5px] text-brand-d hover:underline lg:block"
          >
            {row.phone}
          </a>
          {/* Le numéro en icône sur téléphone : appeler est l'action nº 1 de
              la file en mobilité, elle doit se toucher au pouce (44 px). */}
          <a
            href={`tel:${row.phone.replace(/\s/g, "")}`}
            onClick={(event) => event.stopPropagation()}
            aria-label={`Appeler ${row.title} au ${row.phone}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-control text-brand-d transition-colors hover:bg-paper lg:hidden"
          >
            <Icon name="phone" size={19} />
          </a>
        </>
      )}

      <span className="hidden w-20 shrink-0 text-right font-mono text-[11px] text-muted tabular-nums lg:block">
        {row.idleDays === null ? "jamais" : `${row.idleDays} j`}
      </span>

      <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums max-lg:hidden">
        {row.due === null ? (
          <span className="text-muted">—</span>
        ) : (
          <span className="text-[#B2311F]">{formatDate(row.due)}</span>
        )}
      </span>

      {row.contactId !== null && (
        <button
          type="button"
          className="shrink-0 rounded-control border border-line bg-surface px-2 py-1 text-[11.5px] font-semibold transition-colors hover:bg-paper max-lg:min-h-11 max-lg:px-3"
          onClick={() => onIntent({ kind: "log" })}
        >
          Consigner
        </button>
      )}

      <div className="relative shrink-0">
        <button
          type="button"
          aria-label={`Autres actions pour ${row.title}`}
          aria-expanded={menu}
          className="rounded-control text-muted transition-colors hover:bg-paper max-lg:flex max-lg:size-11 max-lg:items-center max-lg:justify-center max-lg:text-[17px] lg:px-1.5 lg:py-1 lg:text-[13px]"
          onClick={(event) => {
            event.stopPropagation();
            setMenu((open) => !open);
          }}
        >
          ⋯
        </button>

        {menu && (
          <div
            onClick={(event) => event.stopPropagation()}
            className="absolute top-full right-0 z-20 mt-1 w-52 overflow-hidden rounded-card border border-line bg-surface py-1 shadow-float"
          >
            <MenuItem
              disabled={row.taskId === null && row.contactId === null}
              onClick={() => {
                setMenu(false);
                onIntent({ kind: "postpone", days: 3 });
              }}
            >
              Reporter à +3 j
            </MenuItem>
            <MenuItem
              disabled={row.taskId === null && row.contactId === null}
              onClick={() => {
                setMenu(false);
                onIntent({ kind: "postpone", days: 7 });
              }}
            >
              Reporter à +7 j
            </MenuItem>
            {row.taskId !== null && (
              <MenuItem
                onClick={() => {
                  setMenu(false);
                  onIntent({ kind: "complete" });
                }}
              >
                Marquer fait
              </MenuItem>
            )}
            <Link
              href={hrefFor(row)}
              className="block px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-surface-2 max-lg:min-h-11 max-lg:py-3 max-lg:text-[13px]"
            >
              Ouvrir la fiche
            </Link>
            {row.contactId !== null && (
              <MenuItem
                tone="danger"
                onClick={() => {
                  setMenu(false);
                  onIntent({ kind: "lost" });
                }}
              >
                Marquer perdu
              </MenuItem>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function MenuItem({
  children,
  onClick,
  disabled = false,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`block w-full px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-surface-2 disabled:opacity-40 max-lg:min-h-11 max-lg:py-3 max-lg:text-[13px] ${
        tone === "danger" ? "text-[#B2311F]" : ""
      }`}
    >
      {children}
    </button>
  );
}

export function hrefFor(row: ActionRow): string {
  if (row.contactId !== null) {
    return `/contacts?lifecycle=all&fiche=${encodeURIComponent(row.contactId)}`;
  }
  if (row.dealId !== null) return `/affaires?status=all&fiche=${encodeURIComponent(row.dealId)}`;
  return "/taches";
}
