"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import { undoQueueBatch } from "@/lib/client/queue-api";
import { UndoToast, type ToastState } from "@/components/ui/undo-toast";
import { DomainBulkConfirm } from "./domain-bulk-confirm";
import { DomainRowItem, type DomainRow } from "./domain-row";

/**
 * Les domaines proposés, relus une ligne à la fois — ou en bloc, mais **jamais
 * les suppositions**.
 *
 * Aucune adresse proposée n'a été appelée. Un domaine deviné qui répond peut
 * appartenir à n'importe qui : le vérifier depuis le serveur donnerait à une
 * supposition l'apparence d'un fait, et l'erreur se découvrirait devant un
 * client.
 *
 * **« Tout accepter » n'apparaît que sous le filtre « Déduites d'une
 * adresse ».** Pas grisé : absent. Un bouton unique capable de balayer les
 * suppositions en même temps que les déductions annulerait la distinction que
 * tout ce bloc sert à établir — et sur les autres vues, un bouton désactivé
 * inviterait quand même à chercher comment l'activer. Le serveur applique la
 * même règle de son côté, ce qui est ce qui la rend vraie.
 */
export type { DomainRow };

export interface DomainPlan {
  rows: DomainRow[];
  noProposal: string[];
  totals: {
    companies: number;
    withDomain: number;
    withoutDomain: number;
    fromEmail: number;
    fromName: number;
    rejected: number;
  };
}

type Filter = "all" | "email" | "name";

const FILTERS: readonly { readonly key: Filter; readonly label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "email", label: "Déduites d'une adresse" },
  { key: "name", label: "Supposées du nom" },
];

/** Dix secondes : défaire quatre-vingts écritures se décide moins vite que défaire un report. */
const BULK_UNDO_MS = 10000;

function isDecided(value: unknown): value is { message: string } {
  return typeof value === "object" && value !== null && "message" in value;
}

function isBulk(value: unknown): value is {
  message: string;
  written: number;
  skipped: number;
  undo: unknown[];
} {
  if (typeof value !== "object" || value === null) return false;
  const bag: Record<string, unknown> = { ...value };
  return typeof bag.message === "string" && typeof bag.written === "number" && Array.isArray(bag.undo);
}

export function DomainsBlock({ plan }: { plan: DomainPlan }) {
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const visible = plan.rows.filter(
    (row) => !done.has(row.companyId) && (filter === "all" || row.rule === filter),
  );

  const decide = async (row: DomainRow, action: "accept" | "reject") => {
    setBusyId(row.companyId);
    setError(null);
    const result = await requestJson(
      "/api/maintenance/domains",
      {
        method: "POST",
        body: JSON.stringify({ companyId: row.companyId, action, value: row.value }),
      },
      isDecided,
    );
    setBusyId(null);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDone(new Set([...done, row.companyId]));
    setNotice(result.data.message);
  };

  const acceptAll = async () => {
    setBulkBusy(true);
    setError(null);
    const entries = visible.map((row) => ({ companyId: row.companyId, value: row.value }));
    const result = await requestJson(
      "/api/maintenance/domains",
      { method: "POST", body: JSON.stringify({ action: "accept-many", entries }) },
      isBulk,
    );
    setBulkBusy(false);
    setConfirming(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    // Les lignes ignorées disparaissent aussi : ce qui les a fait ignorer —
    // domaine déjà renseigné, proposition changée — les sortirait de toute
    // façon à la prochaine lecture.
    setDone(new Set([...done, ...entries.map((entry) => entry.companyId)]));
    setNotice(result.data.message);

    const steps = result.data.undo;
    setToast({
      message: result.data.message,
      tone: "ok",
      onUndo:
        steps.length === 0
          ? undefined
          : async () => {
              const back = await undoQueueBatch(steps, []);
              setNotice(
                back.ok
                  ? `${back.data.restored} domaine${back.data.restored === 1 ? "" : "s"} remis à vide.`
                  : `Annulation impossible : ${back.message}`,
              );
              setDone(new Set(done));
            },
    });
  };

  return (
    <div className="rounded-card border border-line bg-surface-2 px-3.5 py-3">
      <div className="flex flex-wrap items-baseline gap-2">
        <b className="font-display text-[13.5px] font-semibold">Domaines proposés</b>
        <span className="text-[12.5px] text-muted">
          {plan.totals.withoutDomain} société(s) sans domaine sur {plan.totals.companies} —{" "}
          {plan.totals.fromEmail} déduite(s) d&apos;une adresse professionnelle,{" "}
          {plan.totals.fromName} supposée(s) du nom.
          {plan.totals.rejected > 0 && ` ${plan.totals.rejected} écartée(s).`}
        </span>
      </div>

      <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
        <b className="font-semibold text-ink">Ce sont des propositions, pas des faits vérifiés.</b>{" "}
        Aucune de ces adresses n&apos;a été appelée : un domaine deviné qui répond peut très bien
        appartenir à quelqu&apos;un d&apos;autre, et le lien mènerait alors chez un tiers. Chaque
        ligne se décide séparément — accepter écrit le domaine de cette société et rien d&apos;autre,
        écarter la retire de la liste sans rien écrire. Les lignes dont le domaine ne ressemble pas
        au nom de la société sont remontées en tête.
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => {
              setFilter(entry.key);
              setConfirming(false);
            }}
            aria-pressed={filter === entry.key}
            className={`rounded-control px-2 py-1 text-[11.5px] font-semibold transition-colors ${
              filter === entry.key ? "bg-brand text-white" : "text-muted hover:bg-surface"
            }`}
          >
            {entry.label}
          </button>
        ))}
        <span className="ml-1 text-[11.5px] text-muted">{visible.length} à relire</span>

        {/* Absent, et non désactivé, hors de la vue « Déduites ». */}
        {filter === "email" && visible.length > 0 && !confirming && (
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => setConfirming(true)}
            className="ml-auto rounded-control border border-brand px-2.5 py-1 text-[11.5px] font-semibold text-brand-d transition-colors hover:bg-brand-l disabled:opacity-50"
          >
            {visible.length === 1 ? "Accepter le domaine déduit" : `Accepter les ${visible.length} domaines déduits`}
          </button>
        )}
      </div>

      {confirming && filter === "email" && (
        <DomainBulkConfirm
          rows={visible}
          busy={bulkBusy}
          onConfirm={() => void acceptAll()}
          onCancel={() => setConfirming(false)}
        />
      )}

      {error !== null && (
        <p className="mt-2 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}
      {notice !== null && <p className="mt-2 text-[12.5px] text-win-d">{notice}</p>}

      <ul className="mt-2 grid max-h-[320px] gap-1 overflow-y-auto">
        {visible.map((row) => (
          <DomainRowItem
            key={row.companyId}
            row={row}
            busy={busyId === row.companyId}
            onDecide={(action) => void decide(row, action)}
          />
        ))}
      </ul>

      {visible.length === 0 && <p className="mt-2 text-[12px] text-muted">Rien à relire avec ce filtre.</p>}

      {plan.noProposal.length > 0 && (
        <p className="mt-2 text-[11.5px] text-muted">
          {plan.noProposal.length} société(s) sans proposition possible — ni adresse
          professionnelle, ni nom exploitable : {plan.noProposal.slice(0, 6).join(", ")}
          {plan.noProposal.length > 6 ? "…" : ""}
        </p>
      )}

      <UndoToast state={toast} onDismiss={() => setToast(null)} millis={BULK_UNDO_MS} />
    </div>
  );
}
