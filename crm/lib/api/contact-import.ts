import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { searchText } from "../domain/text";
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

/** Ce qu'une mise à jour a changé sur une fiche, champ par champ. */
export interface ImportFieldChange {
  readonly field: string;
  readonly from: string;
  readonly to: string;
}

export interface ImportUpdate {
  readonly line: number;
  readonly name: string;
  readonly company: string | null;
  readonly changes: readonly ImportFieldChange[];
}

export interface ImportReport {
  readonly created: number;
  readonly updated: number;
  /** Détail de chaque mise à jour : sans lui, « 12 mis à jour » n'apprend rien. */
  readonly updates: readonly ImportUpdate[];
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
/**
 * Retrouve la fiche déjà en base, s'il y en a une.
 *
 * L'adresse électronique fait foi ; à défaut, le couple nom + société. Sans ce
 * repli, réimporter le même tableau recrée en double toutes les lignes sans
 * adresse — et c'est exactement ce que fait quelqu'un qui doute que son premier
 * import ait fonctionné.
 */
const EXISTING_FIELDS = {
  id: true,
  firstName: true,
  lastName: true,
  title: true,
  dep: true,
  email: true,
  phone: true,
  linkedin: true,
  lifecycle: true,
  source: true,
  owner: true,
  notes: true,
  lastContact: true,
  nextReminder: true,
  companyId: true,
  company: { select: { name: true } },
} satisfies Prisma.ContactSelect;

type ExistingContact = Prisma.ContactGetPayload<{ select: typeof EXISTING_FIELDS }>;

async function findExisting(
  email: string,
  firstName: string,
  lastName: string,
  companyId: string | null,
): Promise<ExistingContact | null> {
  const where =
    email !== ""
      ? { email: { equals: email, mode: "insensitive" as const } }
      : {
          firstName: { equals: firstName, mode: "insensitive" as const },
          lastName: { equals: lastName, mode: "insensitive" as const },
          companyId,
        };

  return prisma.contact.findFirst({ where, select: EXISTING_FIELDS });
}

/**
 * Champs susceptibles d'être mis à jour, avec leur libellé pour le rapport.
 *
 * `companyId` en fait partie : rattacher une fiche à sa société est bien une
 * mise à jour, et c'est souvent la raison même du réimport.
 */
const UPDATABLE = [
  ["firstName", "Prénom"],
  ["lastName", "Nom"],
  ["title", "Fonction"],
  ["dep", "Département"],
  ["email", "Email"],
  ["phone", "Téléphone"],
  ["linkedin", "LinkedIn"],
  ["lifecycle", "Cycle de vie"],
  ["source", "Source"],
  ["owner", "Propriétaire"],
  ["notes", "Notes"],
  ["lastContact", "Dernier contact"],
  ["nextReminder", "Prochaine relance"],
] as const;

type UpdatableField = (typeof UPDATABLE)[number][0];

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

/**
 * Différence entre la fiche en base et ce que la ligne collée apporte.
 *
 * Deux règles, et elles sont le cœur du mode mise à jour :
 *
 * 1. **une colonne absente du collage n'est pas touchée** — elle n'exprime
 *    aucune intention ;
 * 2. **une cellule vide ne vide pas le champ** — un tableur exporté avec des
 *    colonnes partiellement remplies effacerait sinon des données qu'il ne
 *    prétendait pas modifier. Rien n'est jamais supprimé par un import.
 */
function diffFields(
  existing: ExistingContact,
  incoming: Record<string, unknown>,
  present: ReadonlySet<string>,
): { data: Record<string, unknown>; changes: ImportFieldChange[] } {
  const data: Record<string, unknown> = {};
  const changes: ImportFieldChange[] = [];

  for (const [field, label] of UPDATABLE) {
    if (!present.has(field)) continue;

    const next = incoming[field];
    if (next === undefined || next === null || next === "") continue;

    const current = existing[field as UpdatableField];
    const before = show(current);
    const after = show(next);
    if (before === after) continue;

    data[field] = next;
    changes.push({ field: label, from: before, to: after });
  }

  return { data, changes };
}

export async function importContacts(
  text: string,
  options: { readonly update?: boolean } = {},
): Promise<ImportOutcome> {
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
  const updates: ImportUpdate[] = [];
  let created = 0;
  let duplicates = 0;

  // Colonnes réellement présentes dans le collage : c'est cette liste, et elle
  // seule, qui décide de ce qu'une mise à jour a le droit de toucher.
  const present = new Set(Object.keys(mapping.columns));

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

      const existing = await findExisting(
        email,
        parsed.data.firstName,
        parsed.data.lastName,
        companyId,
      );

      if (existing !== null) {
        if (options.update !== true) {
          duplicates += 1;
          continue;
        }

        const { data, changes } = diffFields(existing, parsed.data, present);

        // Rattacher une société absente est une mise à jour, pas un écrasement :
        // on ne détache jamais une fiche déjà rattachée.
        if (companyId !== null && existing.companyId !== companyId) {
          data.companyId = companyId;
          changes.push({
            field: "Société",
            from: existing.company?.name ?? "—",
            to: cell(row, mapping, "company"),
          });
        }

        if (changes.length === 0) {
          duplicates += 1;
          continue;
        }

        const merged = { ...existing, ...data };
        await prisma.contact.update({
          where: { id: existing.id },
          data: {
            ...data,
            searchText: searchText([
              String(merged.firstName ?? ""),
              String(merged.lastName ?? ""),
              String(merged.email ?? ""),
              String(merged.phone ?? ""),
              String(merged.title ?? ""),
              String(merged.dep ?? ""),
            ]),
          },
        });

        updates.push({
          line,
          name: `${merged.firstName} ${merged.lastName}`.trim(),
          company: existing.company?.name ?? null,
          changes,
        });
        continue;
      }

      await prisma.contact.create({
        data: {
          ...parsed.data,
          companyId,
          notes: parsed.data.notes ?? "",
          // Miroir de recherche : sans lui, une fiche importée resterait
          // introuvable jusqu'à sa prochaine modification.
          searchText: searchText([
            parsed.data.firstName,
            parsed.data.lastName,
            parsed.data.email ?? "",
            parsed.data.phone ?? "",
            parsed.data.title ?? "",
            parsed.data.dep ?? "",
          ]),
        },
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
      updated: updates.length,
      updates,
      duplicates,
      companiesCreated,
      ignoredColumns: mapping.ignored,
      errors,
    },
  };
}
