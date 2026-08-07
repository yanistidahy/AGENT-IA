import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { toDealStatus, toLifecycle } from "../domain/guards";
import type { DealStatus, Lifecycle } from "../domain/types";
import type {
  CreateCompanyInput,
  ListCompaniesQuery,
  UpdateCompanyInput,
} from "./company-schemas";

/** Accès aux sociétés. Voir CLAUDE.md § Base de données pour `mode: "insensitive"`. */
function containsFilter(value: string): Prisma.StringFilter {
  return { contains: value, mode: "insensitive" };
}

export interface CompanyContactSummary {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly title: string;
  readonly email: string;
  readonly lifecycle: Lifecycle;
}

export interface CompanyDealSummary {
  readonly id: string;
  readonly name: string;
  readonly amount: number;
  readonly status: DealStatus;
  readonly stage: { readonly id: string; readonly name: string; readonly color: string };
}

export interface CompanyRecord {
  readonly id: string;
  readonly name: string;
  readonly domain: string;
  readonly size: string;
  readonly industry: string;
  readonly loc: string;
  readonly desc: string;
  readonly createdAt: Date;
  readonly contacts: readonly CompanyContactSummary[];
  readonly deals: readonly CompanyDealSummary[];
  /** Somme des affaires en cours. */
  readonly openValue: number;
  /** Chiffre d'affaires déjà signé. */
  readonly wonValue: number;
}

const companyInclude = {
  contacts: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      title: true,
      email: true,
      lifecycle: true,
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  },
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
} satisfies Prisma.CompanyInclude;

type CompanyRow = Prisma.CompanyGetPayload<{ include: typeof companyInclude }>;

function toRecord(row: CompanyRow): CompanyRecord {
  const deals = row.deals.map((deal) => ({
    id: deal.id,
    name: deal.name,
    amount: deal.amount,
    status: toDealStatus(deal.status),
    stage: deal.stage,
  }));

  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    size: row.size,
    industry: row.industry,
    loc: row.loc,
    desc: row.desc,
    createdAt: row.createdAt,
    contacts: row.contacts.map((contact) => ({
      id: contact.id,
      firstName: contact.firstName,
      lastName: contact.lastName,
      title: contact.title,
      email: contact.email,
      lifecycle: toLifecycle(contact.lifecycle),
    })),
    deals,
    openValue: sumWhere(deals, "open"),
    wonValue: sumWhere(deals, "won"),
  };
}

function sumWhere(deals: readonly CompanyDealSummary[], status: DealStatus): number {
  return deals
    .filter((deal) => deal.status === status)
    .reduce((total, deal) => total + deal.amount, 0);
}

function orderBy(query: ListCompaniesQuery): Prisma.CompanyOrderByWithRelationInput[] {
  const dir = query.dir ?? "asc";
  switch (query.sort) {
    case "industry":
      return [{ industry: dir }, { name: "asc" }];
    case "size":
      return [{ size: dir }, { name: "asc" }];
    case "createdAt":
      return [{ createdAt: dir }];
    default:
      return [{ name: dir }];
  }
}

export async function listCompanies(query: ListCompaniesQuery = {}): Promise<CompanyRecord[]> {
  const where: Prisma.CompanyWhereInput = {};

  if (query.industry !== undefined) where.industry = query.industry;
  if (query.q !== undefined) {
    const contains = containsFilter(query.q);
    where.OR = [{ name: contains }, { domain: contains }, { industry: contains }];
  }

  const rows = await prisma.company.findMany({
    where,
    include: companyInclude,
    orderBy: orderBy(query),
  });
  return rows.map(toRecord);
}

export async function getCompany(id: string): Promise<CompanyRecord | null> {
  const row = await prisma.company.findUnique({ where: { id }, include: companyInclude });
  return row === null ? null : toRecord(row);
}

export async function createCompany(input: CreateCompanyInput): Promise<CompanyRecord> {
  const row = await prisma.company.create({
    data: {
      name: input.name,
      domain: input.domain ?? "",
      size: input.size ?? "",
      industry: input.industry ?? "",
      loc: input.loc ?? "",
      desc: input.desc ?? "",
    },
    include: companyInclude,
  });
  return toRecord(row);
}

export async function updateCompany(
  id: string,
  input: UpdateCompanyInput,
): Promise<CompanyRecord | null> {
  const existing = await prisma.company.findUnique({ where: { id }, select: { id: true } });
  if (existing === null) return null;

  const data: Prisma.CompanyUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.domain !== undefined) data.domain = input.domain;
  if (input.size !== undefined) data.size = input.size;
  if (input.industry !== undefined) data.industry = input.industry;
  if (input.loc !== undefined) data.loc = input.loc;
  if (input.desc !== undefined) data.desc = input.desc;

  const row = await prisma.company.update({ where: { id }, data, include: companyInclude });
  return toRecord(row);
}

/**
 * Suppression d'une société.
 *
 * Refusée tant qu'elle porte des contacts ou des affaires : le schéma les
 * détacherait silencieusement (`SetNull`), et un pipeline orphelin est plus
 * coûteux à réparer qu'un refus explicite à expliquer.
 */
export type DeleteCompanyResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "not_found" }
  | {
      readonly ok: false;
      readonly reason: "in_use";
      readonly contacts: number;
      readonly deals: number;
    };

export async function deleteCompany(id: string): Promise<DeleteCompanyResult> {
  const existing = await prisma.company.findUnique({
    where: { id },
    select: { _count: { select: { contacts: true, deals: true } } },
  });
  if (existing === null) return { ok: false, reason: "not_found" };

  const { contacts, deals } = existing._count;
  if (contacts > 0 || deals > 0) return { ok: false, reason: "in_use", contacts, deals };

  await prisma.company.delete({ where: { id } });
  return { ok: true };
}

/** Secteurs présents en base, pour alimenter le filtre sans liste codée en dur. */
export async function listIndustries(): Promise<string[]> {
  const rows = await prisma.company.findMany({
    where: { NOT: { industry: "" } },
    select: { industry: true },
    distinct: ["industry"],
    orderBy: { industry: "asc" },
  });
  return rows.map((row) => row.industry);
}
