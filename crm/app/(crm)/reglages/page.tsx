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
import { readImapStatus } from "@/lib/api/imap";
import { inboxHealth } from "@/lib/api/inbox-health";
import { readTrackingConfig } from "@/lib/api/email-sends";
import { readLimits } from "@/lib/api/send-rate";
import { listSequences as listEmailSequences } from "@/lib/api/email-sequences";
import { listSignatories } from "@/lib/api/signatories";
import { LIFECYCLES } from "@/lib/domain/types";
import { readUsageReport } from "@/lib/api/usage";
import { CostPanel } from "@/components/settings/cost-panel";
import { OpenAuditPanel } from "@/components/settings/open-audit-panel";
import { readOpenAudit } from "@/lib/api/open-audit";
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

  // Lus après `mail` : l'état IMAP dépend de l'identifiant et du secret SMTP.
  const imap = await readImapStatus(mail, mail.passwordSet);
  // Lu après `imap` : « configuré » veut dire que le relevé pourrait tourner,
  // ce qui dépend de l'hôte, de l'identifiant et du secret.
  const inbox = await inboxHealth(imap.ready);
  const tracking = await readTrackingConfig();
  const limits = await readLimits();
  const openAudit = await readOpenAudit();
  // Recopié en structures muables : le panneau édite la liste sur place, et un
  // `readonly` du service n'a pas à imposer sa forme au formulaire.
  const emailSequences = (await listEmailSequences()).map((sequence) => ({
    ...sequence,
    steps: sequence.steps.map((step) => ({ ...step })),
    unlock: { ...sequence.unlock },
  }));

  const lifecycles = lifecycleRows.map((row) => row.value);

  return (
    <>
      {/*
        Les réglages sont un écran de bureau, et il le dit. Corrections de
        maintenance, éditeur de séquences, relecture des domaines : tout ici
        écrit en base après relecture ligne à ligne — un travail qui demande de
        voir ce qu'on valide, pas un écran rendu cassé à 390 px. Le contenu
        reste dans le DOM (`lg` le rend) : aucune « version mobile » séparée,
        la même page dit simplement où elle se travaille.
      */}
      <div className="px-5 py-10 lg:hidden">
        <div className="mx-auto max-w-[42ch] rounded-card border border-line bg-surface px-5 py-6 text-center shadow-card">
          <b className="mb-1.5 block font-display text-[16px]">
            Cet écran demande un écran large
          </b>
          <p className="text-[13.5px] leading-relaxed text-muted">
            Les réglages — corrections de données, séquences, relecture des
            domaines — se valident ligne à ligne. Ouvrez cette page depuis un
            ordinateur ; le reste du CRM fonctionne sur ce téléphone.
          </p>
        </div>
      </div>

      <div className="max-lg:hidden">
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
      imap={imap}
      inbox={{
        enabled: inbox.enabled,
        configured: inbox.configured,
        lastPollAt: inbox.lastPollAt?.toISOString() ?? null,
        stale: inbox.stale,
        hours: inbox.hours,
      }}
      tracking={tracking}
      limits={limits}
      emailSequences={emailSequences}
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
      opens={<OpenAuditPanel audit={openAudit} />}
      delays={delays}
      targets={{
        calls: settingsRow?.objectifAppelsSemaine ?? 0,
        emails: settingsRow?.objectifEmailsSemaine ?? 0,
      }}
      tags={tags}
      lists={{
        owners,
        offers,
        sources,
        // Repli sur l'union du domaine : la liste peut ne jamais avoir été peuplée.
        lifecycles: lifecycles.length > 0 ? lifecycles : [...LIFECYCLES],
      }}
    />
      </div>
    </>
  );
}
