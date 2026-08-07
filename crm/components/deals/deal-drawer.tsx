"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Eyebrow, HeatTag, StageTag, StatusTag } from "@/components/ui/primitives";
import type { DealRecord } from "@/lib/api/deals";
import { moveDealStage } from "@/lib/client/deals-api";
import { daysSince } from "@/lib/domain/dates";
import { dealHeat, dealProb, weightedValue } from "@/lib/domain/pipeline";
import type { PilotageSettings } from "@/lib/domain/types";
import { formatDate, money, moneyShort } from "@/lib/format";
import { DealForm, type DealFormOptions } from "./deal-form";

interface DealDrawerProps extends DealFormOptions {
  readonly deal: DealRecord | null;
  readonly settings: PilotageSettings;
  readonly onClose: () => void;
  readonly onChanged: () => void;
}

export function DealDrawer({
  deal,
  settings,
  onClose,
  onChanged,
  ...options
}: DealDrawerProps) {
  const [editing, setEditing] = useState(false);
  const [busyStage, setBusyStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (deal === null) return null;

  const now = new Date();
  const heat = dealHeat(deal, settings, now);
  const idle = daysSince(deal.lastActivityAt ?? deal.createdAt, now);
  const probability = dealProb(deal, deal.stage);

  const move = async (stageId: string) => {
    setBusyStage(stageId);
    setError(null);
    const result = await moveDealStage(deal.id, stageId);
    setBusyStage(null);
    if (result.ok) onChanged();
    else setError(result.message);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={deal.name}
      subtitle={`${money(deal.amount)} · ${deal.company?.name ?? "Sans société"}`}
      footer={
        editing ? undefined : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-control bg-ink px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-ink-3"
          >
            Modifier
          </button>
        )
      }
    >
      {editing ? (
        <DealForm
          {...options}
          deal={deal}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            <StageTag stage={deal.stage} />
            <StatusTag status={deal.status} />
            {deal.status === "open" && <HeatTag heat={heat} days={idle} />}
            <span className="inline-flex items-center rounded-full bg-paper px-2 py-[3px] text-[11.5px] font-semibold text-muted">
              {deal.owner}
            </span>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-card border border-line bg-surface-2 px-4 py-3">
              <Eyebrow>Montant</Eyebrow>
              <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums">
                {moneyShort(deal.amount)}
              </div>
            </div>
            <div className="rounded-card border border-line bg-surface-2 px-4 py-3">
              <Eyebrow>Pondéré</Eyebrow>
              <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums">
                {moneyShort(weightedValue(deal, deal.stage))}
              </div>
              <div className="mt-1 text-[12px] text-muted">{probability} % de probabilité</div>
            </div>
          </div>

          <dl className="grid grid-cols-[130px_1fr] gap-x-3.5 gap-y-2.5 text-[13.5px]">
            <Row label="Contact">
              {deal.contact === null
                ? "—"
                : `${deal.contact.firstName} ${deal.contact.lastName}`}
            </Row>
            <Row label="Offre">{deal.offer === "" ? "—" : deal.offer}</Row>
            <Row label="Créée le">{formatDate(deal.createdAt)}</Row>
            <Row label="Clôture prévue">{formatDate(deal.expectedClose)}</Row>
            {deal.closedAt !== null && (
              <Row label="Clôturée le">{formatDate(deal.closedAt)}</Row>
            )}
            <Row label="Âge">{daysSince(deal.createdAt, now)} jours</Row>
          </dl>

          {deal.notes !== "" && (
            <div className="mt-4 rounded-card border border-line bg-surface-2 px-3.5 py-3">
              <Eyebrow>Notes</Eyebrow>
              <p className="mt-1 text-[13px] leading-relaxed">{deal.notes}</p>
            </div>
          )}

          <h3 className="mt-6 mb-2.5 font-display text-sm font-semibold">Faire avancer</h3>
          <div className="flex flex-wrap gap-2">
            {options.stages.map((stage) => (
              <button
                key={stage.id}
                type="button"
                disabled={busyStage !== null || stage.id === deal.stageId}
                onClick={() => void move(stage.id)}
                className="rounded-control border border-line px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors hover:bg-surface-2 disabled:opacity-45"
                style={stage.id === deal.stageId ? { borderColor: stage.color, color: stage.color } : undefined}
              >
                {busyStage === stage.id ? "…" : stage.name}
              </button>
            ))}
          </div>

          {error !== null && (
            <p className="mt-3 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
              {error}
            </p>
          )}

          <h3 className="mt-6 mb-2.5 font-display text-sm font-semibold">
            Historique des interactions
          </h3>
          <p className="rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
            Les interactions arrivent au jalon 4. Les changements d'étape y sont déjà
            consignés côté base : chaque déplacement écrit une note système.
          </p>
        </>
      )}
    </Drawer>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="pt-0.5 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        {label}
      </dt>
      <dd className="font-medium break-words">{children}</dd>
    </>
  );
}
