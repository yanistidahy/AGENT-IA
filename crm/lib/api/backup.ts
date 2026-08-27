import { z } from "zod";
import { prisma } from "../db";

/**
 * Sauvegarde et restauration complètes, en JSON.
 *
 * Ce module existe pour la raison qui a motivé le correctif du seed : une base
 * peut se vider. Un export téléchargeable et une restauration qui remet tout en
 * place valent mieux qu'un espoir sur la persistance du volume.
 *
 * La restauration **remplace** l'intégralité des données. Elle passe donc dans
 * une transaction : si une seule ligne est refusée, rien n'est supprimé. C'est
 * exactement l'erreur qui a coûté une base de production.
 */

export const BACKUP_VERSION = 1;

export async function exportBackup(): Promise<Record<string, unknown>> {
  const [
    stages,
    companies,
    contacts,
    deals,
    activities,
    tasks,
    settings,
    settingsLists,
    sequences,
    sequenceSteps,
  ] = await Promise.all([
    prisma.stage.findMany({ orderBy: { position: "asc" } }),
    prisma.company.findMany(),
    prisma.contact.findMany(),
    prisma.deal.findMany(),
    prisma.activity.findMany(),
    prisma.task.findMany(),
    prisma.settings.findUnique({ where: { id: "singleton" } }),
    prisma.settingsList.findMany(),
    prisma.sequence.findMany(),
    prisma.sequenceStep.findMany(),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stages,
    companies,
    contacts,
    deals,
    activities,
    tasks,
    settings,
    settingsLists,
    sequences,
    sequenceSteps,
  };
}

/**
 * Formes attendues à la restauration.
 *
 * **Toute colonne absente d'ici est effacée par une restauration.** Zod retire
 * les clés qu'il ne connaît pas, et les deux chemins réels — la route et le
 * planificateur — valident *avant* d'appeler `restoreBackup()`. Une colonne
 * oubliée traverse donc l'export intacte, disparaît à la validation, et la
 * ligne est recréée avec la valeur par défaut du schéma Prisma. En silence.
 *
 * C'est ce qui s'est produit en production au jalon 42 : la configuration SMTP
 * et IMAP, les statuts saisis, les motifs de perte, les étiquettes, les miroirs
 * de recherche et **les issues d'interaction** ont été remis à zéro par une
 * restauration, sans un mot. `tests/backup-columns.test.ts` interdit la
 * rechute — il échoue si une colonne du schéma Prisma manque ici.
 *
 * Les colonnes ajoutées après coup sont **optionnelles** : une sauvegarde plus
 * ancienne ne peut pas porter ce qui n'existait pas quand elle a été prise, et
 * la refuser rendrait tout le filet inutile au moment où l'on en a besoin.
 *
 * Elles sont explicites plutôt que permissives pour deux raisons : le typage de
 * `createMany` l'exige, et surtout **JSON n'a pas de type date**. Un export
 * relu tel quel passerait des chaînes ISO là où Prisma attend des `Date`, et la
 * restauration échouerait — ou pire, écrirait des dates fausses. `z.coerce.date()`
 * fait la conversion à la frontière, au même endroit que le reste du projet.
 */
const day = z.coerce.date();
const optionalDay = z.coerce.date().nullable().optional();
const text = z.string();
const optionalText = z.string().optional();

const stageRow = z.object({
  id: z.string(),
  name: text,
  color: text,
  prob: z.number().int(),
  position: z.number().int(),
  // Optionnels : une sauvegarde antérieure à l'automatisation reste restaurable.
  nextActionLabel: optionalText,
  nextActionDays: z.number().int().optional(),
  /** Critère de sortie du jalon 22. */
  exitCriterion: optionalText,
});

const companyRow = z.object({
  id: z.string(),
  name: text,
  domain: optionalText,
  size: optionalText,
  industry: optionalText,
  loc: optionalText,
  desc: optionalText,
  createdAt: day,
  /** Miroir de recherche : sans lui, la société devient introuvable. */
  searchText: optionalText,
});

const contactRow = z.object({
  id: z.string(),
  firstName: text,
  lastName: text,
  title: optionalText,
  dep: optionalText,
  email: optionalText,
  phone: optionalText,
  linkedin: optionalText,
  lifecycle: text,
  source: optionalText,
  owner: optionalText,
  notes: optionalText,
  createdAt: day,
  lastContact: optionalDay,
  nextReminder: optionalDay,
  companyId: z.string().nullable().optional(),
  /* Ajoutées après le jalon 5, et perdues à chaque restauration jusqu'au 42. */
  tag: optionalText,
  /** Motif de perte — porte aussi l'opposition ferme au démarchage. */
  lostReason: optionalText,
  /** Statut saisi à la main (jalon 13) : il l'emporte sur le calcul. */
  status: optionalText,
  statusSetAt: optionalDay,
  website: optionalText,
  searchText: optionalText,
  emailCount: z.number().int().optional(),
  lastEmailAt: optionalDay,
});

const dealRow = z.object({
  id: z.string(),
  name: text,
  amount: z.number().int(),
  owner: text,
  offer: optionalText,
  status: text,
  prob: z.number().int().nullable().optional(),
  notes: optionalText,
  // Facultatif comme les autres ajouts : une sauvegarde antérieure au jalon 47
  // ne peut pas porter ce que la colonne n'avait pas encore, et la refuser
  // rendrait le filet inutile au moment précis où l'on en a besoin.
  lostReason: optionalText,
  createdAt: day,
  expectedClose: optionalDay,
  lastActivityAt: optionalDay,
  stageSince: optionalDay,
  closedAt: optionalDay,
  stageId: z.string(),
  companyId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
  searchText: optionalText,
});

const activityRow = z.object({
  id: z.string(),
  type: text,
  date: day,
  owner: text,
  notes: optionalText,
  duration: z.number().int().nullable().optional(),
  createdAt: day,
  contactId: z.string().nullable().optional(),
  dealId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  /**
   * **L'issue de l'échange.** Sans elle, une restauration efface la mémoire de
   * qui a répondu : le taux de réponse, l'entonnoir des emails et la détection
   * de réponse retombent tous à zéro alors que les interactions sont là.
   */
  outcome: optionalText,
});

const taskRow = z.object({
  id: z.string(),
  title: text,
  due: day,
  priority: text,
  owner: text,
  done: z.boolean(),
  auto: z.boolean().optional(),
  autoKey: z.string().nullable().optional(),
  doneAt: optionalDay,
  createdAt: day,
  contactId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  dealId: z.string().nullable().optional(),
});

/**
 * La ligne de réglages, **en entier**.
 *
 * C'est la table qui a le plus grandi depuis le jalon 5 — onze colonnes alors,
 * quarante-quatre aujourd'hui — et c'est elle qui a coûté le plus cher : la
 * configuration SMTP et IMAP y vit, donc une restauration coupait l'envoi et
 * le relevé des réponses d'un seul coup, sans rien afficher.
 */
const settingsRow = z.object({
  id: z.string(),
  staleDays: z.number().int(),
  coldDays: z.number().int(),
  objectifMensuel: z.number().int(),
  relanceApresAppel: z.number().int().optional(),
  relanceApresEmail: z.number().int().optional(),
  relanceApresDemo: z.number().int().optional(),
  relanceApresReunion: z.number().int().optional(),
  relanceApresLinkedin: z.number().int().optional(),
  relanceApresNote: z.number().int().optional(),
  notifs: z.boolean(),
  updatedAt: day,

  /* — objectifs hebdomadaires (jalon 40) — */
  objectifAppelsSemaine: z.number().int().optional(),
  objectifEmailsSemaine: z.number().int().optional(),

  /* — messagerie : envoi (jalons 32 à 35) — */
  smtpHost: optionalText,
  smtpPort: z.number().int().optional(),
  smtpEncryption: optionalText,
  smtpUser: optionalText,
  smtpFrom: optionalText,
  smtpFromName: optionalText,
  signName: optionalText,
  signTitle: optionalText,
  demoLabel: optionalText,
  demoUrl: optionalText,

  /* — messagerie : copie « Envoyés », suivi, plafonds (jalons 37 et 38) — */
  imapHost: optionalText,
  imapPort: z.number().int().optional(),
  imapEncryption: optionalText,
  imapSentMailbox: optionalText,
  imapCopyEnabled: z.boolean().optional(),
  trackOpens: z.boolean().optional(),
  openRetentionMonths: z.number().int().optional(),
  sendPerHour: z.number().int().optional(),
  sendPerDay: z.number().int().optional(),
  sendLimitNotice: optionalText,
  sendLimitNoticeAt: optionalDay,

  /* — relevé de la boîte de réception (jalon 41) — */
  inboxPollEnabled: z.boolean().optional(),
  lastInboxPollAt: optionalDay,

  /* — conseil et coûts (jalons 14, 36) — */
  shiftTokenBudget: z.number().int().optional(),
  modelDraft: optionalText,
  modelRevision: optionalText,
  modelChat: optionalText,
  modelShift: optionalText,
  monthlyBudgetCents: z.number().int().optional(),
  lastCronAt: optionalDay,
});

const settingsListRow = z.object({
  id: z.string(),
  kind: text,
  value: text,
  position: z.number().int(),
});

const sequenceRow = z.object({
  id: z.string(),
  name: text,
  trigger: text,
  active: z.boolean(),
});

const sequenceStepRow = z.object({
  id: z.string(),
  day: z.number().int(),
  channel: text,
  label: text,
  position: z.number().int(),
  sequenceId: z.string(),
});

export const backupSchema = z.object({
  version: z.number().int(),
  stages: z.array(stageRow),
  companies: z.array(companyRow),
  contacts: z.array(contactRow),
  deals: z.array(dealRow),
  activities: z.array(activityRow),
  tasks: z.array(taskRow),
  settings: settingsRow.nullable().optional(),
  settingsLists: z.array(settingsListRow),
  sequences: z.array(sequenceRow),
  sequenceSteps: z.array(sequenceStepRow),
});

export type BackupPayload = z.infer<typeof backupSchema>;

export type RestoreResult =
  | { readonly ok: true; readonly counts: Record<string, number> }
  | { readonly ok: false; readonly message: string };

export async function restoreBackup(payload: BackupPayload): Promise<RestoreResult> {
  if (payload.version !== BACKUP_VERSION) {
    return {
      ok: false,
      message: `Sauvegarde en version ${payload.version}, cette application attend la version ${BACKUP_VERSION}.`,
    };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // Ordre de suppression contraint par les clés étrangères.
        await tx.activity.deleteMany();
        await tx.task.deleteMany();
        await tx.deal.deleteMany();
        await tx.contact.deleteMany();
        await tx.company.deleteMany();
        await tx.stage.deleteMany();
        await tx.sequenceStep.deleteMany();
        await tx.sequence.deleteMany();
        await tx.settingsList.deleteMany();
        await tx.settings.deleteMany();

        await tx.stage.createMany({ data: payload.stages });
        await tx.company.createMany({ data: payload.companies });
        await tx.contact.createMany({ data: payload.contacts });
        await tx.deal.createMany({ data: payload.deals });
        await tx.activity.createMany({ data: payload.activities });
        await tx.task.createMany({ data: payload.tasks });
        await tx.sequence.createMany({ data: payload.sequences });
        await tx.sequenceStep.createMany({ data: payload.sequenceSteps });
        await tx.settingsList.createMany({ data: payload.settingsLists });
        if (payload.settings != null) {
          await tx.settings.create({ data: payload.settings });
        }
      },
      { timeout: 120_000, maxWait: 20_000 },
    );
  } catch (error) {
    console.error("[backup] restauration refusée", error);
    return {
      ok: false,
      message:
        "La restauration a été refusée par la base ; aucune donnée n'a été supprimée. " +
        "Vérifiez que le fichier vient bien de cette application.",
    };
  }

  const counts = {
    étapes: await prisma.stage.count(),
    sociétés: await prisma.company.count(),
    contacts: await prisma.contact.count(),
    affaires: await prisma.deal.count(),
    interactions: await prisma.activity.count(),
    tâches: await prisma.task.count(),
    séquences: await prisma.sequence.count(),
  };

  return { ok: true, counts };
}
