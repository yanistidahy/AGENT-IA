import { z } from "zod";
import { prisma } from "../db";
import { generateSequenceTasks } from "../domain/sequences";
import { SEQUENCE_CHANNELS, TASK_PRIORITIES, type SequenceChannel } from "../domain/types";
import { toTaskRecord, taskInclude, type TaskRecord } from "./tasks";

/** Accès aux séquences et à leur déclenchement. */

export interface SequenceStepRecord {
  readonly id: string;
  readonly day: number;
  readonly channel: SequenceChannel;
  readonly label: string;
  readonly position: number;
}

export interface SequenceRecord {
  readonly id: string;
  readonly name: string;
  readonly trigger: string;
  readonly active: boolean;
  readonly steps: readonly SequenceStepRecord[];
}

function toChannel(value: string): SequenceChannel {
  const match = SEQUENCE_CHANNELS.find((candidate) => candidate === value);
  return match ?? "email";
}

export async function listSequences(): Promise<SequenceRecord[]> {
  const rows = await prisma.sequence.findMany({
    include: { steps: { orderBy: { position: "asc" } } },
    orderBy: { name: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    trigger: row.trigger,
    active: row.active,
    steps: row.steps.map((step) => ({
      id: step.id,
      day: step.day,
      channel: toChannel(step.channel),
      label: step.label,
      position: step.position,
    })),
  }));
}

export async function getSequence(id: string): Promise<SequenceRecord | null> {
  const all = await listSequences();
  return all.find((sequence) => sequence.id === id) ?? null;
}

const stepSchema = z.object({
  day: z.number().int().min(0, "Le décalage ne peut être négatif"),
  channel: z.enum(SEQUENCE_CHANNELS, { error: "Canal inconnu" }),
  label: z.string().trim().min(1, "Décrivez l'étape"),
});

export const updateSequenceSchema = z
  .object({
    name: z.string().trim().min(1, "Nommez la séquence").optional(),
    trigger: z.string().trim().optional(),
    active: z.boolean().optional(),
    steps: z.array(stepSchema).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Aucun champ à mettre à jour",
  });

export type UpdateSequenceInput = z.infer<typeof updateSequenceSchema>;

/**
 * Mise à jour d'une séquence.
 *
 * Les étapes sont remplacées en bloc, dans une transaction : gérer l'ajout, le
 * retrait et le réordonnancement étape par étape depuis l'éditeur demanderait un
 * suivi d'identifiants côté client pour un gain nul — une séquence compte trois
 * à six lignes. Les tâches déjà créées par un lancement passé ne bougent pas :
 * elles ont leur vie propre une fois écrites.
 */
export async function updateSequence(
  id: string,
  input: UpdateSequenceInput,
): Promise<SequenceRecord | null> {
  const existing = await prisma.sequence.findUnique({ where: { id }, select: { id: true } });
  if (existing === null) return null;

  await prisma.$transaction(async (tx) => {
    await tx.sequence.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.trigger === undefined ? {} : { trigger: input.trigger }),
        ...(input.active === undefined ? {} : { active: input.active }),
      },
    });

    if (input.steps !== undefined) {
      await tx.sequenceStep.deleteMany({ where: { sequenceId: id } });
      await tx.sequenceStep.createMany({
        data: input.steps.map((step, index) => ({
          sequenceId: id,
          day: step.day,
          channel: step.channel,
          label: step.label,
          position: index,
        })),
      });
    }
  });

  return getSequence(id);
}

export const runSequenceSchema = z
  .object({
    owner: z.string().trim().min(1, "Le propriétaire est obligatoire"),
    start: z
      .union([z.string(), z.date()])
      .transform((value, ctx) => {
        if (value instanceof Date) return value;
        const parsed = new Date(value.trim());
        if (Number.isNaN(parsed.getTime())) {
          ctx.addIssue({ code: "custom", message: "Date de départ invalide" });
          return z.NEVER;
        }
        return parsed;
      }),
    priority: z.enum(TASK_PRIORITIES, { error: "Priorité inconnue" }).optional(),
    contactId: z.string().trim().min(1).nullable().optional(),
    companyId: z.string().trim().min(1).nullable().optional(),
    dealId: z.string().trim().min(1).nullable().optional(),
  })
  .refine(
    (value) =>
      [value.contactId, value.companyId, value.dealId].some(
        (id) => typeof id === "string" && id !== "",
      ),
    { message: "Choisissez un contact, une société ou une affaire" },
  );

export type RunSequenceInput = z.infer<typeof runSequenceSchema>;

export type RunSequenceResult =
  | { readonly ok: true; readonly tasks: readonly TaskRecord[] }
  | { readonly ok: false; readonly reason: "not_found" | "inactive" };

/**
 * Lance une séquence sur une fiche : chaque étape devient une tâche datée.
 *
 * Le titre porte le nom de la séquence en préfixe — « Relance J+3 » seul, dans
 * une liste de trente tâches, ne dit pas d'où il vient ni quoi arrêter si le
 * prospect répond.
 *
 * Le développement des étapes vient de `generateSequenceTasks` (domaine, pur,
 * testé) ; on n'écrit ici que le résultat, en une transaction.
 */
export async function runSequence(
  id: string,
  input: RunSequenceInput,
): Promise<RunSequenceResult> {
  const sequence = await getSequence(id);
  if (sequence === null) return { ok: false, reason: "not_found" };
  if (!sequence.active) return { ok: false, reason: "inactive" };

  const drafts = generateSequenceTasks(sequence, input.start, {
    owner: input.owner,
    priority: input.priority ?? "normale",
    contactId: input.contactId ?? null,
    companyId: input.companyId ?? null,
    dealId: input.dealId ?? null,
  });

  if (drafts.length === 0) return { ok: true, tasks: [] };

  const created = await prisma.$transaction(
    drafts.map((draft) =>
      prisma.task.create({
        data: {
          title: `${sequence.name} · ${draft.title}`,
          due: draft.due,
          priority: draft.priority,
          owner: draft.owner,
          contactId: draft.contactId,
          companyId: draft.companyId,
          dealId: draft.dealId,
        },
        include: taskInclude,
      }),
    ),
  );

  return { ok: true, tasks: created.map(toTaskRecord) };
}
