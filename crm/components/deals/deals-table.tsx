"use client";

import { EmptyState, HeatTag, StageTag, StatusTag } from "@/components/ui/primitives";
import type { DealRecord } from "@/lib/api/deals";
import { daysSince } from "@/lib/domain/dates";
import { dealHeat, weightedValue } from "@/lib/domain/pipeline";
import type { PilotageSettings } from "@/lib/domain/types";
import { formatDate, money } from "@/lib/format";

export type SortKey = "name" | "amount" | "expectedClose" | "lastActivityAt" | "owner";

interface DealsTableProps {
  readonly deals: readonly DealRecord[];
  readonly settings: PilotageSettings;
  readonly sort: SortKey | undefined;
  readonly dir: "asc" | "desc";
  readonly onSort: (key: SortKey) => void;
  readonly onSelect: (deal: DealRecord) => void;
  /** Filtre de statut actif, pour expliquer une liste vide par sa règle. */
  readonly status: string;
  readonly searching: boolean;
  /** Nombre total d'affaires, tous statuts — distingue « vide » de « filtré ». */
  readonly total: number;
}

const COLUMNS: ReadonlyArray<{ key: SortKey | null; label: string; numeric?: boolean }> = [
  { key: "name", label: "Affaire" },
  { key: null, label: "Société" },
  { key: null, label: "Étape" },
  { key: "amount", label: "Montant", numeric: true },
  { key: null, label: "Pondéré", numeric: true },
  { key: "expectedClose", label: "Clôture prévue" },
  { key: "lastActivityAt", label: "Fraîcheur" },
  { key: "owner", label: "Propriétaire" },
];

/** Une liste vide dit laquelle de ses règles l'a produite, pas « rien à afficher ». */
function emptyReason(status: string, searching: boolean, total: number): string {
  // Le pipeline entièrement vide passe avant tout le reste : dire « toutes sont
  // gagnées ou perdues » alors qu'aucune affaire n'existe serait faux, et c'est
  // exactement l'écran que voit quelqu'un qui démarre.
  if (total === 0) {
    return "Aucune affaire n'existe encore. Créez la première avec « Nouvelle affaire », ou chargez le jeu de démonstration.";
  }
  if (searching) {
    return "Aucune affaire ne porte ce texte dans son nom ni dans celui de sa société. Videz la recherche pour revoir la liste.";
  }
  switch (status) {
    case "open":
      return "Aucune affaire en cours : toutes sont gagnées ou perdues. Choisissez « Toutes » pour voir l'historique, ou créez une affaire.";
    case "won":
      return "Aucune affaire gagnée pour l'instant. Une affaire devient gagnée en atteignant l'étape à 100 %.";
    case "lost":
      return "Aucune affaire perdue — bonne nouvelle.";
    default:
      return "Le pipeline est vide. Créez une première affaire, ou chargez le jeu de démonstration.";
  }
}

export function DealsTable({
  deals,
  settings,
  sort,
  dir,
  onSort,
  onSelect,
  status,
  searching,
  total,
}: DealsTableProps) {
  const now = new Date();

  if (deals.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface shadow-card">
        <EmptyState title="Aucune affaire ne correspond.">
          <span className="mx-auto block max-w-[54ch] text-[13px] leading-relaxed">
            {emptyReason(status, searching, total)}
          </span>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {COLUMNS.map(({ key, label, numeric }) => (
              <th
                key={label}
                scope="col"
                className={`border-b border-line bg-surface-2 px-3.5 py-2.5 font-mono text-[9.5px] font-medium tracking-[0.12em] whitespace-nowrap text-muted uppercase ${
                  numeric === true ? "text-right" : "text-left"
                }`}
              >
                {key === null ? (
                  label
                ) : (
                  <button
                    type="button"
                    onClick={() => onSort(key)}
                    className="uppercase transition-colors hover:text-ink"
                  >
                    {label}
                    {sort === key && (dir === "desc" ? " ↓" : " ↑")}
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deals.map((deal) => {
            const idle = daysSince(deal.lastActivityAt ?? deal.createdAt, now);
            return (
              <tr
                key={deal.id}
                onClick={() => onSelect(deal)}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(deal);
                  }
                }}
                className="cursor-pointer transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
              >
                <td className="border-b border-line-2 px-3.5 py-3">
                  <span className="font-semibold">{deal.name}</span>
                  <br />
                  <span className="text-[12.5px] text-muted">{deal.offer || "—"}</span>
                </td>
                <td className="border-b border-line-2 px-3.5 py-3">
                  {deal.company?.name ?? "—"}
                </td>
                <td className="border-b border-line-2 px-3.5 py-3">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StageTag stage={deal.stage} />
                    {deal.status !== "open" && <StatusTag status={deal.status} />}
                  </span>
                </td>
                <td className="border-b border-line-2 px-3.5 py-3 text-right font-mono font-semibold tabular-nums">
                  {money(deal.amount)}
                </td>
                <td className="border-b border-line-2 px-3.5 py-3 text-right font-mono text-muted tabular-nums">
                  {money(Math.round(weightedValue(deal, deal.stage)))}
                </td>
                <td className="border-b border-line-2 px-3.5 py-3 font-mono text-[12.5px] text-muted">
                  {formatDate(deal.expectedClose)}
                </td>
                <td className="border-b border-line-2 px-3.5 py-3">
                  {deal.status === "open" ? (
                    <HeatTag heat={dealHeat(deal, settings, now)} days={idle} />
                  ) : (
                    <span className="text-[12.5px] text-muted">—</span>
                  )}
                </td>
                <td className="border-b border-line-2 px-3.5 py-3 text-[12.5px] text-muted">
                  {deal.owner}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
