import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { resolveCompanyLink } from "./company-resolve";
import { toDealStatus, toLifecycle } from "../domain/guards";
import {
  followUpRank,
  followUpStatus,
  idleDays,
  matchesContactFilter,
  type FollowUpStatus,
} from "../domain/follow-up";
import { DEFAULT_PILOTAGE, type DealStatus, type Lifecycle, type PilotageSettings } from "../domain/types";
import type {
  CreateContactInput,
  ListContactsQuery,
  UpdateContactInput,
} from "./contact-schemas";

/**
 * Accès aux contacts.
 *
 * Même motif que `lib/api/deals.ts` : une seule couche de service, appelée par
 * les routes d'API *et* directement par les composants serveur.
 *
 * `mode: "insensitive"` est propre à PostgreSQL — voir CLAUDE.md § Base de données.
 */
function containsFilter(value: string): Prisma.StringFilter {
  return { contains: value, mode: "insensitive" };
}

export interface ContactDealSummary {
  readonly id: string;
  readonly name: string;
  readonly amount: number;
  readonly status: DealStatus;
  readonly stage: { readonly id: string; readonly name: string; readonly color: string };
}

export interface ContactRecord {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly title: string;
  readonly dep: string;
  readonly email: string;
  readonly phone: string;
  readonly linkedin: string;
  readonly lifecycle: Lifecycle;
  readonly source: string;
  readonly owner: string;
  readonly notes: string;
  readonly createdAt: Date;
  readonly lastContact: Date | null;
  readonly nextReminder: Date | null;
  readonly companyId: string | null;
  readonly company: { readonly id: string; readonly name: string } | null;
  readonly deals: readonly ContactDealSummary[];
  /** Interactions consignées — distingue « jamais contacté » d'un import daté. */
  readonly activityCount: number;
  /** Statut de relance, dérivé (voir lib/domain/follow-up.ts). */
  readonly followUp: FollowUpStatus;
  /** Jours depuis la dernière touche, `null` si elle n'a jamais eu lieu. */
  readonly idleDays: number | null;
}

const contactInclude = {
  company: { select: { id: true, name: true } },
  deals: {
    select: {
      id: true,
      name: true,
      amount: true,
      status: true,
      stage: { select: { id: true, name: true, color: true } },
    },
    orderBy: { amount: "desc" },
  },
  _count: { select: { activities: true } },
} satisfies Prisma.ContactInclude;

type ContactRow = Prisma.ContactGetPayload<{ include: typeof contactInclude }>;

function toRecord(
  row: ContactRow,
  settings: PilotageSettings,
  now: Date,
): ContactRecord {
  const followUpInput = {
    lastContact: row.lastContact,
    nextReminder: row.nextReminder,
    activityCount: row._count.activities,
  };

  return {
    activityCount: row._count.activities,
    followUp: followUpStatus(followUpInput, settings, now),
    idleDays: idleDays(followUpInput, now),
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    title: row.title,
    dep: row.dep,
    email: row.email,
    phone: row.phone,
    linkedin: row.linkedin,
    lifecycle: toLifecycle(row.lifecycle),
    source: row.source,
    owner: row.owner,
    notes: row.notes,
    createdAt: row.createdAt,
    lastContact: row.lastContact,
    nextReminder: row.nextReminder,
    companyId: row.companyId,
    company: row.company,
    deals: row.deals.map((deal) => ({
      id: deal.id,
      name: deal.name,
      amount: deal.amount,
      status: toDealStatus(deal.status),
      stage: deal.stage,
    })),
  };
}

function orderBy(query: ListContactsQuery): Prisma.ContactOrderByWithRelationInput[] {
  const dir = query.dir ?? "asc";
  switch (query.sort) {
    case "firstName":
      return [{ firstName: dir }];
    case "company":
      return [{ company: { name: dir } }, { lastName: "asc" }];
    case "lifecycle":
      return [{ lifecycle: dir }, { lastName: "asc" }];
    case "owner":
      return [{ owner: dir }, { lastName: "asc" }];
    case "lastContact":
      // Un contact jamais touché doit remonter en tête d'un tri par fraîcheur,
      // pas se retrouver relégué en fin de liste avec les valeurs nulles.
      return [{ lastContact: { sort: dir, nulls: "first" } }];
    case "createdAt":
      return [{ createdAt: dir }];
    default:
      return [{ lastName: dir }, { firstName: "asc" }];
  }
}

/**
 * Liste des contacts.
 *
 * Le statut de relance est **dérivé**, pas stocké : il ne peut donc pas être
 * filtré ni trié en SQL. Le filtrage et le tri correspondants se font en mémoire,
 * après lecture. C'est assumé au volume d'un CRM d'indépendant ; si la table
 * devait atteindre des dizaines de milliers de lignes, il faudrait matérialiser
 * le statut ou l'exprimer en requête brute — au prix de la portabilité du schéma.
 */
export async function listContacts(
  query: ListContactsQuery = {},
  settings: PilotageSettings = DEFAULT_PILOTAGE,
  now: Date = new Date(),
): Promise<ContactRecord[]> {
  const where: Prisma.ContactWhereInput = {};

  if (query.lifecycle !== undefined && query.lifecycle !== "all") {
    where.lifecycle = query.lifecycle;
  }
  if (query.owner !== undefined) where.owner = query.owner;
  if (query.source !== undefined) where.source = query.source;
  if (query.companyId !== undefined) where.companyId = query.companyId;
  if (query.q !== undefined) {
    const contains = containsFilter(query.q);
    where.OR = [
      { firstName: contains },
      { lastName: contains },
      { email: contains },
      { title: contains },
      { company: { name: contains } },
    ];
  }

  const rows = await prisma.contact.findMany({
    where,
    include: contactInclude,
    orderBy: orderBy(query),
  });

  let records = rows.map((row) => toRecord(row, settings, now));

  const filter = query.followUp;
  if (filter !== undefined) {
    records = records.filter((contact) =>
      matchesContactFilter(
        {
          lastContact: contact.lastContact,
          nextReminder: contact.nextReminder,
          activityCount: contact.activityCount,
        },
        filter,
        settings,
        now,
      ),
    );
  }

  // Le filtre « à relancer » rassemble retards et échéances à venir : sans tri
  // explicite, il s'ordonne par échéance croissante, du plus urgent au plus
  // lointain. C'est la lecture attendue d'un pipeline de relances.
  const sortKey = query.sort ?? (filter === "reminder" ? "nextReminder" : undefined);

  if (sortKey === "followUp") {
    const direction = query.dir === "desc" ? -1 : 1;
    records = [...records].sort(
      (a, b) => (followUpRank(a.followUp) - followUpRank(b.followUp)) * direction,
    );
  }

  if (sortKey === "nextReminder") {
    const direction = query.dir === "desc" ? -1 : 1;
    // Sans relance programmée : en fin de liste dans les deux sens — l'absence
    // de date n'est ni la plus urgente ni la plus lointaine, elle n'est rien.
    const key = (contact: ContactRecord) =>
      contact.nextReminder === null ? Number.MAX_SAFE_INTEGER : contact.nextReminder.getTime();
    records = [...records].sort((a, b) => {
      if (a.nextReminder === null) return 1;
      if (b.nextReminder === null) return -1;
      return (key(a) - key(b)) * direction;
    });
  }

  return records;
}

export async function getContact(
  id: string,
  settings: PilotageSettings = DEFAULT_PILOTAGE,
  now: Date = new Date(),
): Promise<ContactRecord | null> {
  const row = await prisma.contact.findUnique({ where: { id }, include: contactInclude });
  return row === null ? null : toRecord(row, settings, now);
}

/**
 * Création d'un contact.
 *
 * `companyName` déclenche la création de la société dans **la même
 * transaction** : si l'écriture du contact échoue, aucune société fantôme ne
 * reste derrière.
 */
export async function createContact(input: CreateContactInput): Promise<ContactRecord> {
  const row = await prisma.$transaction(async (tx) => {
    const companyId = await resolveCompanyLink(tx, input);
    return tx.contact.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      lifecycle: input.lifecycle,
      title: input.title ?? "",
      dep: input.dep ?? "",
      email: input.email ?? "",
      phone: input.phone ?? "",
      linkedin: input.linkedin ?? "",
      source: input.source ?? "",
      owner: input.owner ?? "",
      notes: input.notes ?? "",
      companyId: companyId ?? null,
      lastContact: input.lastContact ?? null,
      nextReminder: input.nextReminder ?? null,
    },
    include: contactInclude,
    });
  });
  return toRecord(row, DEFAULT_PILOTAGE, new Date());
}

export async function updateContact(
  id: string,
  input: UpdateContactInput,
): Promise<ContactRecord | null> {
  const existing = await prisma.contact.findUnique({ where: { id }, select: { id: true } });
  if (existing === null) return null;

  const data: Prisma.ContactUpdateInput = {};

  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.lifecycle !== undefined) data.lifecycle = input.lifecycle;
  if (input.title !== undefined) data.title = input.title;
  if (input.dep !== undefined) data.dep = input.dep;
  if (input.email !== undefined) data.email = input.email;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.linkedin !== undefined) data.linkedin = input.linkedin;
  if (input.source !== undefined) data.source = input.source;
  if (input.owner !== undefined) data.owner = input.owner;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.lastContact !== undefined) data.lastContact = input.lastContact;
  if (input.nextReminder !== undefined) data.nextReminder = input.nextReminder;

  const row = await prisma.$transaction(async (tx) => {
    const companyId = await resolveCompanyLink(tx, input);
    if (companyId !== undefined) {
      data.company = companyId === null ? { disconnect: true } : { connect: { id: companyId } };
    }
    return tx.contact.update({ where: { id }, data, include: contactInclude });
  });

  return toRecord(row, DEFAULT_PILOTAGE, new Date());
}

/**
 * Suppression d'un contact.
 *
 * Les affaires et les interactions liées survivent, détachées (`SetNull` au
 * schéma) : supprimer une fiche ne doit pas effacer du chiffre d'affaires. Les
 * tâches, elles, disparaissent — une relance sur un contact supprimé n'a plus
 * d'objet.
 */
export async function deleteContact(id: string): Promise<boolean> {
  const existing = await prisma.contact.findUnique({ where: { id }, select: { id: true } });
  if (existing === null) return false;
  await prisma.contact.delete({ where: { id } });
  return true;
}
