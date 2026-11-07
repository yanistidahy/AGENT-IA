"use client";

import { useState } from "react";
import type { ManualEntryView, ManualTallyView } from "./manual-counter";

/**
 * **Le pied du compteur : ce qui a été compté, et comment le défaire.**
 *
 * Séparé du bloc parce que c'est de la lecture pure — il ne décide rien, il
 * rend ce que le serveur a renvoyé et remonte un identifiant à défaire. La
 * convention du projet borne un composant à 250 lignes, et cette couture est
 * la seule du bloc qui ne coupe aucun état en deux.
 */

interface Props {
  readonly today: readonly ManualTallyView[];
  readonly last: ManualEntryView | undefined;
  readonly history: readonly ManualEntryView[];
  readonly said: string;
  readonly busy: string;
  readonly onUndo: (entryId: string) => void;
}

function momentOf(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(new Date(iso));
}

export function CounterFooter({ today, last, history, said, busy, onUndo }: Props) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <>
  {/* Aujourd'hui, canal par canal, zéros compris. */}
  <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-line-2 pt-2.5 text-[12px]">
    {today.map((row) => (
      <li key={row.channel} className="text-muted">
        {row.label}{" "}
        <strong className="text-ink" data-manual-count={row.channel}>
          {row.count}
        </strong>
      </li>
    ))}
  </ul>

  {last !== undefined ? (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted">
      <span data-manual-last>
        Dernière saisie : {last.count} × {last.label}
        {last.contactName === "" ? "" : ` — ${last.contactName}`} ({momentOf(last.at)})
      </span>
      <button
        type="button"
        onClick={() => onUndo(last.entryId)}
        disabled={busy !== ""}
        data-manual-undo
        className="min-h-11 rounded-control border border-line px-2.5 text-[12px] font-medium text-ink hover:bg-line-2 disabled:opacity-60"
      >
        Annuler
      </button>
    </p>
  ) : null}

  {said !== "" ? (
    <p className="mt-2 text-[12.5px] text-ink" data-manual-said>
      {said}
    </p>
  ) : null}

  {history.length > 0 ? (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setShowHistory((open: boolean) => !open)}
        data-manual-history-toggle
        className="text-[12px] text-muted underline hover:text-brand-d"
      >
        {showHistory ? "Masquer l'historique" : `Historique (${history.length})`}
      </button>
      {showHistory ? (
        <ul className="mt-1.5 space-y-1 text-[12px]" data-manual-history>
          {history.map((entry) => (
            <li key={entry.entryId} className="flex items-center justify-between gap-2">
              <span className="truncate text-muted">
                {momentOf(entry.at)} — {entry.count} × {entry.label}
                {entry.contactName === "" ? " (sans contact)" : ` — ${entry.contactName}`}
                {entry.owner === "" ? "" : ` — ${entry.owner}`}
              </span>
              <button
                type="button"
                onClick={() => onUndo(entry.entryId)}
                disabled={busy !== ""}
                data-manual-delete={entry.entryId}
                className="shrink-0 rounded-control border border-line px-2 py-1 text-[11.5px] text-ink hover:bg-line-2 disabled:opacity-60"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  ) : null}
    </>
  );
}
