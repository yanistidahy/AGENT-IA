"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";

/**
 * Les domaines proposés, relus une ligne à la fois.
 *
 * **Ce bloc n'a pas de bouton « Appliquer ».** C'est sa raison d'être : les
 * autres corrections de ce panneau portent sur des faits — une valeur déjà
 * présente dans la feuille, un miroir dérivé, un nom coupé en deux. Celle-ci
 * porte sur des suppositions, et une supposition ne s'applique pas en masse.
 *
 * Aucune adresse proposée n'a été appelée. Un domaine deviné qui répond peut
 * appartenir à n'importe qui : le vérifier depuis le serveur donnerait à une
 * supposition l'apparence d'un fait, et l'erreur se découvrirait devant un
 * client. Le texte du bloc le dit, parce que celui qui relit doit le savoir.
 */
export interface DomainRow {
  companyId: string;
  company: string;
  value: string;
  rule: "email" | "name";
  confidence: "high" | "low";
  because: string;
  contacts: number;
}

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

function isDecided(value: unknown): value is { message: string } {
  return typeof value === "object" && value !== null && "message" in value;
}

export function DomainsBlock({ plan }: { plan: DomainPlan }) {
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

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
    // La ligne disparaît de la liste sans recharger : relire cent lignes
    // demande de garder sa place dans le défilement.
    setDone(new Set([...done, row.companyId]));
    setNotice(result.data.message);
  };

  const visible = plan.rows.filter(
    (row) => !done.has(row.companyId) && (filter === "all" || row.rule === filter),
  );

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
        écarter la retire de la liste sans rien écrire.
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {FILTERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setFilter(entry.key)}
            aria-pressed={filter === entry.key}
            className={`rounded-control px-2 py-1 text-[11.5px] font-semibold transition-colors ${
              filter === entry.key ? "bg-brand text-white" : "text-muted hover:bg-surface"
            }`}
          >
            {entry.label}
          </button>
        ))}
        <span className="ml-1 text-[11.5px] text-muted">{visible.length} à relire</span>
      </div>

      {error !== null && (
        <p className="mt-2 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}
      {notice !== null && <p className="mt-2 text-[12.5px] text-win-d">{notice}</p>}

      <ul className="mt-2 grid max-h-[320px] gap-1 overflow-y-auto">
        {visible.map((row) => (
          <Row
            key={row.companyId}
            row={row}
            busy={busyId === row.companyId}
            onDecide={(action) => void decide(row, action)}
          />
        ))}
      </ul>

      {visible.length === 0 && (
        <p className="mt-2 text-[12px] text-muted">
          Rien à relire avec ce filtre.
        </p>
      )}

      {plan.noProposal.length > 0 && (
        <p className="mt-2 text-[11.5px] text-muted">
          {plan.noProposal.length} société(s) sans proposition possible — ni adresse
          professionnelle, ni nom exploitable : {plan.noProposal.slice(0, 6).join(", ")}
          {plan.noProposal.length > 6 ? "…" : ""}
        </p>
      )}
    </div>
  );
}

function Row({
  row,
  busy,
  onDecide,
}: {
  row: DomainRow;
  busy: boolean;
  onDecide: (action: "accept" | "reject") => void;
}) {
  const derived = row.rule === "email";

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-control border border-line bg-surface px-2.5 py-1.5 text-[12.5px]">
      <span className="min-w-0 flex-1">
        <b className="font-semibold">{row.company}</b>
        <span className="text-muted"> · {row.contacts} fiche(s)</span>
        <br />
        <span className="font-mono text-[12px]">{row.value}</span>{" "}
        <span
          className={`ml-1 rounded-full px-1.5 py-[1px] text-[10.5px] font-semibold ${
            derived ? "bg-brand-l text-brand-d" : "bg-gold-l text-[#9A6410]"
          }`}
        >
          {derived ? "déduit d'une adresse" : "supposé du nom"}
        </span>
        {row.confidence === "low" && derived && (
          <span className="ml-1 rounded-full bg-gold-l px-1.5 py-[1px] text-[10.5px] font-semibold text-[#9A6410]">
            ambigu
          </span>
        )}
        <span className="mt-0.5 block text-[11px] text-muted">{row.because}</span>
      </span>

      <button
        type="button"
        disabled={busy}
        onClick={() => onDecide("accept")}
        className="rounded-control bg-brand px-2.5 py-1 text-[11.5px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50"
      >
        Accepter
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onDecide("reject")}
        className="rounded-control border border-line px-2.5 py-1 text-[11.5px] font-semibold text-muted transition-colors hover:bg-paper disabled:opacity-50"
      >
        Écarter
      </button>
    </li>
  );
}
