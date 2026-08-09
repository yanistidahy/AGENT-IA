import type { Prisma } from "@prisma/client";
import type { FilterState } from "../domain/column-filters";
import { searchText, searchTerm } from "../domain/text";
import { columnsWhere, derivedFilters } from "./column-filters";
import {
  COMPANY_DB_COLUMNS,
  COMPANY_FACET_COLUMNS,
  type CompanyFacetRow,
} from "./company-columns";
import { facetsFor, matchesAll, type FacetValue } from "../domain/column-match";
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
    case "loc":
      return [{ loc: dir }, { name: "asc" }];
    case "createdAt":
      return [{ createdAt: dir }];
    default:
      return [{ name: dir }];
  }
}

export async function listCompanies(
  query: ListCompaniesQuery = {},
  filters: FilterState = {},
  now: Date = new Date(),
): Promise<CompanyRecord[]> {
  const rows = await prisma.company.findMany({
    where: companiesWhere(query, filters, now),
    include: companyInclude,
    orderBy: orderBy(query),
  });

  let records = rows.map(toRecord);
  records = applyCompanyFilter(records, query.filter);

  // Les trois colonnes chiffrées viennent d'agrégats : elles ne s'expriment pas
  // dans la clause SQL et sont appliquées ici, sur les mêmes valeurs que celles
  // affichées — c'est la seule façon qu'un filtre « CA signé ≥ 5 000 » retienne
  // exactement les lignes dont la colonne affiche ≥ 5 000.
  const derived = derivedFilters(filters, COMPANY_DB_COLUMNS);
  if (Object.keys(derived).length > 0) {
    records = records.filter((company) =>
      matchesAll(
        {
          id: company.id,
          industry: company.industry,
          size: company.size,
          loc: company.loc,
          contacts: company.contacts.length,
          openValue: company.openValue,
          wonValue: company.wonValue,
        },
        COMPANY_FACET_COLUMNS,
        derived,
        now,
      ),
    );
  }

  return sortCompanies(records, query);
}

/**
 * Clause de lecture des sociétés.
 *
 * La recherche porte sur le miroir normalisé (`searchText`), qui contient nom,
 * domaine, secteur et localisation : « zenith » y trouve « Zénith Labs », ce que
 * `mode: "insensitive"` ne faisait pas.
 */
function companiesWhere(
  query: ListCompaniesQuery,
  filters: FilterState,
  now: Date,
): Prisma.CompanyWhereInput {
  const and: Prisma.CompanyWhereInput[] = [];

  if (query.industry !== undefined) and.push({ industry: query.industry });

  const term = searchTerm(query.q);
  if (term !== "") and.push({ searchText: { contains: term } });

  // « Sans contact » s'exprime en SQL ; les deux autres puces portent sur des
  // sommes calculées après lecture et sont appliquées là.
  if (query.filter === "orphan") and.push({ contacts: { none: {} } });

  const columns = columnsWhere(filters, COMPANY_DB_COLUMNS, now);
  if (Object.keys(columns).length > 0) and.push(columns as Prisma.CompanyWhereInput);

  return and.length === 0 ? {} : { AND: and };
}

function applyCompanyFilter(
  records: readonly CompanyRecord[],
  filter: ListCompaniesQuery["filter"],
): CompanyRecord[] {
  if (filter === "pipeline") return records.filter((company) => company.openValue > 0);
  if (filter === "clients") return records.filter((company) => company.wonValue > 0);
  return [...records];
}

/** Les trois tris portant sur des agrégats se font après lecture. */
function sortCompanies(
  records: readonly CompanyRecord[],
  query: ListCompaniesQuery,
): CompanyRecord[] {
  const direction = query.dir === "desc" ? -1 : 1;

  const key =
    query.sort === "contacts"
      ? (company: CompanyRecord) => company.contacts.length
      : query.sort === "openValue"
        ? (company: CompanyRecord) => company.openValue
        : query.sort === "wonValue"
          ? (company: CompanyRecord) => company.wonValue
          : null;

  if (key === null) return [...records];
  return [...records].sort((a, b) => (key(a) - key(b)) * direction);
}

/** Secteurs réellement présents, avec leur nombre de sociétés. */
export async function listIndustries(): Promise<ReadonlyArray<{ value: string; count: number }>> {
  const rows = await prisma.company.groupBy({
    by: ["industry"],
    where: { NOT: { industry: "" } },
    _count: { _all: true },
  });

  return rows
    .map((row) => ({ value: row.industry, count: row._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value, "fr"));
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
      searchText: companySearchText(input),
    },
    include: companyInclude,
  });
  return toRecord(row);
}

/** Miroir de recherche d'une société — voir lib/domain/text.ts. */
function companySearchText(company: {
  readonly name?: string;
  readonly domain?: string;
  readonly industry?: string;
  readonly loc?: string;
}): string {
  return searchText([company.name, company.domain, company.industry, company.loc]);
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

  const updated = await prisma.company.update({ where: { id }, data, include: companyInclude });
  const row = await prisma.company.update({
    where: { id },
    data: { searchText: companySearchText(updated) },
    include: companyInclude,
  });
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



/**
 * Valeurs distinctes des colonnes de `/societes`.
 *
 * Les trois colonnes chiffrées viennent d'agrégats sur les affaires : la
 * projection les recalcule, elle ne peut donc pas être une simple sélection de
 * champs. Elle reste légère — aucun contact, aucune note, aucune description.
 */
export async function companyFacets(
  query: ListCompaniesQuery,
  filters: FilterState,
  now: Date = new Date(),
): Promise<{
  readonly facets: Readonly<Record<string, readonly FacetValue[]>>;
  readonly total: number;
}> {
  const rows = await prisma.company.findMany({
    where: companiesWhere(query, {}, now),
    select: {
      id: true,
      industry: true,
      size: true,
      loc: true,
      _count: { select: { contacts: true } },
      deals: { select: { amount: true, status: true } },
    },
  });

  const projected: CompanyFacetRow[] = rows
    .map((row) => ({
      id: row.id,
      industry: row.industry,
      size: row.size,
      loc: row.loc,
      contacts: row._count.contacts,
      openValue: sumBy(row.deals, "open"),
      wonValue: sumBy(row.deals, "won"),
    }))
    .filter((row) => matchesChip(row, query.filter));

  return {
    facets: facetsFor(projected, COMPANY_FACET_COLUMNS, filters, now),
    total: projected.length,
  };
}

function sumBy(
  deals: ReadonlyArray<{ amount: number; status: string }>,
  status: "open" | "won",
): number {
  return deals
    .filter((deal) => deal.status === status)
    .reduce((sum, deal) => sum + deal.amount, 0);
}

function matchesChip(
  row: CompanyFacetRow,
  filter: ListCompaniesQuery["filter"],
): boolean {
  if (filter === "pipeline") return row.openValue > 0;
  if (filter === "clients") return row.wonValue > 0;
  return true;
}
