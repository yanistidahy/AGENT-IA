import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { applyTaskIntent, ownerOrDefault, type AutoTaskOutcome } from "./automation";
import { resolveCompanyLink } from "./company-resolve";
import { planStageMove } from "../domain/deal-transitions";
import { canReopen, planLoss, planReopen } from "../domain/deal-loss";
import { inheritedCompanyId } from "../domain/deal-company";
import {
  deletionVerdict,
  describeRefusal,
  type DeletionFacts,
  type DeletionVerdict,
} from "../domain/deal-deletion";
import { stageTask } from "../domain/automation";
import { toDealStatus, toLifecycle } from "../domain/guards";
import type { DealLike, DealStatus, Lifecycle, StageLike } from "../domain/types";
import type { CreateDealInput, ListDealsQuery, UpdateDealInput } from "./deal-schemas";
import { listStages } from "./reference";
import type { FilterState } from "../domain/column-filters";
import { facetsFor, type FacetValue } from "../domain/column-match";
import { searchText, searchTerm } from "../domain/text";
import { columnsWhere } from "./column-filters";
import {
  DEAL_DB_COLUMNS,
  DEAL_FACET_COLUMNS,
  type DealFacetRow,
} from "./deal-columns";

/**
 * Accès aux affaires.
 *
 * Cette couche est appelée par les routes d'API *et* directement par les
 * composants serveur. Une page ne fait donc pas de requête HTTP vers sa propre
 * API : une seule source de vérité, un aller-retour réseau en moins.
 *
 */

/**
 * Recherche insensible à la casse et aux accents de position.
 *
 * `mode: "insensitive"` est propre à PostgreSQL — le type `Prisma.StringFilter`
 * généré pour SQLite ne comporte même pas ce champ, si bien que le code ne
 * compile pas contre un schéma SQLite. C'est assumé : la cible est PostgreSQL.
 * Voir CLAUDE.md § Base de données.
 */
function containsFilter(value: string): Prisma.StringFilter {
  return { contains: value, mode: "insensitive" };
}

export interface DealRecord extends DealLike {
  readonly offer: string;
  readonly notes: string;
  /** Motif de perte. Vide sur une affaire en cours ou gagnée. */
  readonly lostReason: string;
  readonly companyId: string | null;
  readonly contactId: string | null;
  readonly company: { readonly id: string; readonly name: string } | null;
  readonly contact: {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
    readonly lifecycle: Lifecycle;
  } | null;
  readonly stage: StageLike;
}

const dealInclude = {
  company: { select: { id: true, name: true } },
  contact: { select: { id: true, firstName: true, lastName: true, lifecycle: true } },
  stage: true,
} satisfies Prisma.DealInclude;

type DealRow = Prisma.DealGetPayload<{ include: typeof dealInclude }>;

function toRecord(row: DealRow): DealRecord {
  return {
    id: row.id,
    name: row.name,
    amount: row.amount,
    stageId: row.stageId,
    status: toDealStatus(row.status),
    prob: row.prob,
    owner: row.owner,
    offer: row.offer,
    notes: row.notes,
    lostReason: row.lostReason,
    createdAt: row.createdAt,
    expectedClose: row.expectedClose,
    lastActivityAt: row.lastActivityAt,
    closedAt: row.closedAt,
    companyId: row.companyId,
    contactId: row.contactId,
    company: row.company,
    contact:
      row.contact === null
        ? null
        : { ...row.contact, lifecycle: toLifecycle(row.contact.lifecycle) },
    stage: {
      id: row.stage.id,
      name: row.stage.name,
      color: row.stage.color,
      prob: row.stage.prob,
      position: row.stage.position,
    },
  };
}

function orderBy(query: ListDealsQuery): Prisma.DealOrderByWithRelationInput[] {
  const dir = query.dir ?? "asc";
  switch (query.sort) {
    case "name":
      return [{ name: dir }];
    case "amount":
      return [{ amount: dir }];
    case "expectedClose":
      return [{ expectedClose: dir }];
    case "lastActivityAt":
      return [{ lastActivityAt: dir }];
    case "createdAt":
      return [{ createdAt: dir }];
    case "owner":
      return [{ owner: dir }, { name: "asc" }];
    default:
      // Défaut : les affaires les plus grosses en tête, comme dans le prototype.
      return [{ amount: "desc" }];
  }
}

export async function listDeals(
  query: ListDealsQuery = {},
  filters: FilterState = {},
  now: Date = new Date(),
): Promise<DealRecord[]> {
  const rows = await prisma.deal.findMany({
    where: dealsWhere(query, filters, now),
    include: dealInclude,
    orderBy: orderBy(query),
  });
  return rows.map(toRecord);
}

function dealsWhere(
  query: ListDealsQuery,
  filters: FilterState,
  now: Date,
): Prisma.DealWhereInput {
  const and: Prisma.DealWhereInput[] = [];

  if (query.stageId !== undefined) and.push({ stageId: query.stageId });
  if (query.owner !== undefined) and.push({ owner: query.owner });
  if (query.status !== undefined && query.status !== "all") and.push({ status: query.status });

  // Recherche insensible aux accents, sur le miroir normalisé de l'affaire ou
  // celui de sa société — voir lib/domain/text.ts.
  const term = searchTerm(query.q);
  if (term !== "") {
    and.push({
      OR: [{ searchText: { contains: term } }, { company: { searchText: { contains: term } } }],
    });
  }

  const columns = columnsWhere(filters, DEAL_DB_COLUMNS, now);
  if (Object.keys(columns).length > 0) and.push(columns as Prisma.DealWhereInput);

  return and.length === 0 ? {} : { AND: and };
}

/** Valeurs distinctes des colonnes de `/affaires`. */
export async function dealFacets(
  query: ListDealsQuery,
  filters: FilterState,
  now: Date = new Date(),
): Promise<{
  readonly facets: Readonly<Record<string, readonly FacetValue[]>>;
  readonly total: number;
}> {
  const rows = await prisma.deal.findMany({
    where: dealsWhere(query, {}, now),
    select: {
      id: true,
      owner: true,
      offer: true,
      amount: true,
      expectedClose: true,
      lastActivityAt: true,
      stage: { select: { name: true } },
      company: { select: { name: true } },
    },
  });

  const projected: DealFacetRow[] = rows.map((row) => ({
    id: row.id,
    stage: row.stage.name,
    owner: row.owner,
    offer: row.offer,
    companyName: row.company?.name ?? null,
    amount: row.amount,
    expectedClose: row.expectedClose,
    lastActivityAt: row.lastActivityAt,
  }));

  return {
    facets: facetsFor(projected, DEAL_FACET_COLUMNS, filters, now),
    total: projected.length,
  };
}

/**
 * Comptes par statut, sur **toutes** les affaires.
 *
 * Volontairement indépendant des filtres en cours : une puce qui compterait son
 * propre résultat afficherait toujours le total de ce qu'elle vient de
 * sélectionner, ce qui n'apprend rien. Même règle que les puces de /contacts.
 */
export async function countDealsByStatus(): Promise<Record<string, number>> {
  const rows = await prisma.deal.groupBy({ by: ["status"], _count: { _all: true } });

  const counts: Record<string, number> = {};
  let all = 0;
  for (const row of rows) {
    counts[row.status] = row._count._all;
    all += row._count._all;
  }
  return { ...counts, all };
}

export async function getDeal(id: string): Promise<DealRecord | null> {
  const row = await prisma.deal.findUnique({ where: { id }, include: dealInclude });
  return row === null ? null : toRecord(row);
}

/**
 * Création d'une affaire.
 *
 * `companyName` crée la société dans la même transaction — même règle que pour
 * les contacts : on découvre souvent l'affaire et la société ensemble.
 */
/**
 * La société du contact principal, s'il y en a une.
 *
 * Séparée de `resolveCompanyLink` volontairement : celle-là traduit ce que le
 * formulaire a saisi, celle-ci comble ce qu'il a laissé vide. Les mêler ferait
 * qu'un `companyId: null` explicite — un détachement voulu — se verrait
 * aussitôt rerempli par le contact.
 */
async function contactCompanyId(
  tx: Prisma.TransactionClient,
  contactId: string | null,
): Promise<string | null> {
  if (contactId === null) return null;
  const contact = await tx.contact.findUnique({
    where: { id: contactId },
    select: { companyId: true },
  });
  return inheritedCompanyId({
    dealCompanyId: null,
    contactCompanyId: contact?.companyId ?? null,
  });
}

export async function createDeal(input: CreateDealInput): Promise<DealRecord> {
  const now = new Date();
  const row = await prisma.$transaction(async (tx) => {
    const chosen = await resolveCompanyLink(tx, input);
    // Une affaire rattachée à quelqu'un appartient à la société de ce
    // quelqu'un : sans ce repli, choisir un contact sans choisir de société
    // donne une affaire hors des totaux de `/societes`, et seul un « Sans
    // société » en petit sur la carte le dit. La règle ne comble qu'un vide.
    const companyId = chosen ?? (await contactCompanyId(tx, input.contactId ?? null));
    const created = await tx.deal.create({
    data: {
      searchText: searchText([input.name, input.offer]),
      name: input.name,
      amount: input.amount,
      stageId: input.stageId,
      owner: input.owner,
      offer: input.offer ?? "",
      notes: input.notes ?? "",
      companyId: companyId ?? null,
      contactId: input.contactId ?? null,
      expectedClose: input.expectedClose ?? null,
      prob: input.prob ?? null,
      status: "open",
      lastActivityAt: now,
      stageSince: now,
    },
    include: dealInclude,
    });

    // Première visite, écrite dans la même transaction que l'affaire : une
    // affaire sans visite d'entrée serait invisible des durées par étape, et
    // l'oubli ne se verrait qu'au moment de lire le rapport.
    await tx.dealStageVisit.create({
      data: { dealId: created.id, stageId: created.stageId, enteredAt: now },
    });
    return created;
  });
  return toRecord(row);
}

/**
 * Mise à jour partielle : seules les clés présentes dans la charge utile sont
 * écrites. `expectedClose: null` efface la date, son absence la laisse intacte.
 */
export async function updateDeal(
  id: string,
  input: UpdateDealInput,
): Promise<DealRecord | null> {
  const existing = await prisma.deal.findUnique({ where: { id } });
  if (existing === null) return null;

  const data: Prisma.DealUpdateInput = { lastActivityAt: new Date() };

  if (input.name !== undefined) data.name = input.name;
  if (input.amount !== undefined) data.amount = input.amount;
  if (input.owner !== undefined) data.owner = input.owner;
  if (input.offer !== undefined) data.offer = input.offer;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.prob !== undefined) data.prob = input.prob;
  if (input.expectedClose !== undefined) data.expectedClose = input.expectedClose;
  if (input.stageId !== undefined) data.stage = { connect: { id: input.stageId } };

  // Miroir de recherche : recalculé sur les valeurs finales, pas seulement sur
  // les champs envoyés — modifier le seul nom doit suffire à le rafraîchir.
  data.searchText = searchText([input.name ?? existing.name, input.offer ?? existing.offer]);

  if (input.contactId !== undefined) {
    data.contact =
      input.contactId === null ? { disconnect: true } : { connect: { id: input.contactId } };
  }

  if (input.status !== undefined) {
    data.status = input.status;
    data.closedAt = input.status === "open" ? null : (existing.closedAt ?? new Date());
  }

  const row = await prisma.$transaction(async (tx) => {
    const chosen = await resolveCompanyLink(tx, input);
    if (chosen !== undefined) {
      data.company = chosen === null ? { disconnect: true } : { connect: { id: chosen } };
    }

    // Même repli qu'à la création, sur l'état **résultant** : rattacher un
    // contact à une affaire sans société doit suffire à la renseigner. Un
    // `companyId: null` explicite reste un détachement voulu — il vient du
    // formulaire et sort par la branche ci-dessus, pas par celle-ci.
    const resultingCompany = chosen === undefined ? existing.companyId : chosen;
    const resultingContact =
      input.contactId === undefined ? existing.contactId : input.contactId;
    if (resultingCompany === null && chosen !== null) {
      const inherited = await contactCompanyId(tx, resultingContact);
      if (inherited !== null) data.company = { connect: { id: inherited } };
    }

    return tx.deal.update({ where: { id }, data, include: dealInclude });
  });

  return toRecord(row);
}

export type MoveStageResult =
  | {
      readonly ok: true;
      readonly deal: DealRecord;
      /** Tâche d'étape créée ou déplacée, à annoncer à l'utilisateur. */
      readonly autoTask: AutoTaskOutcome | null;
    }
  | { readonly ok: false; readonly reason: "deal_not_found" | "stage_not_found" };

/**
 * Déplacement d'étape. La règle métier vit dans `lib/domain/deal-transitions`,
 * appliquée ici dans une transaction avec la note système : l'affaire et son
 * historique restent cohérents même si la seconde écriture échoue.
 */
export async function moveDealStage(id: string, stageId: string): Promise<MoveStageResult> {
  const [existing, stages] = await Promise.all([
    prisma.deal.findUnique({ where: { id }, include: dealInclude }),
    listStages(),
  ]);

  if (existing === null) return { ok: false, reason: "deal_not_found" };

  const target = stages.find((stage) => stage.id === stageId);
  if (target === undefined) return { ok: false, reason: "stage_not_found" };

  const current = toRecord(existing);
  const plan = planStageMove(
    current,
    stages.find((stage) => stage.id === current.stageId),
    target,
    new Date(),
  );

  const changed = current.stageId !== plan.stageId;

  const { row, autoTask } = await prisma.$transaction(async (tx) => {
    const updated = await tx.deal.update({
      where: { id },
      data: {
        stageId: plan.stageId,
        status: plan.status,
        closedAt: plan.closedAt,
        lastActivityAt: plan.lastActivityAt,
        // Ancienneté *dans l'étape*, distincte de la dernière touche : une
        // affaire peut être relancée sans avancer d'un pouce dans le pipeline.
        ...(changed ? { stageSince: plan.lastActivityAt } : {}),
      },
      include: dealInclude,
    });

    if (changed) {
      await tx.dealStageVisit.create({
        data: { dealId: id, stageId: plan.stageId, enteredAt: plan.lastActivityAt },
      });
    }

    await tx.activity.create({
      data: {
        type: "note",
        date: plan.lastActivityAt,
        owner: current.owner,
        notes: plan.note,
        dealId: id,
        contactId: current.contactId,
        companyId: current.companyId,
      },
    });

    // Action de suivi propre à l'étape d'arrivée, si elle en déclare une.
    // Idempotente par `stage:<affaire>:<étape>` : repasser par la même étape
    // déplace la tâche existante, il n'en apparaît jamais deux.
    if (!changed) return { row: updated, autoTask: null };

    const stageRow = await tx.stage.findUnique({
      where: { id: plan.stageId },
      select: { nextActionLabel: true, nextActionDays: true },
    });
    if (stageRow === null) return { row: updated, autoTask: null };

    const intent = stageTask({
      dealId: updated.id,
      dealName: updated.name,
      stageId: plan.stageId,
      stageLabel: stageRow.nextActionLabel,
      stageDays: stageRow.nextActionDays,
      owner: await ownerOrDefault(tx, updated.owner),
      from: plan.lastActivityAt,
    });

    return {
      row: updated,
      autoTask: intent === null ? null : await applyTaskIntent(tx, intent),
    };
  });

  return { ok: true, deal: toRecord(row), autoTask };
}

/**
 * Marquer une affaire perdue.
 *
 * L'étape n'est pas touchée — perdre fait sortir du tableau, pas reculer dans
 * le pipeline — et c'est ce qui rend la réouverture exacte sans stocker
 * d'« étape d'avant ». La note système part dans la même transaction : une
 * affaire close dont l'historique ne dit pas pourquoi serait à rouvrir à
 * l'aveugle dans six mois.
 */
export async function markDealLost(
  id: string,
  reason: string,
): Promise<DealRecord | null> {
  const existing = await prisma.deal.findUnique({ where: { id } });
  if (existing === null) return null;

  const plan = planLoss(reason, new Date());

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.deal.update({
      where: { id },
      data: {
        status: plan.status,
        closedAt: plan.closedAt,
        lostReason: plan.lostReason,
        lastActivityAt: plan.lastActivityAt,
      },
      include: dealInclude,
    });
    await tx.activity.create({
      data: {
        type: "note",
        date: plan.lastActivityAt,
        owner: existing.owner,
        notes: plan.note,
        dealId: id,
        contactId: existing.contactId,
        companyId: existing.companyId,
      },
    });
    return updated;
  });

  return toRecord(row);
}

export type ReopenResult =
  | { readonly ok: true; readonly deal: DealRecord }
  | { readonly ok: false; readonly reason: "not_found" | "already_open" };

/**
 * Rouvrir. L'affaire revient dans la colonne qu'elle n'a jamais quittée.
 *
 * Rouvrir plutôt que recréer : recréer perdrait l'historique, la date de
 * création — donc la vélocité — et le fil des échanges déjà consignés.
 */
export async function reopenDeal(id: string): Promise<ReopenResult> {
  const existing = await prisma.deal.findUnique({ where: { id } });
  if (existing === null) return { ok: false, reason: "not_found" };
  if (!canReopen(toDealStatus(existing.status))) {
    return { ok: false, reason: "already_open" };
  }

  const plan = planReopen(existing.lostReason, new Date());

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.deal.update({
      where: { id },
      data: {
        status: plan.status,
        closedAt: plan.closedAt,
        lostReason: plan.lostReason,
        lastActivityAt: plan.lastActivityAt,
      },
      include: dealInclude,
    });
    await tx.activity.create({
      data: {
        type: "note",
        date: plan.lastActivityAt,
        owner: existing.owner,
        notes: plan.note,
        dealId: id,
        contactId: existing.contactId,
        companyId: existing.companyId,
      },
    });
    return updated;
  });

  return { ok: true, deal: toRecord(row) };
}

export interface DeletionReport {
  readonly name: string;
  readonly amount: number;
  readonly facts: DeletionFacts;
  readonly verdict: DeletionVerdict;
  /** Vide quand la suppression est possible. */
  readonly refusal: string;
}

/**
 * Les faits qui décident, comptés en base.
 *
 * Rendus **avant** de demander confirmation : une confirmation qui ne sait pas
 * ce qu'elle va détruire ne vaut pas mieux qu'un « Êtes-vous sûr ? ».
 */
export async function dealDeletionReport(id: string): Promise<DeletionReport | null> {
  const deal = await prisma.deal.findUnique({
    where: { id },
    select: { name: true, amount: true, status: true },
  });
  if (deal === null) return null;

  const [realActivities, notes, stageVisits, tasks] = await Promise.all([
    prisma.activity.count({ where: { dealId: id, type: { not: "note" } } }),
    prisma.activity.count({ where: { dealId: id, type: "note" } }),
    prisma.dealStageVisit.count({ where: { dealId: id } }),
    prisma.task.count({ where: { dealId: id } }),
  ]);

  const facts: DeletionFacts = {
    status: toDealStatus(deal.status),
    realActivities,
    notes,
    stageVisits,
    tasks,
  };
  const verdict = deletionVerdict(facts);

  return {
    name: deal.name,
    amount: deal.amount,
    facts,
    verdict,
    refusal: describeRefusal(facts, verdict),
  };
}

export type DeleteDealResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "not_found" }
  | { readonly ok: false; readonly reason: "has_history"; readonly message: string };

/**
 * Supprimer — pour un doublon ou une saisie d'essai, jamais pour sortir une
 * affaire du pipeline.
 *
 * Le verdict est **relu au moment d'écrire**, pas seulement à l'affichage : la
 * confirmation peut rester ouverte pendant qu'un appel se consigne ailleurs, et
 * c'est exactement le moment où l'affaire cesse d'être supprimable. Même
 * principe que les corrections de `/reglages` au jalon 12.
 */
export async function deleteDeal(id: string): Promise<DeleteDealResult> {
  const report = await dealDeletionReport(id);
  if (report === null) return { ok: false, reason: "not_found" };
  if (!report.verdict.deletable) {
    return { ok: false, reason: "has_history", message: report.refusal };
  }

  // Les notes et visites d'étape partent explicitement : `Activity.dealId` est
  // en `SetNull`, sans quoi la suppression laisserait des notes orphelines
  // parlant d'une affaire qui n'existe plus.
  await prisma.$transaction(async (tx) => {
    await tx.activity.deleteMany({ where: { dealId: id } });
    await tx.dealStageVisit.deleteMany({ where: { dealId: id } });
    await tx.deal.delete({ where: { id } });
  });

  return { ok: true };
}

/** Statuts acceptés par les filtres de la vue liste. */
export const DEAL_STATUS_FILTERS: ReadonlyArray<{ value: DealStatus | "all"; label: string }> = [
  { value: "open", label: "En cours" },
  { value: "won", label: "Gagnées" },
  { value: "lost", label: "Perdues" },
  { value: "all", label: "Toutes" },
];
