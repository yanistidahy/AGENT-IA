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
  createdAt: day,
  expectedClose: optionalDay,
  lastActivityAt: optionalDay,
  closedAt: optionalDay,
  stageId: z.string(),
  companyId: z.string().nullable().optional(),
  contactId: z.string().nullable().optional(),
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
});

const taskRow = z.object({
  id: z.string(),
  title: text,
  due: day,
  priority: text,
  owner: text,
  done: z.boolean(),
  doneAt: optionalDay,
  createdAt: day,
  contactId: z.string().nullable().optional(),
  companyId: z.string().nullable().optional(),
  dealId: z.string().nullable().optional(),
});

const settingsRow = z.object({
  id: z.string(),
  staleDays: z.number().int(),
  coldDays: z.number().int(),
  objectifMensuel: z.number().int(),
  notifs: z.boolean(),
  updatedAt: day,
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
