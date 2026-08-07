"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Icon } from "@/components/ui/icon";
import type { DealRecord } from "@/lib/api/deals";
import type { PilotageSettings } from "@/lib/domain/types";
import { DealDrawer } from "./deal-drawer";
import { DealForm, type DealFormOptions } from "./deal-form";
import { Fluxbar } from "./fluxbar";
import { KanbanBoard } from "./kanban-board";

interface PipelineViewProps extends DealFormOptions {
  /** Affaires en cours, plus les affaires gagnées du mois pour la colonne terminale. */
  readonly deals: readonly DealRecord[];
  readonly openDeals: readonly DealRecord[];
  readonly settings: PilotageSettings;
}

export function PipelineView({
  deals,
  openDeals,
  settings,
  ...options
}: PipelineViewProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<DealRecord | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = () => {
    setSelected(null);
    setCreating(false);
    router.refresh();
  };

  return (
    <div className="px-6 py-6">
      <header className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Pipeline</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Glissez une affaire d&apos;une colonne à l&apos;autre pour la faire avancer.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-control bg-flux px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-flux-d"
        >
          <Icon name="plus" size={15} />
          Nouvelle affaire
        </button>
      </header>

      <div className="mb-4">
        <Fluxbar deals={openDeals} stages={options.stages} />
      </div>

      <KanbanBoard
        deals={deals}
        stages={options.stages}
        settings={settings}
        onSelect={setSelected}
      />

      <DealDrawer
        {...options}
        deal={selected}
        settings={settings}
        onClose={() => setSelected(null)}
        onChanged={refresh}
      />

      <Drawer open={creating} title="Nouvelle affaire" onClose={() => setCreating(false)}>
        <DealForm
          {...options}
          deal={null}
          onCancel={() => setCreating(false)}
          onSaved={refresh}
        />
      </Drawer>
    </div>
  );
}
