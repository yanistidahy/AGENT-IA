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

export function DealsTable({
  deals,
  settings,
  sort,
  dir,
  onSort,
  onSelect,
}: DealsTableProps) {
  const now = new Date();

  if (deals.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface shadow-card">
        <EmptyState title="Aucune affaire ne correspond.">
          <span className="text-[13px]">
            Modifiez les filtres, ou créez une affaire pour alimenter le pipeline.
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
