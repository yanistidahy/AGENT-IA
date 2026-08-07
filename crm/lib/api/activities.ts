import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { toActivityType } from "../domain/guards";
import type { ActivityType } from "../domain/types";
import type { CreateActivityInput, ListActivitiesQuery } from "./activity-schemas";
import { taskInclude, toTaskRecord, type TaskRecord } from "./tasks";

/**
 * Accès aux interactions.
 *
 * Consigner une interaction fait trois écritures qui n'ont de sens qu'ensemble :
 * l'interaction, la tâche de relance qu'elle décide, et la mise à jour des dates
 * de dernière touche. Elles passent donc dans une transaction — sans quoi un
 * appel noté sans sa relance est exactement l'oubli que ce CRM doit empêcher.
 */

export interface ActivityRecord {
  readonly id: string;
  readonly type: ActivityType;
  readonly date: Date;
  readonly owner: string;
  readonly notes: string;
  readonly duration: number | null;
  readonly createdAt: Date;
  readonly contactId: string | null;
  readonly companyId: string | null;
  readonly dealId: string | null;
  readonly contact: { readonly id: string; readonly firstName: string; readonly lastName: string } | null;
  readonly company: { readonly id: string; readonly name: string } | null;
  readonly deal: { readonly id: string; readonly name: string } | null;
}

const activityInclude = {
  contact: { select: { id: true, firstName: true, lastName: true } },
  company: { select: { id: true, name: true } },
  deal: { select: { id: true, name: true } },
} satisfies Prisma.ActivityInclude;

type ActivityRow = Prisma.ActivityGetPayload<{ include: typeof activityInclude }>;

function toRecord(row: ActivityRow): ActivityRecord {
  return {
    id: row.id,
    type: toActivityType(row.type),
    date: row.date,
    owner: row.owner,
    notes: row.notes,
    duration: row.duration,
    createdAt: row.createdAt,
    contactId: row.contactId,
    companyId: row.companyId,
    dealId: row.dealId,
    contact: row.contact,
    company: row.company,
    deal: row.deal,
  };
}

/**
 * Chronologie d'une fiche, du plus récent au plus ancien.
 *
 * Les filtres sont combinés en `OR` : la chronologie d'une société doit montrer
 * ce qui s'est passé sur ses affaires, pas seulement ce qui lui est directement
 * rattaché. Sans cela, une fiche société active paraîtrait muette.
 */
export async function listActivities(
  query: ListActivitiesQuery = {},
): Promise<ActivityRecord[]> {
  const clauses: Prisma.ActivityWhereInput[] = [];
  if (query.contactId !== undefined) clauses.push({ contactId: query.contactId });
  if (query.companyId !== undefined) clauses.push({ companyId: query.companyId });
  if (query.dealId !== undefined) clauses.push({ dealId: query.dealId });

  const where: Prisma.ActivityWhereInput = {};
  if (clauses.length > 0) where.OR = clauses;
  if (query.type !== undefined) where.type = query.type;

  const rows = await prisma.activity.findMany({
    where,
    include: activityInclude,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: query.limit ?? 50,
  });
  return rows.map(toRecord);
}

/**
 * Chronologie d'une société, ses affaires et ses contacts compris.
 *
 * Une requête distincte parce qu'elle a besoin des identifiants enfants : Prisma
 * ne sait pas exprimer « ou rattachée à une affaire de cette société » en une
 * seule clause sans sous-requête relationnelle.
 */
export async function listCompanyTimeline(companyId: string): Promise<ActivityRecord[]> {
  const [deals, contacts] = await Promise.all([
    prisma.deal.findMany({ where: { companyId }, select: { id: true } }),
    prisma.contact.findMany({ where: { companyId }, select: { id: true } }),
  ]);

  const rows = await prisma.activity.findMany({
    where: {
      OR: [
        { companyId },
        { dealId: { in: deals.map((deal) => deal.id) } },
        { contactId: { in: contacts.map((contact) => contact.id) } },
      ],
    },
    include: activityInclude,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  return rows.map(toRecord);
}

export interface LogActivityResult {
  readonly activity: ActivityRecord;
  /** Tâche créée par « prochaine action », si elle était renseignée. */
  readonly task: TaskRecord | null;
}

/**
 * Consigne une interaction, et la relance qu'elle décide, en une transaction.
 *
 * Effets de bord assumés, tous dans la même transaction :
 * - `Contact.lastContact` avance à la date de l'interaction — c'est ce qui
 *   alimente la colonne « dernière touche » et les alertes de rappel ;
 * - `Deal.lastActivityAt` avance aussi : la chaleur d'une affaire se calcule
 *   là-dessus, et un appel consigné doit la réchauffer ;
 * - la « prochaine action » devient une tâche datée, rattachée à la même fiche.
 *
 * Les dates ne reculent jamais : consigner un appel oublié la semaine dernière
 * ne doit pas rendre une affaire artificiellement froide.
 */
export async function logActivity(input: CreateActivityInput): Promise<LogActivityResult> {
  const contactId = input.contactId ?? null;
  const companyId = input.companyId ?? null;
  const dealId = input.dealId ?? null;

  return prisma.$transaction(async (tx) => {
    const activity = await tx.activity.create({
      data: {
        type: input.type,
        date: input.date,
        owner: input.owner,
        notes: input.notes ?? "",
        duration: input.duration ?? null,
        contactId,
        companyId,
        dealId,
      },
      include: activityInclude,
    });

    if (contactId !== null) {
      const current = await tx.contact.findUnique({
        where: { id: contactId },
        select: { lastContact: true },
      });
      if (current !== null && (current.lastContact === null || current.lastContact < input.date)) {
        await tx.contact.update({
          where: { id: contactId },
          data: { lastContact: input.date },
        });
      }
    }

    if (dealId !== null) {
      const current = await tx.deal.findUnique({
        where: { id: dealId },
        select: { lastActivityAt: true },
      });
      if (
        current !== null &&
        (current.lastActivityAt === null || current.lastActivityAt < input.date)
      ) {
        await tx.deal.update({
          where: { id: dealId },
          data: { lastActivityAt: input.date },
        });
      }
    }

    let task: TaskRecord | null = null;
    const next = input.nextAction;
    if (next !== null && next !== undefined) {
      const row = await tx.task.create({
        data: {
          title: next.title,
          due: next.due,
          priority: next.priority ?? "normale",
          owner: input.owner,
          contactId,
          companyId,
          dealId,
        },
        include: taskInclude,
      });
      task = toTaskRecord(row);
    }

    return { activity: toRecord(activity), task };
  });
}
