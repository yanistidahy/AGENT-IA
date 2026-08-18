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
import { listAgentProfiles } from "@/lib/api/agents";
import { readMailStatus, PASSWORD_ENV } from "@/lib/api/mail";
import { listSignatories } from "@/lib/api/signatories";
import { LIFECYCLES } from "@/lib/domain/types";
import { readUsageReport } from "@/lib/api/usage";
import { CostPanel } from "@/components/settings/cost-panel";
import { DEFAULT_MODELS } from "@/lib/domain/model-pricing";

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
    agents,
    mail,
    signatories,
    usage,
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
      listAgentProfiles(),
      readMailStatus(),
      listSignatories(),
      readUsageReport(),
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
      agents={agents}
      mail={mail}
      passwordEnv={PASSWORD_ENV}
      signatories={signatories}
      stages={stages}
      dealCounts={dealCounts}
      settings={settings}
      tokenBudget={settingsRow?.shiftTokenBudget ?? 4000}
      modelSettings={{
        draft: settingsRow?.modelDraft ?? DEFAULT_MODELS.draft,
        revision: settingsRow?.modelRevision ?? DEFAULT_MODELS.revision,
        chat: settingsRow?.modelChat ?? DEFAULT_MODELS.chat,
        shift: settingsRow?.modelShift ?? DEFAULT_MODELS.shift,
        monthlyBudgetCents: settingsRow?.monthlyBudgetCents ?? 2000,
      }}
      costs={<CostPanel report={usage} />}
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
