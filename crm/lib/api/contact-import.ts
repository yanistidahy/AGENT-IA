import { prisma } from "../db";
import {
  cell,
  looksLikeHeader,
  mapHeaders,
  normalizeHeader,
  parseCellDate,
  parseGrid,
} from "../domain/csv";
import { LIFECYCLES, type Lifecycle } from "../domain/types";
import { createContactSchema } from "./contact-schemas";

/**
 * Import de contacts collés depuis un tableur.
 *
 * Le découpage et la reconnaissance des colonnes vivent dans `lib/domain/csv.ts`,
 * qui est pur et testé. Ce module ne fait que le travail qui touche la base :
 * retrouver ou créer les sociétés, écarter les doublons, écrire les contacts.
 *
 * Rien n'est deviné en silence. Une ligne invalide n'est pas « corrigée » : elle
 * est comptée, numérotée et renvoyée avec sa raison, et les autres passent.
 */

export interface ImportLineError {
  /** Numéro de ligne tel qu'il apparaît dans le tableur collé, en-tête comprise. */
  readonly line: number;
  readonly message: string;
}

export interface ImportReport {
  readonly created: number;
  readonly duplicates: number;
  readonly companiesCreated: readonly string[];
  readonly ignoredColumns: readonly string[];
  readonly errors: readonly ImportLineError[];
}

export type ImportOutcome =
  | { readonly ok: true; readonly report: ImportReport }
  | { readonly ok: false; readonly message: string };

/** Reconnaissance souple du cycle de vie : « client », « CLIENT », « Client » se rejoignent. */
function toLifecycleLoose(value: string): Lifecycle {
  const normalized = normalizeHeader(value);
  if (normalized === "") return "Lead";
  const match = LIFECYCLES.find((candidate) => normalizeHeader(candidate) === normalized);
  return match ?? "Lead";
}

/**
 * Société par son nom, créée si elle n'existe pas.
 *
 * La comparaison est insensible à la casse : « acme » et « ACME » sont la même
 * société, et un import ne doit pas fabriquer un doublon pour une majuscule.
 * Le cache évite de recréer la même société deux fois dans un même import.
 */
async function resolveCompany(
  name: string,
  cache: Map<string, string>,
  created: string[],
): Promise<string | null> {
  const trimmed = name.trim();
  if (trimmed === "") return null;

  const key = trimmed.toLowerCase();
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const existing = await prisma.company.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing !== null) {
    cache.set(key, existing.id);
    return existing.id;
  }

  const company = await prisma.company.create({ data: { name: trimmed }, select: { id: true } });
  cache.set(key, company.id);
  created.push(trimmed);
  return company.id;
}

/**
 * Détection de doublon.
 *
 * L'adresse électronique fait foi quand elle existe. Sinon on retombe sur le
 * couple nom + société : sans ce repli, réimporter deux fois le même tableau
 * recrée en double toutes les lignes sans adresse — et c'est précisément ce que
 * fait un utilisateur qui doute que son premier import ait fonctionné.
 */
async function isDuplicate(
  email: string,
  firstName: string,
  lastName: string,
  companyId: string | null,
): Promise<boolean> {
  const where =
    email !== ""
      ? { email: { equals: email, mode: "insensitive" as const } }
      : {
          firstName: { equals: firstName, mode: "insensitive" as const },
          lastName: { equals: lastName, mode: "insensitive" as const },
          companyId,
        };

  const clash = await prisma.contact.findFirst({ where, select: { id: true } });
  return clash !== null;
}

export async function importContacts(text: string): Promise<ImportOutcome> {
  const grid = parseGrid(text);
  const header = grid[0];

  if (header === undefined) {
    return { ok: false, message: "Le collage ne contient aucune ligne." };
  }
  if (!looksLikeHeader(header)) {
    return {
      ok: false,
      message:
        "La première ligne n'est pas reconnue comme un en-tête. Ajoutez une ligne de titres " +
        "(Prénom, Nom, Email, Société…) avant de coller.",
    };
  }

  const mapping = mapHeaders(header);
  if (mapping.columns.firstName === undefined && mapping.columns.lastName === undefined) {
    return { ok: false, message: "Aucune colonne « Prénom » ou « Nom » n'a été reconnue." };
  }

  const rows = grid.slice(1);
  if (rows.length === 0) {
    return { ok: false, message: "L'en-tête a été reconnue, mais aucune ligne de données ne suit." };
  }

  const errors: ImportLineError[] = [];
  const companiesCreated: string[] = [];
  const companyCache = new Map<string, string>();
  let created = 0;
  let duplicates = 0;

  for (const [index, row] of rows.entries()) {
    const line = index + 2; // +1 pour l'en-tête, +1 parce qu'un tableur compte depuis 1
    const email = cell(row, mapping, "email");

    const lastContact = parseCellDate(cell(row, mapping, "lastContact"));
    const nextReminder = parseCellDate(cell(row, mapping, "nextReminder"));
    if (lastContact === "invalid" || nextReminder === "invalid") {
      errors.push({ line, message: "Date illisible (attendu JJ/MM/AAAA ou AAAA-MM-JJ)." });
      continue;
    }

    const parsed = createContactSchema.safeParse({
      lastContact,
      nextReminder,
      firstName: cell(row, mapping, "firstName"),
      lastName: cell(row, mapping, "lastName"),
      lifecycle: toLifecycleLoose(cell(row, mapping, "lifecycle")),
      title: cell(row, mapping, "title"),
      dep: cell(row, mapping, "dep"),
      email,
      phone: cell(row, mapping, "phone"),
      linkedin: cell(row, mapping, "linkedin"),
      source: cell(row, mapping, "source"),
      owner: cell(row, mapping, "owner"),
      notes: cell(row, mapping, "notes"),
    });

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      errors.push({ line, message: first?.message ?? "Ligne invalide" });
      continue;
    }

    try {
      const companyId = await resolveCompany(
        cell(row, mapping, "company"),
        companyCache,
        companiesCreated,
      );

      if (await isDuplicate(email, parsed.data.firstName, parsed.data.lastName, companyId)) {
        duplicates += 1;
        continue;
      }

      await prisma.contact.create({
        data: { ...parsed.data, companyId, notes: parsed.data.notes ?? "" },
      });
      created += 1;
    } catch (error) {
      console.error(`[import] ligne ${line}`, error);
      errors.push({ line, message: "Écriture refusée par la base." });
    }
  }

  return {
    ok: true,
    report: {
      created,
      duplicates,
      companiesCreated,
      ignoredColumns: mapping.ignored,
      errors,
    },
  };
}
