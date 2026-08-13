"use client";

import { useEffect } from "react";
import type { ActionRow } from "@/lib/api/dashboard";
import { moveCursor } from "@/lib/domain/queue";

/**
 * Le clavier de la file.
 *
 * Extrait du composant parce que c'est une préoccupation entière : quelles
 * touches, quand les ignorer, et sur quelle liste se déplacer. Mêlée à la
 * gestion de l'optimisme et de l'annulation, elle rendait le fichier illisible.
 *
 * **Les touches se taisent dès qu'un champ a le focus.** `c` doit pouvoir
 * s'écrire dans une note sans consigner un appel, et `j` dans un nom de société
 * sans déplacer le curseur. Les combinaisons avec une touche de modification
 * sont laissées au navigateur : `Ctrl+K` appartient à la barre d'adresse.
 */
export interface QueueKeyHandlers {
  readonly order: readonly string[];
  readonly rows: readonly ActionRow[];
  readonly cursor: string | null;
  readonly onCursor: (next: string | null) => void;
  readonly onToggle: (id: string) => void;
  readonly onOpen: (row: ActionRow) => void;
  readonly onLog: (row: ActionRow) => void;
}

function inEditableField(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

export function useQueueKeys({
  order,
  rows,
  cursor,
  onCursor,
  onToggle,
  onOpen,
  onLog,
}: QueueKeyHandlers): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (inEditableField(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "j" || event.key === "k") {
        event.preventDefault();
        onCursor(moveCursor(order, cursor, event.key === "j" ? 1 : -1));
        return;
      }

      if (cursor === null) return;
      const row = rows.find((candidate) => candidate.id === cursor);
      if (row === undefined) return;

      if (event.key === " ") {
        event.preventDefault();
        onToggle(cursor);
      } else if (event.key === "Enter") {
        event.preventDefault();
        onOpen(row);
      } else if (event.key === "c" && row.contactId !== null) {
        event.preventDefault();
        onLog(row);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, onCursor, onLog, onOpen, onToggle, order, rows]);
}
