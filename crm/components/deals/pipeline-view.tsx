"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Icon } from "@/components/ui/icon";
import type { DealRecord } from "@/lib/api/deals";
import type { SequenceOption } from "@/components/activities/run-sequence";
import type { Alert, PilotageSettings } from "@/lib/domain/types";
import { DealDrawer } from "./deal-drawer";
import { DealForm, type DealFormOptions } from "./deal-form";
import { Fluxbar } from "./fluxbar";
import { KanbanBoard } from "./kanban-board";

interface PipelineViewProps extends DealFormOptions {
  /** Affaires en cours, plus les affaires gagnées du mois pour la colonne terminale. */
  readonly deals: readonly DealRecord[];
  readonly openDeals: readonly DealRecord[];
  readonly settings: PilotageSettings;
  readonly sequences: readonly SequenceOption[];
  readonly alerts: readonly Alert[];
  /** Affaires perdues, tous mois confondus — elles ont quitté le tableau. */
  readonly lostCount: number;
}

export function PipelineView({
  deals,
  openDeals,
  settings,
  sequences,
  alerts,
  lostCount,
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
          {/* Le glisser-déposer n'existe pas au doigt : sur téléphone, la
              phrase dirait un geste impossible. La fiche sait changer l'étape. */}
          <p className="mt-0.5 text-[13px] text-muted max-lg:hidden">
            Glissez une affaire d&apos;une colonne à l&apos;autre pour la faire avancer.
          </p>
          <p className="mt-0.5 text-[13px] text-muted lg:hidden">
            Les étapes se suivent de haut en bas — ouvrez une affaire pour la faire avancer.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-control bg-brand px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-d"
        >
          <Icon name="plus" size={15} />
          Nouvelle affaire
        </button>
      </header>

      <div className="mb-4">
        <Fluxbar deals={openDeals} stages={options.stages} />
      </div>

      {/* Quitter le pipeline n'est pas disparaître : le compteur garde une porte
          ouverte vers ce qu'on a renoncé à suivre. Muet à zéro — un « 0 perdue »
          permanent finirait par ne plus rien vouloir dire. */}
      {lostCount > 0 && (
        <p className="mb-3 text-[12.5px] text-muted">
          {lostCount} affaire{lostCount > 1 ? "s" : ""} perdue{lostCount > 1 ? "s" : ""} —{" "}
          <Link
            href="/affaires?status=lost"
            className="font-semibold text-brand-d hover:underline"
          >
            les revoir
          </Link>
        </p>
      )}

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
        sequences={sequences}
        alerts={
          selected === null
            ? []
            : alerts.filter(
                (alert) => alert.targetType === "deal" && alert.targetId === selected.id,
              )
        }
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
