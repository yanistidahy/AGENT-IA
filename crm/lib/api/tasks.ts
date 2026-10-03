import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { toTaskPriority } from "../domain/guards";
import { DEFAULT_TASK_KIND, toTaskKind } from "../domain/task-kind";
import { taskTarget, type TaskTargetType } from "../domain/tasks";
import type { TaskPriority } from "../domain/types";
import { clearReminderAfterTask } from "./automation";
import { logActivity } from "./activities";
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from "./task-schemas";
import { contactTitle } from "../domain/contact-identity";

/** Accès aux tâches. Même motif de couche de service que les autres entités. */

export interface TaskTargetView {
  readonly type: TaskTargetType;
  readonly id: string;
  readonly label: string;
  /** Lien vers la vue qui ouvre la fiche concernée. */
  readonly href: string;
}

export interface TaskRecord {
  readonly id: string;
  readonly title: string;
  readonly due: Date;
  readonly priority: TaskPriority;
  readonly owner: string;
  readonly done: boolean;
  readonly doneAt: Date | null;
  readonly createdAt: Date;
  readonly contactId: string | null;
  readonly companyId: string | null;
  readonly dealId: string | null;
  readonly target: TaskTargetView | null;
}

export const taskInclude = {
  contact: { select: { id: true, firstName: true, lastName: true } },
  company: { select: { id: true, name: true } },
  deal: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

export type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

/**
 * Cible affichable d'une tâche.
 *
 * `taskTarget()` (domaine, pur) décide *laquelle* des trois clés fait foi ; on
 * ne récupère ici que son libellé et son lien. La règle de priorité reste donc
 * en un seul endroit, testé sans base.
 */
function toTargetView(row: TaskRow): TaskTargetView | null {
  const target = taskTarget({
    contactId: row.contactId,
    companyId: row.companyId,
    dealId: row.dealId,
  });
  if (target === null) return null;

  switch (target.type) {
    case "deal":
      return row.deal === null
        ? null
        : {
            type: "deal",
            id: row.deal.id,
            label: row.deal.name,
            href: `/affaires?status=all&q=${encodeURIComponent(row.deal.name)}`,
          };
    case "contact":
      return row.contact === null
        ? null
        : {
            type: "contact",
            id: row.contact.id,
            label: contactTitle(row.contact),
            href: `/contacts?q=${encodeURIComponent(row.contact.lastName)}`,
          };
    case "company":
      return row.company === null
        ? null
        : {
            type: "company",
            id: row.company.id,
            label: row.company.name,
            href: `/societes?q=${encodeURIComponent(row.company.name)}`,
          };
  }
}

export function toTaskRecord(row: TaskRow): TaskRecord {
  return {
    id: row.id,
    title: row.title,
    due: row.due,
    priority: toTaskPriority(row.priority),
    owner: row.owner,
    done: row.done,
    doneAt: row.doneAt,
    createdAt: row.createdAt,
    contactId: row.contactId,
    companyId: row.companyId,
    dealId: row.dealId,
    target: toTargetView(row),
  };
}

export async function listTasks(query: ListTasksQuery = {}): Promise<TaskRecord[]> {
  const where: Prisma.TaskWhereInput = {};

  const scope = query.scope ?? "all";
  if (scope === "open") where.done = false;
  if (scope === "done") where.done = true;

  if (query.owner !== undefined) where.owner = query.owner;
  if (query.contactId !== undefined) where.contactId = query.contactId;
  if (query.companyId !== undefined) where.companyId = query.companyId;
  if (query.dealId !== undefined) where.dealId = query.dealId;
  if (query.q !== undefined) where.title = { contains: query.q, mode: "insensitive" };

  const rows = await prisma.task.findMany({
    where,
    include: taskInclude,
    // Échéance croissante : la vue regroupe ensuite par urgence, et à
    // l'intérieur d'un groupe le plus urgent doit venir en tête.
    orderBy: [{ due: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toTaskRecord);
}

export async function getTask(id: string): Promise<TaskRecord | null> {
  const row = await prisma.task.findUnique({ where: { id }, include: taskInclude });
  return row === null ? null : toTaskRecord(row);
}

export async function createTask(input: CreateTaskInput): Promise<TaskRecord> {
  const row = await prisma.task.create({
    data: {
      title: input.title,
      due: input.due,
      priority: input.priority ?? "normale",
      owner: input.owner,
      kind: input.kind ?? DEFAULT_TASK_KIND,
      contactId: input.contactId ?? null,
      companyId: input.companyId ?? null,
      dealId: input.dealId ?? null,
    },
    include: taskInclude,
  });
  return toTaskRecord(row);
}

/**
 * `done` pilote `doneAt` : cocher horodate, décocher efface. Laisser une date
 * d'achèvement sur une tâche rouverte fausserait tout comptage de délai.
 */
export async function updateTask(
  id: string,
  input: UpdateTaskInput,
): Promise<TaskRecord | null> {
  const existing = await prisma.task.findUnique({
    where: { id },
    select: { done: true, autoKey: true, contactId: true },
  });
  if (existing === null) return null;

  const data: Prisma.TaskUpdateInput = {};

  if (input.title !== undefined) data.title = input.title;
  if (input.due !== undefined) data.due = input.due;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.owner !== undefined) data.owner = input.owner;
  if (input.kind !== undefined) data.kind = input.kind;
  if (input.done !== undefined) {
    data.done = input.done;
    data.doneAt = input.done ? new Date() : null;
  }

  if (input.contactId !== undefined) {
    data.contact =
      input.contactId === null ? { disconnect: true } : { connect: { id: input.contactId } };
  }
  if (input.companyId !== undefined) {
    data.company =
      input.companyId === null ? { disconnect: true } : { connect: { id: input.companyId } };
  }
  if (input.dealId !== undefined) {
    data.deal =
      input.dealId === null ? { disconnect: true } : { connect: { id: input.dealId } };
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({ where: { id }, data, include: taskInclude });

    // Terminer la tâche miroir d'une relance efface la relance : sans cela, le
    // contact resterait « À relancer » alors que le travail est fait.
    if (input.done === true) {
      await clearReminderAfterTask(tx, existing);
    }

    return updated;
  });

  return toTaskRecord(row);
}

export async function deleteTask(id: string): Promise<boolean> {
  const existing = await prisma.task.findUnique({ where: { id }, select: { id: true } });
  if (existing === null) return false;
  await prisma.task.delete({ where: { id } });
  return true;
}

/** Nombre de tâches en retard — alimente la pastille du rail. */
export async function countOverdueTasks(now: Date): Promise<number> {
  return prisma.task.count({ where: { done: false, due: { lt: now } } });
}

/**
 * **« Appel passé » : deux écritures, un seul geste.**
 *
 * Cocher une tâche d'appel sans rien consigner perdrait le seul fait qui compte
 * — qu'on a bien appelé — et c'est exactement ce que le CRM existe pour
 * empêcher. L'interaction et l'achèvement partent donc **ensemble** :
 * `logActivity` ouvre sa propre transaction (elle écrit l'interaction, avance
 * `lastContact` et peut créer la tâche de prochaine action, jalon 4), et la
 * tâche n'est cochée qu'après son succès.
 *
 * L'ordre n'est pas symétrique, comme l'envoi d'un email au jalon 32 : une tâche
 * cochée dont l'interaction a échoué est un travail qu'on croit tracé et qui ne
 * l'est pas ; une interaction consignée dont la tâche reste ouverte se recoche
 * en un clic.
 *
 * Refusé quand la tâche n'est pas un appel ou n'a pas de contact : il n'y a
 * alors rien à consigner sur personne, et inventer une interaction sur une
 * société serait écrire un fait qui n'a pas eu lieu.
 */
export interface CallDoneResult {
  readonly ok: boolean;
  readonly message: string;
}

export async function markCallDone(id: string, now = new Date()): Promise<CallDoneResult | null> {
  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, kind: true, done: true, owner: true, contactId: true, autoKey: true },
  });
  if (task === null) return null;

  if (toTaskKind(task.kind) !== "appel") {
    return { ok: false, message: "Cette tâche n'est pas un appel." };
  }
  if (task.contactId === null) {
    return {
      ok: false,
      message:
        "Cette tâche n'est rattachée à aucun contact : il n'y a pas d'historique où consigner l'appel.",
    };
  }
  if (task.done) {
    return { ok: false, message: "Cet appel est déjà marqué comme passé." };
  }

  await logActivity({
    type: "call",
    date: now,
    owner: task.owner,
    contactId: task.contactId,
    notes: "Appel passé depuis l'écran Tâches.",
  });

  await prisma.$transaction(async (tx) => {
    await tx.task.update({ where: { id }, data: { done: true, doneAt: now } });
    await clearReminderAfterTask(tx, { autoKey: task.autoKey, contactId: task.contactId });
  });

  return { ok: true, message: "Appel consigné et tâche terminée." };
}
