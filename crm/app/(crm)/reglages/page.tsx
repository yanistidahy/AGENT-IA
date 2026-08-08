import { SettingsView } from "@/components/settings/settings-view";
import {
  getPilotage,
  getReminderDelays,
  listOffers,
  listOwners,
  listSources,
  listStagesWithActions,
} from "@/lib/api/reference";
import { listSequences } from "@/lib/api/sequences";
import { listTags } from "@/lib/api/contacts";
import { prisma as db } from "@/lib/db";
import { stageDealCounts } from "@/lib/api/settings";
import { prisma } from "@/lib/db";
import { LIFECYCLES } from "@/lib/domain/types";

export const dynamic = "force-dynamic";

export default async function ReglagesPage() {
  const [
    sequences,
    stages,
    dealCounts,
    settings,
    delays,
    owners,
    offers,
    sources,
    lifecycleRows,
    tags,
    settingsRow,
  ] = await Promise.all([
      listSequences(),
      listStagesWithActions(),
      stageDealCounts(),
      getPilotage(),
      getReminderDelays(),
      listOwners(),
      listOffers(),
      listSources(),
      prisma.settingsList.findMany({
        where: { kind: "lifecycles" },
        orderBy: { position: "asc" },
        select: { value: true },
      }),
      listTags(),
      db.settings.findUnique({ where: { id: "singleton" } }),
    ]);

  const lifecycles = lifecycleRows.map((row) => row.value);

  return (
    <SettingsView
      sequences={sequences.map((sequence) => ({
        id: sequence.id,
        name: sequence.name,
        trigger: sequence.trigger,
        active: sequence.active,
        steps: sequence.steps.map((step) => ({
          day: step.day,
          channel: step.channel,
          label: step.label,
        })),
      }))}
      stages={stages}
      dealCounts={dealCounts}
      settings={settings}
      tokenBudget={settingsRow?.shiftTokenBudget ?? 4000}
      delays={delays}
      tags={tags}
      lists={{
        owners,
        offers,
        sources,
        // Repli sur l'union du domaine : la liste peut ne jamais avoir été peuplée.
        lifecycles: lifecycles.length > 0 ? lifecycles : [...LIFECYCLES],
      }}
    />
  );
}
