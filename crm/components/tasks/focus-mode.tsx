"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { requestJson } from "@/lib/client/http";
import { updateTask } from "@/lib/client/activity-api";
import { kindLabel, type FeedRow } from "@/lib/domain/task-tabs";
import { formatDate } from "@/lib/format";

/**
 * Le mode focus : une ligne à la fois, et on avance.
 *
 * **L'envoi d'un départ passe par la route de « Départs du jour »**, avec son
 * verdict nommé (jalon 91) : `POST /api/departures` en `action: "send"`. Écrire
 * un second chemin d'envoi ici aurait fait deux jeux de garde-fous, et c'est
 * toujours le second qui oublie la fiche passée en « Perdu » depuis
 * l'inscription. **Aucun appel au modèle sur ce chemin**, comme pour la
 * validation depuis la file : le texte est déjà écrit et déjà payé.
 */
interface FocusModeProps {
  readonly rows: readonly FeedRow[];
  readonly onQuit: () => void;
  readonly onChanged: () => void;
}

interface SendPayload {
  readonly ok?: boolean;
  readonly message?: string;
}

function isSendPayload(value: unknown): value is SendPayload {
  return typeof value === "object" && value !== null;
}

export function FocusMode({ rows, onQuit, onChanged }: FocusModeProps) {
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<{ ok: boolean; message: string } | null>(null);

  const row = rows[index];

  if (row === undefined) {
    return (
      <section className="rounded-card border border-line bg-surface px-5 py-9 text-center shadow-card">
        <b className="mb-1.5 block font-display text-[15px]">Onglet parcouru.</b>
        <p className="mb-4 text-[13px] text-muted">
          {rows.length} élément{rows.length > 1 ? "s" : ""} traité
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
    const result = await updateTask(row.id.replace(/^tache:/, ""), { done: true });
    setBusy(false);
    if (!result.ok) {
      setVerdict({ ok: false, message: result.message });
      return;
    }
    onChanged();
    advance();
  };

  const send = async () => {
    setBusy(true);
    setVerdict(null);
    const result = await requestJson(
      "/api/departures",
      {
        method: "POST",
        body: JSON.stringify({ id: row.id.replace(/^depart:/, ""), action: "send" }),
      },
      isSendPayload,
    );
    setBusy(false);

    if (!result.ok) {
      setVerdict({ ok: false, message: result.message });
      return;
    }
    if (result.data.ok === false) {
      // Le refus reste **sur la ligne cliquée**, avec sa cause nommée, et le
      // départ garde sa place dans la file : c'est le défaut du jalon 91.
      setVerdict({
        ok: false,
        message: `Rien n'est parti. ${result.data.message ?? "Envoi refusé."}`,
      });
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
          {kindLabel(row.kind)}
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
        {row.owner !== "" && ` · ${row.owner}`}
        {row.due !== null && ` · échéance ${formatDate(row.due)}`}
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
        {row.kind === "task" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void complete()}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-control bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-d disabled:opacity-50 lg:min-h-0"
          >
            <Icon name="check" size={15} />
            Terminer
          </button>
        )}

        {row.kind === "departure" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void send()}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-control bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-brand-d disabled:opacity-50 lg:min-h-0"
          >
            <Icon name="arrow" size={15} />
            Envoyer
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
