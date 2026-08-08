import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { applyTaskIntent, ownerOrDefault, type AutoTaskOutcome } from "./automation";
import { resolveCompanyLink } from "./company-resolve";
import { planStageMove } from "../domain/deal-transitions";
import { stageTask } from "../domain/automation";
import { toDealStatus, toLifecycle } from "../domain/guards";
import type { DealLike, DealStatus, Lifecycle, StageLike } from "../domain/types";
import type { CreateDealInput, ListDealsQuery, UpdateDealInput } from "./deal-schemas";
import { listStages } from "./reference";

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

export async function listDeals(query: ListDealsQuery = {}): Promise<DealRecord[]> {
  const where: Prisma.DealWhereInput = {};

  if (query.stageId !== undefined) where.stageId = query.stageId;
  if (query.owner !== undefined) where.owner = query.owner;
  if (query.status !== undefined && query.status !== "all") where.status = query.status;
  if (query.q !== undefined) {
    const contains = containsFilter(query.q);
    where.OR = [{ name: contains }, { company: { name: contains } }];
  }

  const rows = await prisma.deal.findMany({
    where,
    include: dealInclude,
    orderBy: orderBy(query),
  });
  return rows.map(toRecord);
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
export async function createDeal(input: CreateDealInput): Promise<DealRecord> {
  const now = new Date();
  const row = await prisma.$transaction(async (tx) => {
    const companyId = await resolveCompanyLink(tx, input);
    return tx.deal.create({
    data: {
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
    },
    include: dealInclude,
    });
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

  if (input.contactId !== undefined) {
    data.contact =
      input.contactId === null ? { disconnect: true } : { connect: { id: input.contactId } };
  }

  if (input.status !== undefined) {
    data.status = input.status;
    data.closedAt = input.status === "open" ? null : (existing.closedAt ?? new Date());
  }

  const row = await prisma.$transaction(async (tx) => {
    const companyId = await resolveCompanyLink(tx, input);
    if (companyId !== undefined) {
      data.company = companyId === null ? { disconnect: true } : { connect: { id: companyId } };
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

/** Statuts acceptés par les filtres de la vue liste. */
export const DEAL_STATUS_FILTERS: ReadonlyArray<{ value: DealStatus | "all"; label: string }> = [
  { value: "open", label: "En cours" },
  { value: "won", label: "Gagnées" },
  { value: "lost", label: "Perdues" },
  { value: "all", label: "Toutes" },
];
