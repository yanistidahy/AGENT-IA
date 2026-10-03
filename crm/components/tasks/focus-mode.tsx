"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { updateTask } from "@/lib/client/activity-api";
import { markCallDone } from "@/lib/client/task-api";
import { dialHref } from "@/lib/domain/task-kind";
import { TASK_KIND_LABELS, type TaskRow } from "@/lib/domain/task-tabs";
import { formatDate } from "@/lib/format";

/**
 * Le mode focus : une tâche à la fois, et on avance.
 *
 * Il parcourt **la liste de l'onglet courant**, telle qu'elle est affichée —
 * personne, filtres et recherche compris : démarrer sur une liste et en
 * parcourir une autre serait la pire des surprises.
 *
 * **Plus de départ à envoyer ici** (jalon 105) : la file des départs a son
 * bandeau et sa page, avec ses garde-fous et ses refus nommés (jalon 91). Un
 * second chemin d'envoi aurait fait deux jeux de règles, et c'est toujours le
 * second qui oublie la fiche passée en « Perdu ». Ce qui reste est ce qu'on fait
 * d'une tâche : la terminer, consigner l'appel, ou passer.
 */
interface FocusModeProps {
  readonly rows: readonly TaskRow[];
  readonly onQuit: () => void;
  readonly onChanged: () => void;
}

export function FocusMode({ rows, onQuit, onChanged }: FocusModeProps) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<{ ok: boolean; message: string } | null>(null);

  const row = rows[index];
  const dial = row === undefined || row.kind !== "appel" ? null : dialHref(row.contactPhone);

  if (row === undefined) {
    return (
      <section className="rounded-card border border-line bg-surface px-5 py-9 text-center shadow-card">
        <b className="mb-1.5 block font-display text-[15px]">Onglet parcouru.</b>
        <p className="mb-4 text-[13px] text-muted">
          {rows.length} tâche{rows.length > 1 ? "s" : ""} traitée
          {rows.length > 1 ? "s" : ""} ou passé{rows.length > 1 ? "s" : ""}.
        </p>
        <button
          type="button"
          onClick={onQuit}
          className="rounded-control bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-d"
        >
          Quitter
        </button>
      </section>
    );
  }

  const advance = () => {
    setVerdict(null);
    setIndex((current) => current + 1);
  };

  const complete = async () => {
    setBusy(true);
    const result = await updateTask(row.id, { done: true });
    setBusy(false);
    if (!result.ok) {
      setVerdict({ ok: false, message: result.message });
      return;
    }
    onChanged();
    advance();
  };

  /*
    **« Appel passé » consigne et coche, par la même route que la liste.** Deux
    chemins pour un geste qui écrit deux fois auraient fini par en oublier un, et
    ce serait l'interaction — donc le seul fait qui prouve l'appel.
  */
  const callPassed = async () => {
    setBusy(true);
    setVerdict(null);
    const result = await markCallDone(row.id);
    setBusy(false);
    if (!result.ok) {
      setVerdict({ ok: false, message: result.message });
      return;
    }
    onChanged();
    advance();
  };

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card">
      <header className="mb-4 flex flex-wrap items-center gap-3 border-b border-line-2 pb-3">
        <span className="font-mono text-[12px] text-muted">
          {index + 1} sur {rows.length}
        </span>
        <span className="rounded-full bg-paper px-2 py-[2px] text-[11.5px] text-muted">
          {TASK_KIND_LABELS[row.kind]}
        </span>
        <button
          type="button"
          onClick={onQuit}
          className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-control border border-line px-3 py-2 text-[12.5px] font-semibold hover:bg-surface-2 lg:min-h-0"
        >
          <Icon name="x" size={14} />
          Quitter
        </button>
      </header>

      <h2 className="font-display text-lg font-semibold tracking-tight">{row.title}</h2>
      <p className="mt-1 text-[13px] text-muted">
        {row.detail !== "" && row.detail}
        {row.assignee !== "" && ` · ${row.assignee}`}
        {` · échéance ${formatDate(row.due)}`}
      </p>

      {verdict !== null && (
        <p
          role="status"
          className={`mt-4 rounded-control px-3 py-2 text-[12.5px] ${
            verdict.ok ? "bg-win-l text-win-d" : "bg-danger/10 text-danger"
          }`}
        >
          {verdict.message}
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line-2 pt-4">
        <button
            type="button"
            disabled={busy}
            data-focus-done="1"
            onClick={() => void complete()}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-control bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-d disabled:opacity-50 lg:min-h-0"
          >
            <Icon name="check" size={15} />
            Terminer
          </button>

        {dial !== null && (
          <a
            href={dial}
            data-focus-dial="1"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-control border border-line px-3 py-2 text-[12.5px] font-semibold hover:bg-surface-2 lg:min-h-0"
          >
            <Icon name="phone" size={14} />
            {row.contactPhone}
          </a>
        )}

        {row.kind === "appel" && row.contactId !== null && (
          <button
            type="button"
            disabled={busy}
            data-focus-call-done="1"
            onClick={() => void callPassed()}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-control border border-brand bg-brand-l px-3 py-2 text-[12.5px] font-semibold text-brand-d hover:bg-brand-l/70 lg:min-h-0"
          >
            <Icon name="check" size={14} />
            Appel passé
          </button>
        )}

        {row.href !== null && (
          <Link
            href={row.href}
            className="inline-flex min-h-[44px] items-center rounded-control border border-line px-3 py-2 text-[12.5px] font-semibold hover:bg-surface-2 lg:min-h-0"
          >
            Ouvrir la fiche
          </Link>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={advance}
          className="ml-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-control border border-line px-3 py-2 text-[12.5px] font-semibold hover:bg-surface-2 disabled:opacity-50 lg:min-h-0"
        >
          Passer
        </button>
      </div>
    </section>
  );
}
