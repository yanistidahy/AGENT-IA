import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { fold, searchText } from "../domain/text";

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
