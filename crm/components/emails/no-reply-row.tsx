"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { SilentRow } from "@/lib/api/email-list";
import { formatDate } from "@/lib/format";

/**
 * Une personne qui n'a pas répondu, et ce qu'on peut en faire tout de suite.
 *
 * La ligne n'écrit rien : elle remonte l'intention au bloc, qui porte
 * l'optimisme et l'annulation. Une ligne qui écrirait aurait sa propre idée de
 * l'état, et deux idées de l'état finissent par diverger — c'est la règle posée
 * par la file d'accueil au jalon 20, et elle vaut ici pour la même raison.
 *
 * Le silence est **la seule donnée mise en avant**, parce que c'est le critère
 * de tri et la raison d'être du bloc. Au-delà de deux semaines il passe en
 * ambre : ce n'est pas une alerte, c'est le moment où relancer se décide.
 */
const LONG_SILENCE_DAYS = 14;

export function NoReplyRow({
  row,
  onLog,
  onWrite,
  onLost,
}: {
  readonly row: SilentRow;
  readonly onLog: () => void;
  readonly onWrite: () => void;
  readonly onLost: () => void;
}) {
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  return (
    <li className="flex items-center gap-2 border-b border-line-2 px-3 py-1.5 last:border-b-0 hover:bg-surface-2">
      <span
        className={`w-16 shrink-0 text-right font-mono text-[11.5px] tabular-nums ${
          row.silentDays >= LONG_SILENCE_DAYS ? "font-semibold text-[#9A6410]" : "text-muted"
        }`}
        title={`Dernier message le ${formatDate(row.lastSentAt)} — « ${row.lastSubject} »`}
      >
        {row.silentDays} j
      </span>

      <span className="min-w-0 flex-1">
        <Link
          href={`/contacts?lifecycle=all&fiche=${encodeURIComponent(row.contactId)}`}
          className="block truncate text-[12.5px] font-medium text-brand-d hover:underline"
        >
          {row.name}
        </Link>
        <span className="block truncate text-[11px] text-muted">
          {row.company}
          {row.messages > 1 && ` · ${row.messages} messages`}
        </span>
      </span>

      <button
        type="button"
        onClick={onLog}
        className="shrink-0 rounded-control border border-line bg-surface px-2 py-1 text-[11.5px] font-semibold transition-colors hover:bg-paper"
      >
        Consigner
      </button>

      <button
        type="button"
        onClick={onWrite}
        disabled={row.email.trim() === ""}
        title={row.email.trim() === "" ? "Cette fiche n'a pas d'adresse." : `Écrire à ${row.email}`}
        className="shrink-0 rounded-control border border-line bg-surface px-2 py-1 text-[11.5px] font-semibold transition-colors hover:bg-paper disabled:opacity-40"
      >
        Écrire
      </button>

      <div className="relative shrink-0">
        <button
          type="button"
          aria-label={`Autres actions pour ${row.name}`}
          aria-expanded={menu}
          onClick={(event) => {
            event.stopPropagation();
            setMenu((open) => !open);
          }}
          className="rounded-control px-1.5 py-1 text-[13px] text-muted transition-colors hover:bg-paper"
        >
          ⋯
        </button>

        {menu && (
          <div
            onClick={(event) => event.stopPropagation()}
            className="absolute top-full right-0 z-20 mt-1 w-56 overflow-hidden rounded-card border border-line bg-surface py-1 shadow-float"
          >
            <Link
              href={`/contacts?lifecycle=all&fiche=${encodeURIComponent(row.contactId)}`}
              className="block px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-surface-2"
            >
              Ouvrir la fiche
            </Link>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                onLost();
              }}
              className="block w-full px-3 py-1.5 text-left text-[12px] text-[#B2311F] transition-colors hover:bg-surface-2"
            >
              Marquer perdu — ne répond plus
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
