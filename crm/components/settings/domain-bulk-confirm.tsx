"use client";

import type { DomainRow } from "./domain-row";

/**
 * L'étape de confirmation de l'acceptation groupée.
 *
 * Elle **liste ce qui sera écrit** plutôt que de le résumer : quatre-vingts
 * lignes acceptées d'un clic méritent d'être vues avant, et le seul moyen
 * honnête de les voir est de les montrer. Les lignes qui ne ressemblent pas au
 * nom de leur société sont en tête ici aussi — si l'on doit en écarter une,
 * c'est celle-là.
 *
 * Le rappel « aucune de ces adresses n'a été appelée » reprend mot pour mot
 * celui du panneau : deux formulations différentes pour la même garantie
 * finiraient par diverger, et l'une des deux deviendrait fausse.
 */
export function DomainBulkConfirm({
  rows,
  busy,
  onConfirm,
  onCancel,
}: {
  rows: readonly DomainRow[];
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const suspicious = rows.filter((row) => row.suspicious).length;

  return (
    <div className="mt-2 rounded-card border border-[#D3CEFA] bg-brand-l px-3.5 py-3">
      <p className="text-[13px] font-semibold text-brand-d">
        {rows.length === 1
          ? "Écrire 1 domaine déduit d'une adresse ?"
          : `Écrire ${rows.length} domaines déduits d'une adresse ?`}
      </p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-brand-d/80">
        Ce sont des propositions, pas des faits vérifiés. Aucune de ces adresses n&apos;a été
        appelée : un domaine déduit qui répond peut très bien appartenir à quelqu&apos;un
        d&apos;autre. Seules les lignes déduites d&apos;une adresse professionnelle sont
        concernées — aucune supposition tirée du nom n&apos;est écrite ici.
        {suspicious > 0 && (
          <>
            {" "}
            <b className="font-semibold">
              {suspicious} d&apos;entre elles ne ressemblent pas au nom de leur société
            </b>{" "}
            et sont listées en premier.
          </>
        )}
      </p>

      <ul className="mt-2 grid max-h-[180px] gap-0.5 overflow-y-auto text-[12px]">
        {rows.map((row) => (
          <li key={row.companyId} className="truncate">
            {row.suspicious && <span className="text-[#9A6410]">⚠ </span>}
            <b className="font-semibold">{row.company}</b> →{" "}
            <span className="font-mono text-[11.5px]">{row.value}</span>
          </li>
        ))}
      </ul>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className="rounded-control bg-brand px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-d disabled:opacity-50"
        >
          {busy ? "Écriture…" : rows.length === 1 ? "Écrire ce domaine" : `Écrire les ${rows.length} domaines`}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onCancel}
          className="rounded-control border border-line bg-surface px-3.5 py-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:bg-paper disabled:opacity-50"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
