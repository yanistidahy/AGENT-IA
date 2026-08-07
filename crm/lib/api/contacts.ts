import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { toDealStatus, toLifecycle } from "../domain/guards";
import type { DealStatus, Lifecycle } from "../domain/types";
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
} satisfies Prisma.ContactInclude;

type ContactRow = Prisma.ContactGetPayload<{ include: typeof contactInclude }>;

function toRecord(row: ContactRow): ContactRecord {
  return {
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

export async function listContacts(query: ListContactsQuery = {}): Promise<ContactRecord[]> {
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
  return rows.map(toRecord);
}

export async function getContact(id: string): Promise<ContactRecord | null> {
  const row = await prisma.contact.findUnique({ where: { id }, include: contactInclude });
  return row === null ? null : toRecord(row);
}

export async function createContact(input: CreateContactInput): Promise<ContactRecord> {
  const row = await prisma.contact.create({
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
      companyId: input.companyId ?? null,
      lastContact: input.lastContact ?? null,
      nextReminder: input.nextReminder ?? null,
    },
    include: contactInclude,
  });
  return toRecord(row);
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

  if (input.companyId !== undefined) {
    data.company =
      input.companyId === null ? { disconnect: true } : { connect: { id: input.companyId } };
  }

  const row = await prisma.contact.update({ where: { id }, data, include: contactInclude });
  return toRecord(row);
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
