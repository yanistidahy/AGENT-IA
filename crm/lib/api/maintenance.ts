import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { fold, searchText } from "../domain/text";
import { nameOverflow, splitOverflow } from "../domain/status";
import { LOST_LIFECYCLE } from "../domain/lost";
import { countOtherPatterns, findSiteLine, type OtherPatternCounts } from "../domain/notes-extract";
import type { SheetSite } from "@/scripts/sites-2026-08";

/**
 * Opérations de maintenance sur les données.
 *
 * Ce module est **la** logique ; `scripts/` et `/api/maintenance/*` n'en sont
 * que deux façades. Écrire la règle deux fois — une pour le terminal, une pour
 * le bouton — c'est se garantir que les deux divergeront le jour où l'une sera
 * corrigée seule. C'est exactement la duplication qui avait produit la
 * divergence de fraîcheur au jalon 7.
 *
 * Toutes les opérations suivent le même contrat :
 *
 * - `plan*()` **ne écrit rien** et décrit ce qui changerait ;
 * - `apply*()` écrit, et n'écrit que les champs annoncés ;
 * - rejouer ne change rien de plus : ce qui est déjà à jour n'est pas réécrit.
 */

export interface SearchRow {
  readonly id: string;
  readonly label: string;
  readonly before: string;
  readonly after: string;
}

export interface SearchPlan {
  readonly contacts: readonly SearchRow[];
  readonly companies: readonly SearchRow[];
  readonly deals: readonly SearchRow[];
  readonly total: number;
}

function contactMirror(row: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  title: string;
  dep: string;
}): string {
  return searchText([row.firstName, row.lastName, row.email, row.phone, row.title, row.dep]);
}

function companyMirror(row: {
  name: string;
  domain: string;
  industry: string;
  loc: string;
}): string {
  return searchText([row.name, row.domain, row.industry, row.loc]);
}

function dealMirror(row: { name: string; offer: string }): string {
  return searchText([row.name, row.offer]);
}

/**
 * Fiches dont le miroir de recherche ne correspond pas à leur contenu.
 *
 * Le miroir est recalculé pour **toutes** les lignes puis comparé : c'est plus
 * sûr que de chercher les seules colonnes vides. Une fiche renommée avant que le
 * miroir n'existe porte une valeur non vide *et* fausse — la chercher par son
 * nouveau nom échouerait sans que rien ne paraisse anormal.
 */
export async function planSearchBackfill(): Promise<SearchPlan> {
  const [contactRows, companyRows, dealRows] = await Promise.all([
    prisma.contact.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        title: true,
        dep: true,
        searchText: true,
      },
    }),
    prisma.company.findMany({
      select: { id: true, name: true, domain: true, industry: true, loc: true, searchText: true },
    }),
    prisma.deal.findMany({ select: { id: true, name: true, offer: true, searchText: true } }),
  ]);

  const contacts = contactRows
    .map((row) => ({
      id: row.id,
      label: `${row.firstName} ${row.lastName}`.trim(),
      before: row.searchText,
      after: contactMirror(row),
    }))
    .filter((row) => row.before !== row.after);

  const companies = companyRows
    .map((row) => ({ id: row.id, label: row.name, before: row.searchText, after: companyMirror(row) }))
    .filter((row) => row.before !== row.after);

  const deals = dealRows
    .map((row) => ({ id: row.id, label: row.name, before: row.searchText, after: dealMirror(row) }))
    .filter((row) => row.before !== row.after);

  return {
    contacts,
    companies,
    deals,
    total: contacts.length + companies.length + deals.length,
  };
}

/**
 * Réécrit les miroirs. **Un seul champ touché par table.**
 *
 * `searchText` est dérivé : il ne porte aucune information qui ne soit déjà
 * ailleurs, et le recalculer ne peut donc rien perdre. C'est ce qui permet de
 * s'en passer de sauvegarde préalable, contrairement à une correction de statut.
 */
export async function applySearchBackfill(plan: SearchPlan): Promise<number> {
  if (plan.total === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const row of plan.contacts) {
      await tx.contact.update({ where: { id: row.id }, data: { searchText: row.after } });
    }
    for (const row of plan.companies) {
      await tx.company.update({ where: { id: row.id }, data: { searchText: row.after } });
    }
    for (const row of plan.deals) {
      await tx.deal.update({ where: { id: row.id }, data: { searchText: row.after } });
    }
  });

  return plan.total;
}

// ---------------------------------------------------------------- statuts

export interface LifecycleChange {
  readonly id: string;
  readonly label: string;
  readonly from: string;
  readonly fromReason: string;
  readonly lifecycle: string;
  readonly lostReason: string;
  readonly evidence: string;
  readonly uncertain: boolean;
}

export interface LifecyclePlan {
  readonly changes: readonly LifecycleChange[];
  /** Lignes de la feuille sans correspondance, ou en correspondant à plusieurs. */
  readonly warnings: readonly string[];
  readonly unchanged: number;
}

/** Forme minimale d'une correction, pour ne pas dépendre de `scripts/`. */
export interface CorrectionInput {
  readonly row: number;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly company: string;
  readonly lifecycle: string;
  readonly lostReason: string;
  readonly evidence: string;
}

const CANDIDATE_FIELDS = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  lifecycle: true,
  lostReason: true,
  lastContact: true,
  company: { select: { name: true } },
  _count: { select: { activities: true } },
} satisfies Prisma.ContactSelect;

type Candidate = Prisma.ContactGetPayload<{ select: typeof CANDIDATE_FIELDS }>;

/**
 * Rapprochement feuille ↔ base. L'adresse fait foi ; à défaut, nom + société,
 * comparés sans accents ni casse — la feuille écrit « Clément poyade » là où la
 * base porte « Clement Poyade ». Le nom seul serait trop lâche : deux « Claire »
 * dans deux sociétés ne sont pas la même personne.
 */
function matches(contact: Candidate, correction: CorrectionInput): boolean {
  const email = contact.email.trim().toLowerCase();
  if (correction.email !== "" && email !== "") return email === correction.email;

  return (
    fold(`${contact.firstName} ${contact.lastName}`) ===
      fold(`${correction.firstName} ${correction.lastName}`) &&
    fold(contact.company?.name ?? "") === fold(correction.company)
  );
}

/**
 * Que devient un « Ancien Client » que la feuille ne mentionne pas ?
 *
 * La table des clients signés de la feuille est vide : aucun achat n'est prouvé.
 * Ils retournent d'où ils viennent — `Prospect` si on les a touchés au moins une
 * fois, `Lead` sinon. C'est la seule distinction que la base permette de faire
 * honnêtement.
 */
function demote(contact: Candidate): { lifecycle: string; evidence: string } {
  const touched = contact.lastContact !== null || contact._count.activities > 0;
  return touched
    ? { lifecycle: "Prospect", evidence: "aucun achat prouvé, mais au moins une touche enregistrée" }
    : { lifecycle: "Lead", evidence: "aucun achat prouvé, aucune touche enregistrée" };
}

export async function planLifecycleFix(
  corrections: readonly CorrectionInput[],
): Promise<LifecyclePlan> {
  const candidates = await prisma.contact.findMany({ select: CANDIDATE_FIELDS });
  const warnings: string[] = [];
  const drafts: LifecycleChange[] = [];
  const claimed = new Set<string>();

  for (const correction of corrections) {
    const found = candidates.filter((contact) => matches(contact, correction));

    if (found.length === 0) {
      warnings.push(
        `ligne ${correction.row} — introuvable : ${correction.firstName} ${correction.lastName} (${correction.company})`,
      );
      continue;
    }
    if (found.length > 1) {
      warnings.push(
        `ligne ${correction.row} — ${found.length} fiches correspondent, ignorée : ${correction.firstName} ${correction.lastName}`,
      );
      continue;
    }

    const contact = found[0];
    if (contact === undefined) continue;
    claimed.add(contact.id);

    drafts.push({
      id: contact.id,
      label: `${contact.firstName} ${contact.lastName} (${contact.company?.name ?? "sans société"})`,
      from: contact.lifecycle,
      fromReason: contact.lostReason,
      lifecycle: correction.lifecycle,
      lostReason: correction.lostReason,
      evidence: correction.evidence,
      uncertain: correction.email === "" || contact.email.trim() === "",
    });
  }

  for (const contact of candidates) {
    if (contact.lifecycle !== "Ancien Client" || claimed.has(contact.id)) continue;
    const { lifecycle, evidence } = demote(contact);
    drafts.push({
      id: contact.id,
      label: `${contact.firstName} ${contact.lastName} (${contact.company?.name ?? "sans société"})`,
      from: contact.lifecycle,
      fromReason: contact.lostReason,
      lifecycle,
      lostReason: "",
      evidence,
      uncertain: false,
    });
  }

  const changes = drafts.filter(
    (change) => change.from !== change.lifecycle || change.fromReason !== change.lostReason,
  );

  return { changes, warnings, unchanged: drafts.length - changes.length };
}

/** État des fiches avant correction, à conserver hors base avant d'écrire. */
export function lifecycleSnapshot(plan: LifecyclePlan): unknown {
  return {
    takenAt: new Date().toISOString(),
    note: "État AVANT correction. Restaurer en réappliquant lifecycle et lostReason.",
    contacts: plan.changes.map((change) => ({
      id: change.id,
      label: change.label,
      lifecycle: change.from,
      lostReason: change.fromReason,
    })),
  };
}

/**
 * Applique les corrections de statut.
 *
 * Deux champs, jamais plus. Une interaction est consignée par fiche pour que
 * l'historique explique le changement dans six mois. Le tout en une
 * transaction : une base à moitié corrigée serait pire que pas corrigée.
 */
export async function applyLifecycleFix(plan: LifecyclePlan): Promise<number> {
  if (plan.changes.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const change of plan.changes) {
      await tx.contact.update({
        where: { id: change.id },
        data: { lifecycle: change.lifecycle, lostReason: change.lostReason },
      });

      const motif = change.lostReason === "" ? "" : ` (${change.lostReason})`;
      await tx.activity.create({
        data: {
          type: "note",
          date: new Date(),
          owner: "Correction",
          notes: `Statut corrigé depuis la feuille de prospection : ${change.from} → ${change.lifecycle}${motif}. ${change.evidence}`,
          contactId: change.id,
        },
      });
    }
  });

  return plan.changes.length;
}

// ---------------------------------------------------- noms débordés

export interface NameFixRow {
  readonly id: string;
  readonly field: "firstName" | "lastName";
  readonly before: string;
  readonly kept: string;
  readonly moved: string;
  readonly notesBefore: string;
}

/**
 * Noms qui ont avalé une note à l'import.
 *
 * « Alexandra Alexandra herrau, mais possible numéro de son équipe » est un nom
 * *et* un commentaire dans la même cellule. La coupe est **proposée**, jamais
 * appliquée seule : c'est une réécriture de donnée saisie, pas un champ dérivé.
 */
export async function planNameFix(): Promise<readonly NameFixRow[]> {
  const rows = await prisma.contact.findMany({
    select: { id: true, firstName: true, lastName: true, notes: true },
  });

  const plan: NameFixRow[] = [];
  for (const row of rows) {
    for (const field of ["firstName", "lastName"] as const) {
      const value = row[field];
      if (!nameOverflow(value)) continue;

      const { kept, moved } = splitOverflow(value);
      // Une coupe qui ne déplace rien, ou qui viderait le nom, n'apporte rien.
      if (moved === "" || kept === "") continue;

      plan.push({ id: row.id, field, before: value, kept, moved, notesBefore: row.notes });
    }
  }
  return plan;
}

/**
 * Applique les coupes. Deux champs touchés : le nom concerné et les notes, où le
 * débordement est **ajouté** — jamais substitué à ce qui s'y trouvait déjà.
 */
export async function applyNameFix(plan: readonly NameFixRow[]): Promise<number> {
  if (plan.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const row of plan) {
      const notes = row.notesBefore.trim() === ""
        ? row.moved
        : `${row.notesBefore}\n${row.moved}`;

      await tx.contact.update({
        where: { id: row.id },
        data: row.field === "firstName"
          ? { firstName: row.kept, notes }
          : { lastName: row.kept, notes },
      });
    }
  });

  return plan.length;
}

// ------------------------------------------- statuts saisis, depuis la feuille

/**
 * Report du `Statut Contact` de la feuille dans le statut **saisi**.
 *
 * Les corrections du jalon 11 n'avaient touché que `lifecycle` : le champ
 * `status`, qui l'emporte désormais sur le calcul, est resté vide sur toutes
 * les fiches. Chaque ligne affiche donc un statut déduit des dates plutôt que
 * ce que la feuille a réellement enregistré.
 *
 * Deux règles gouvernent ce qui suit, et elles sont ce que le reste du module
 * n'a pas :
 *
 * 1. **La feuille ne gagne pas contre le travail plus récent.** Une fiche
 *    portant un statut posé ou une interaction consignée après la dernière
 *    modification de la feuille est laissée intacte et listée à part. Une
 *    transcription vieille de trois jours n'écrase pas un appel d'hier.
 * 2. **Quatre champs, jamais plus** — `status`, `statusSetAt`, `lifecycle`,
 *    `lostReason`. Le téléphone, les notes, l'étiquette et la relance ne sont
 *    pas touchés.
 */
export interface SheetStatusInput {
  readonly row: number;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly company: string;
  readonly kind: "never" | "waiting" | "lost";
  readonly status: string;
  readonly lifecycle: string;
  readonly lostReason: string;
  readonly evidence: string;
}

export interface StatusChange {
  readonly id: string;
  readonly label: string;
  readonly kind: "never" | "waiting" | "lost";
  readonly fromStatus: string;
  readonly toStatus: string;
  readonly fromLifecycle: string;
  readonly toLifecycle: string;
  readonly fromReason: string;
  readonly toReason: string;
  readonly evidence: string;
  /** Rapproché sans adresse électronique : à relire. */
  readonly uncertain: boolean;
  /**
   * La feuille dit « À contacter » **et** « Pas intéressé ». Contradiction de
   * la source, tranchée en faveur du refus — on ne redémarche pas quelqu'un qui
   * a dit non — mais signalée plutôt que passée sous silence.
   */
  readonly conflicting: boolean;
  /**
   * Cette fiche porte encore une relance programmée. Le report de statut ne la
   * touche pas — c'est un cinquième champ, hors du périmètre — donc elle
   * continuera d'apparaître dans les listes de relance malgré « Jamais
   * contacté ».
   */
  readonly keepsReminder: boolean;
}

export interface TouchedRow {
  readonly label: string;
  readonly reason: string;
}

export interface StatusPlan {
  readonly changes: readonly StatusChange[];
  /** Fiches travaillées depuis la feuille : laissées intactes, listées à part. */
  readonly touched: readonly TouchedRow[];
  /** Lignes introuvables, ambiguës, ou sans statut exploitable. */
  readonly warnings: readonly string[];
  readonly unchanged: number;
}

const STATUS_FIELDS = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  lifecycle: true,
  lostReason: true,
  status: true,
  statusSetAt: true,
  nextReminder: true,
  company: { select: { name: true } },
  activities: {
    // La dernière interaction **qui ne vient pas d'une correction** : les
    // passages précédents en ont consigné une par fiche, et les compter ferait
    // passer chaque fiche déjà corrigée pour une fiche travaillée à la main.
    where: { NOT: { owner: "Correction" } },
    select: { date: true },
    orderBy: { date: "desc" },
    take: 1,
  },
} satisfies Prisma.ContactSelect;

type StatusCandidate = Prisma.ContactGetPayload<{ select: typeof STATUS_FIELDS }>;

/** Même rapprochement que les corrections de cycle de vie : adresse, sinon nom + société. */
function matchesSheet(contact: StatusCandidate, sheet: SheetStatusInput): boolean {
  const email = contact.email.trim().toLowerCase();
  if (sheet.email !== "" && email !== "") return email === sheet.email;

  return (
    fold(`${contact.firstName} ${contact.lastName}`) ===
      fold(`${sheet.firstName} ${sheet.lastName}`) &&
    fold(contact.company?.name ?? "") === fold(sheet.company)
  );
}

/** La fiche a-t-elle été travaillée depuis que la feuille a été enregistrée ? */
function workedSince(contact: StatusCandidate, cutoff: Date): string | null {
  if (contact.statusSetAt !== null && contact.statusSetAt > cutoff) {
    return `statut « ${contact.status} » posé le ${contact.statusSetAt.toLocaleDateString("fr-FR")}`;
  }
  const last = contact.activities[0]?.date;
  if (last !== undefined && last > cutoff) {
    return `interaction consignée le ${last.toLocaleDateString("fr-FR")}`;
  }
  return null;
}

/**
 * De quoi retrouver une ligne à la main.
 *
 * Le nom seul ne suffit pas : les lignes qui échouent au rapprochement sont
 * précisément celles où la feuille n'en porte pas. « introuvable : (Canopée) »
 * n'aide personne ; l'adresse et la société, si.
 */
function describeLine(line: SheetStatusInput): string {
  const name = `${line.firstName} ${line.lastName}`.trim();
  const parts = [
    name === "" ? "sans nom" : name,
    line.company === "" ? null : line.company,
    line.email === "" ? null : line.email,
  ].filter((part): part is string => part !== null);
  return parts.join(" · ");
}

export async function planStatusFix(
  sheet: readonly SheetStatusInput[],
  cutoff: Date,
  unreadable: readonly string[] = [],
): Promise<StatusPlan> {
  const candidates = await prisma.contact.findMany({ select: STATUS_FIELDS });
  const warnings: string[] = [...unreadable];
  const touched: TouchedRow[] = [];
  const drafts: StatusChange[] = [];

  for (const line of sheet) {
    const found = candidates.filter((contact) => matchesSheet(contact, line));

    if (found.length === 0) {
      warnings.push(`ligne ${line.row} — introuvable : ${describeLine(line)}`);
      continue;
    }
    if (found.length > 1) {
      warnings.push(
        `ligne ${line.row} — ${found.length} fiches correspondent, ignorée : ${describeLine(line)}`,
      );
      continue;
    }

    const contact = found[0];
    if (contact === undefined) continue;

    const label = `${contact.firstName} ${contact.lastName} (${contact.company?.name ?? "sans société"})`;

    const recent = workedSince(contact, cutoff);
    if (recent !== null) {
      touched.push({ label: `${label} — ${recent}`, reason: recent });
      continue;
    }

    // Une fiche déjà `Perdu` reste `Perdu` : le passage précédent avait tranché
    // avec les mêmes preuves, et repasser dessus réécrirait un motif choisi.
    const alreadyLost = contact.lifecycle === LOST_LIFECYCLE;
    const toLifecycle = line.lifecycle === "" || alreadyLost ? contact.lifecycle : line.lifecycle;
    const toReason =
      line.lostReason === "" || alreadyLost ? contact.lostReason : line.lostReason;

    drafts.push({
      id: contact.id,
      label,
      kind: line.kind,
      fromStatus: contact.status,
      toStatus: line.status === "" ? contact.status : line.status,
      fromLifecycle: contact.lifecycle,
      toLifecycle,
      fromReason: contact.lostReason,
      toReason,
      evidence: line.evidence,
      uncertain: line.email === "" || contact.email.trim() === "",
      conflicting: line.kind === "lost" && line.evidence.includes("À contacter"),
      keepsReminder: line.kind === "never" && contact.nextReminder !== null,
    });
  }

  const changes = drafts.filter(
    (change) =>
      change.fromStatus !== change.toStatus ||
      change.fromLifecycle !== change.toLifecycle ||
      change.fromReason !== change.toReason,
  );

  return { changes, touched, warnings, unchanged: drafts.length - changes.length };
}

/** État des fiches avant report, à conserver hors base avant d'écrire. */
export function statusSnapshot(plan: StatusPlan): unknown {
  return {
    takenAt: new Date().toISOString(),
    note: "État AVANT report des statuts. Restaurer en réappliquant status, statusSetAt, lifecycle et lostReason.",
    contacts: plan.changes.map((change) => ({
      id: change.id,
      label: change.label,
      status: change.fromStatus,
      lifecycle: change.fromLifecycle,
      lostReason: change.fromReason,
    })),
  };
}

/**
 * Applique le report. Quatre champs, une interaction par fiche, une transaction.
 *
 * `statusSetAt` prend la date de la **feuille**, pas celle du jour : le statut
 * dit ce qui était su au 7 août, et l'horodater d'aujourd'hui ferait passer une
 * transcription pour une observation fraîche — la puce « Statut figé » cesserait
 * de repérer ces fiches, alors qu'elles sont précisément celles à rafraîchir.
 */
export async function applyStatusFix(plan: StatusPlan, stampedAt: Date): Promise<number> {
  if (plan.changes.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const change of plan.changes) {
      await tx.contact.update({
        where: { id: change.id },
        data: {
          status: change.toStatus,
          statusSetAt: change.toStatus === "" ? null : stampedAt,
          lifecycle: change.toLifecycle,
          lostReason: change.toReason,
        },
      });

      const parts: string[] = [];
      if (change.fromStatus !== change.toStatus) {
        parts.push(`statut « ${change.fromStatus || "(vide)"} » → « ${change.toStatus} »`);
      }
      if (change.fromLifecycle !== change.toLifecycle) {
        parts.push(`cycle de vie ${change.fromLifecycle} → ${change.toLifecycle}`);
      }
      if (change.fromReason !== change.toReason) {
        parts.push(`motif « ${change.toReason} »`);
      }

      await tx.activity.create({
        data: {
          type: "note",
          date: new Date(),
          owner: "Correction",
          notes: `Report depuis la feuille de prospection : ${parts.join(", ")}. ${change.evidence}`,
          contactId: change.id,
        },
      });
    }
  });

  return plan.changes.length;
}

// ------------------------------------------------- « SITE : » dans les notes

/**
 * Le site est dans les notes, pas dans le champ prévu pour lui.
 *
 * L'import de la feuille versait toute colonne non reconnue dans `Notes` —
 * `SITE :` en fait partie. Le site existe donc déjà dans la donnée, mais il
 * n'est ni cliquable, ni filtrable, ni lisible par les outils du conseil.
 *
 * Deux garanties, dans l'ordre où elles comptent :
 *
 * 1. **On ne devine pas.** « SITE : Shopify » ou « SITE : Argalys Essentiels »
 *    sont un nom de plateforme ou un titre, pas un domaine — `findSiteLine()`
 *    les rend `null` plutôt que de proposer n'importe quoi, et la ligne est
 *    listée à part. Vérifié sur la vraie feuille : 64 lignes « SITE : »
 *    portent un titre, 8 portent un domaine exploitable.
 * 2. **On ne remplace jamais.** `website` n'est rempli que s'il est vide, et
 *    les Notes ne sont jamais modifiées — copie, pas déplacement.
 */
export interface WebsiteFixRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly sourceLine: string;
  readonly companyId: string | null;
  /** La société n'a pas encore de domaine : le remplir aussi. */
  readonly fillCompanyDomain: boolean;
}

export interface WebsiteFixPlan {
  readonly rows: readonly WebsiteFixRow[];
  /** Une ligne « SITE : » existe mais ne contient rien d'extractible. */
  readonly unresolved: readonly string[];
  /** Autres motifs structurés vus dans les mêmes notes — signalés, pas traités. */
  readonly otherPatterns: OtherPatternCounts;
}

export async function planWebsiteFix(): Promise<WebsiteFixPlan> {
  const contacts = await prisma.contact.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      notes: true,
      website: true,
      companyId: true,
      company: { select: { domain: true } },
    },
  });

  const rows: WebsiteFixRow[] = [];
  const unresolved: string[] = [];

  for (const contact of contacts) {
    // Jamais sur une fiche où quelqu'un a déjà saisi le site — la correction
    // n'écrit que du vide, elle ne corrige pas une valeur existante.
    if (contact.website !== "") continue;

    const found = findSiteLine(contact.notes);
    if (found === undefined) continue;

    const label = `${contact.firstName} ${contact.lastName}`.trim();

    if (found.value === null) {
      unresolved.push(`${label} — ${found.line}`);
      continue;
    }

    rows.push({
      id: contact.id,
      label,
      value: found.value,
      sourceLine: found.line,
      companyId: contact.companyId,
      fillCompanyDomain: contact.companyId !== null && (contact.company?.domain ?? "") === "",
    });
  }

  return {
    rows,
    unresolved,
    otherPatterns: countOtherPatterns(contacts.map((contact) => contact.notes)),
  };
}

/** État avant écriture — deux champs seulement, jamais les Notes. */
export function websiteSnapshot(plan: WebsiteFixPlan): unknown {
  return {
    takenAt: new Date().toISOString(),
    note: "État AVANT extraction des sites depuis les Notes. Restaurer en revidant website (et domain si listé).",
    contacts: plan.rows.map((row) => ({ id: row.id, label: row.label })),
  };
}

export async function applyWebsiteFix(plan: WebsiteFixPlan): Promise<number> {
  if (plan.rows.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const row of plan.rows) {
      await tx.contact.update({ where: { id: row.id }, data: { website: row.value } });

      if (row.fillCompanyDomain && row.companyId !== null) {
        // Une deuxième fiche de la même société a pu déjà remplir le domaine
        // pendant cette même transaction : `updateMany` avec la condition
        // « toujours vide » évite d'écraser cette écriture-là.
        await tx.company.updateMany({
          where: { id: row.companyId, domain: "" },
          data: { domain: row.value },
        });
      }
    }
  });

  return plan.rows.length;
}

// ------------------------------------------ « SITE » de la feuille, transcrit

/**
 * Les adresses réellement présentes dans la feuille, reportées sur les fiches.
 *
 * Distinct de `planWebsiteFix()`, et pour une raison de fond : celle-là lit les
 * **Notes** du CRM, qui sont une copie de la feuille faite à l'import. Une ligne
 * que l'import a refusée — nom manquant, doublon — n'a laissé aucune note, et
 * son adresse est donc invisible à l'extraction. Sur les 15 adresses de la
 * feuille, six appartiennent à des lignes dans ce cas.
 *
 * Cette correction-ci part de la **source**, transcrite dans
 * `scripts/sites-2026-08.ts`, et se rapproche des fiches comme les autres
 * reports de feuille : par adresse électronique, à défaut par nom + société.
 *
 * Deux champs, jamais plus : `website` du contact et `domain` de sa société,
 * **et seulement s'ils sont vides**. Les Notes ne sont pas touchées.
 */
export interface SiteChange {
  readonly id: string;
  readonly label: string;
  readonly row: string;
  readonly url: string;
  readonly source: string;
  readonly companyId: string | null;
  readonly companyName: string;
  /** La société n'a pas de domaine : il sera rempli avec la même valeur. */
  readonly fillCompanyDomain: boolean;
}

export interface SitePlan {
  readonly changes: readonly SiteChange[];
  /** Lignes de la feuille sans correspondance, ou en correspondant à plusieurs. */
  readonly warnings: readonly string[];
  /** Fiches déjà pourvues d'un site : laissées intactes. */
  readonly unchanged: number;
}

const SITE_FIELDS = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  website: true,
  companyId: true,
  company: { select: { name: true, domain: true } },
} satisfies Prisma.ContactSelect;

type SiteCandidate = Prisma.ContactGetPayload<{ select: typeof SITE_FIELDS }>;

function matchesSite(contact: SiteCandidate, line: SheetSite): boolean {
  const email = contact.email.trim().toLowerCase();
  if (line.email !== "" && email !== "") return email === line.email;

  return (
    fold(`${contact.firstName} ${contact.lastName}`) ===
      fold(`${line.firstName} ${line.lastName}`) &&
    fold(contact.company?.name ?? "") === fold(line.company)
  );
}

export async function planSiteFix(sheet: readonly SheetSite[]): Promise<SitePlan> {
  const candidates = await prisma.contact.findMany({ select: SITE_FIELDS });
  const warnings: string[] = [];
  const changes: SiteChange[] = [];
  let unchanged = 0;

  // Les domaines déjà promis à une société dans ce même plan : sans ce suivi,
  // deux fiches de la même société annonceraient toutes deux « + domaine ».
  const promised = new Set<string>();

  for (const line of sheet) {
    const found = candidates.filter((contact) => matchesSite(contact, line));
    const who = `${line.firstName} ${line.lastName}`.trim() || "sans nom";

    if (found.length === 0) {
      warnings.push(
        `ligne ${line.row} — introuvable : ${who}${line.company === "" ? "" : ` · ${line.company}`}${line.email === "" ? "" : ` · ${line.email}`} (${line.url})`,
      );
      continue;
    }
    if (found.length > 1) {
      warnings.push(`ligne ${line.row} — ${found.length} fiches correspondent, ignorée : ${who}`);
      continue;
    }

    const contact = found[0];
    if (contact === undefined) continue;

    const companyHasDomain = (contact.company?.domain ?? "") !== "";
    const fillCompanyDomain =
      contact.companyId !== null && !companyHasDomain && !promised.has(contact.companyId);

    // Rien à écrire : le site est déjà là et la société a déjà son domaine.
    if (contact.website !== "" && !fillCompanyDomain) {
      unchanged += 1;
      continue;
    }

    if (fillCompanyDomain && contact.companyId !== null) promised.add(contact.companyId);

    changes.push({
      id: contact.id,
      label: `${contact.firstName} ${contact.lastName}`.trim(),
      row: line.row,
      url: line.url,
      source: line.source,
      companyId: contact.companyId,
      companyName: contact.company?.name ?? "sans société",
      fillCompanyDomain,
    });
  }

  return { changes, warnings, unchanged };
}

/** État avant report — de quoi revenir en arrière champ par champ. */
export function siteSnapshot(plan: SitePlan): unknown {
  return {
    takenAt: new Date().toISOString(),
    note: "État AVANT report des sites depuis la feuille. Restaurer en revidant website (et domain des sociétés listées).",
    contacts: plan.changes.map((change) => ({
      id: change.id,
      label: change.label,
      company: change.companyName,
      companyId: change.companyId,
      wroteCompanyDomain: change.fillCompanyDomain,
    })),
  };
}

export async function applySiteFix(plan: SitePlan): Promise<number> {
  if (plan.changes.length === 0) return 0;

  await prisma.$transaction(async (tx) => {
    for (const change of plan.changes) {
      // `updateMany` avec la condition « encore vide » plutôt qu'`update` : la
      // garantie « on ne remplace jamais » est portée par la requête, pas par
      // la lecture faite plus tôt.
      await tx.contact.updateMany({
        where: { id: change.id, website: "" },
        data: { website: change.url },
      });

      if (change.fillCompanyDomain && change.companyId !== null) {
        const company = await tx.company.findUnique({
          where: { id: change.companyId },
          select: { name: true, industry: true, loc: true },
        });
        if (company === null) continue;

        await tx.company.updateMany({
          where: { id: change.companyId, domain: "" },
          data: {
            domain: change.url,
            searchText: companyMirror({ ...company, domain: change.url }),
          },
        });
      }
    }
  });

  return plan.changes.length;
}
