"use client";

import { useRouter } from "next/navigation";
import type { StageWithAction } from "@/lib/api/reference";
import type { ReminderDelays } from "@/lib/domain/automation";
import type { PilotageSettings, SettingsListKind } from "@/lib/domain/types";
import type { AgentProfile } from "@/lib/api/agents";
import { BackupPanel } from "./backup-panel";
import { ListEditor } from "./list-editor";
import { PilotageForm } from "./pilotage-form";
import { RelancesForm } from "./relances-form";
import { SequenceEditor, type SequenceEditable } from "./sequence-editor";
import { TagsEditor } from "./tags-editor";
import { MaintenancePanel } from "./maintenance-panel";
import { CouncilPanel } from "./council-panel";
import { ShiftsPanel } from "./shifts-panel";
import { StagesEditor } from "./stages-editor";

interface SettingsViewProps {
  readonly sequences: readonly SequenceEditable[];
  readonly stages: readonly StageWithAction[];
  readonly dealCounts: Record<string, number>;
  readonly settings: PilotageSettings;
  readonly tokenBudget: number;
  readonly delays: ReminderDelays;
  readonly lists: Record<SettingsListKind, readonly string[]>;
  readonly tags: ReadonlyArray<{ value: string; count: number }>;
  readonly agents: readonly AgentProfile[];
}

const LIST_LABELS: Array<{ kind: SettingsListKind; label: string }> = [
  { kind: "owners", label: "Propriétaires" },
  { kind: "offers", label: "Offres" },
  { kind: "sources", label: "Sources" },
  { kind: "lifecycles", label: "Cycles de vie" },
];

export function SettingsView({
  sequences,
  stages,
  dealCounts,
  settings,
  tokenBudget,
  delays,
  lists,
  tags,
  agents,
}: SettingsViewProps) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="px-6 py-6">
      <header className="mb-5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Réglages</h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Ces valeurs pilotent le reste de l'application : seuils d'alerte, colonnes du
          Kanban, menus déroulants.
        </p>
      </header>

      <Section
        title="Conseil"
        hint="nom, rôle, photo et cadence de chaque agent — l'identifiant technique ne bouge pas"
      >
        <CouncilPanel agents={agents} />
      </Section>

      <Section
        title="Seuils et objectif"
        hint="pilotent la chaleur des affaires, les alertes et la colonne « dernière touche »"
      >
        <PilotageForm settings={settings} tokenBudget={tokenBudget} onSaved={refresh} />
      </Section>

      <Section
        title="Délais de relance"
        hint="pré-remplissent la date proposée après une interaction — rien n'est écrit sans vous"
      >
        <RelancesForm delays={delays} onSaved={refresh} />
      </Section>

      <Section title="Étapes du pipeline" hint="l'ordre ici est l'ordre des colonnes du Kanban">
        <StagesEditor stages={stages} dealCounts={dealCounts} onSaved={refresh} />
      </Section>

      <Section title="Listes éditables" hint="une valeur par ligne">
        <div className="grid gap-3 sm:grid-cols-2">
          {LIST_LABELS.map(({ kind, label }) => (
            <ListEditor
              key={kind}
              kind={kind}
              label={label}
              values={lists[kind]}
              onSaved={refresh}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Étiquettes"
        hint="renommer met à jour toutes les fiches ; supprimer efface l'étiquette, pas les contacts"
      >
        <TagsEditor tags={tags} onSaved={refresh} />
      </Section>

      <Section
        title="Séquences"
        hint="lancez-les depuis la fiche d'un contact, d'une société ou d'une affaire"
      >
        <div className="grid gap-3">
          {sequences.map((sequence) => (
            <SequenceEditor key={sequence.id} sequence={sequence} onSaved={refresh} />
          ))}
        </div>
      </Section>

      <Section
        title="Vacations des agents"
        hint="ce que chaque passage a coûté, et ce qu'il a produit — y compris les échecs"
      >
        <ShiftsPanel />
      </Section>

      <Section
        title="Corrections de données"
        hint="simulez d'abord — rien ne s'écrit sans confirmation, et le détail s'affiche avant"
      >
        <MaintenancePanel />
      </Section>

      <Section title="Sauvegarde" hint="exportez avant toute manipulation risquée">
        <BackupPanel onRestored={refresh} />
      </Section>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2 className="mb-2.5 flex flex-wrap items-baseline gap-2 font-display text-sm font-semibold">
        {title}
        {hint !== undefined && (
          <span className="text-[12px] font-normal text-muted">{hint}</span>
        )}
      </h2>
      {children}
    </section>
  );
}
