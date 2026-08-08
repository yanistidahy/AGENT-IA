import { z } from "zod";
import { prisma } from "../db";
import { findTool } from "../agents/tools";
import {
  compareRecommendations,
  effectiveStatus,
  isDismissReason,
  isSeverity,
  muteUntil,
  type Evidence,
  type ProposedAction,
  type RecStatus,
  type Severity,
} from "../domain/recommendations";

/**
 * Lecture et décision sur les recommandations.
 *
 * `evidence` et `actions` sont stockés en JSON sérialisé : le schéma s'interdit
 * le type `Json` pour rester portable. Ils sont donc **revalidés à la lecture**,
 * jamais affirmés — une colonne texte ne garantit aucune structure, et un
 * enregistrement écrit par une version antérieure du code doit pouvoir être lu
 * sans faire tomber la page.
 */
const evidenceSchema = z.array(
  z.object({
    type: z.enum(["contact", "company", "deal", "task"]),
    id: z.string(),
    label: z.string(),
  }),
);

const actionsSchema = z.array(
  z.object({
    tool: z.string(),
    input: z.record(z.string(), z.unknown()),
    summary: z.string(),
  }),
);

export interface RecommendationRecord {
  readonly id: string;
  readonly agentId: string;
  readonly createdAt: Date;
  readonly severity: Severity;
  readonly status: RecStatus;
  readonly title: string;
  readonly rationale: string;
  readonly evidence: readonly Evidence[];
  readonly actions: readonly ProposedAction[];
  readonly dismissReason: string;
  readonly snoozedUntil: Date | null;
}

function parseJson<T>(raw: string, schema: z.ZodType<T>, fallback: T): T {
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

function toRecord(
  row: {
    id: string;
    agentId: string;
    createdAt: Date;
    severity: string;
    status: string;
    title: string;
    rationale: string;
    evidence: string;
    actions: string;
    dismissReason: string;
    snoozedUntil: Date | null;
  },
  now: Date,
): RecommendationRecord {
  return {
    id: row.id,
    agentId: row.agentId,
    createdAt: row.createdAt,
    severity: isSeverity(row.severity) ? row.severity : "info",
    status: effectiveStatus(
      { status: row.status as RecStatus, snoozedUntil: row.snoozedUntil },
      now,
    ),
    title: row.title,
    rationale: row.rationale,
    evidence: parseJson(row.evidence, evidenceSchema, []),
    actions: parseJson(row.actions, actionsSchema, []),
    dismissReason: row.dismissReason,
    snoozedUntil: row.snoozedUntil,
  };
}

export interface ListRecommendationsQuery {
  readonly agentId?: string;
  readonly severity?: Severity;
  /** `open` = ce qui attend une décision, en tenant compte des sommeils échus. */
  readonly scope?: "open" | "decided" | "all";
}

export async function listRecommendations(
  query: ListRecommendationsQuery = {},
  now: Date = new Date(),
): Promise<RecommendationRecord[]> {
  const rows = await prisma.recommendation.findMany({
    where: {
      ...(query.agentId === undefined ? {} : { agentId: query.agentId }),
      ...(query.severity === undefined ? {} : { severity: query.severity }),
    },
    orderBy: { createdAt: "desc" },
  });

  const records = rows.map((row) => toRecord(row, now));
  const scope = query.scope ?? "open";

  const filtered =
    scope === "all"
      ? records
      : scope === "open"
        ? records.filter((record) => record.status === "new")
        : records.filter((record) => record.status !== "new");

  return [...filtered].sort(compareRecommendations);
}

export const decisionSchema = z.object({
  decision: z.enum(["accept", "dismiss", "snooze"]),
  reason: z.string().optional(),
  /** Jours de sommeil. Ignoré pour les autres décisions. */
  days: z.number().int().min(1).max(180).optional(),
});

export type DecisionInput = z.infer<typeof decisionSchema>;

export type DecisionResult =
  | { readonly ok: true; readonly status: RecStatus }
  | { readonly ok: false; readonly message: string };

/**
 * Enregistre une décision.
 *
 * **Accepter n'exécute rien.** Le statut passe à `accepted` et l'exécution des
 * actions se fait par la carte de confirmation, action par action : accepter un
 * constat et vouloir toutes ses conséquences ne sont pas la même chose.
 */
export async function decide(
  id: string,
  input: DecisionInput,
  now: Date = new Date(),
): Promise<DecisionResult> {
  const existing = await prisma.recommendation.findUnique({ where: { id } });
  if (existing === null) return { ok: false, message: "Recommandation introuvable." };

  if (input.decision === "accept") {
    await prisma.recommendation.update({
      where: { id },
      data: { status: "accepted", decidedAt: now },
    });
    return { ok: true, status: "accepted" };
  }

  if (input.decision === "snooze") {
    const until = new Date(now);
    until.setDate(until.getDate() + (input.days ?? 7));
    await prisma.recommendation.update({
      where: { id },
      data: { status: "snoozed", snoozedUntil: until, decidedAt: now },
    });
    return { ok: true, status: "snoozed" };
  }

  const reason = input.reason ?? "";
  if (!isDismissReason(reason)) {
    return { ok: false, message: "Motif de rejet inconnu." };
  }

  // Le motif décide de la durée du silence : « pas pertinent » se tait deux
  // mois, « plus tard » une semaine. Voir MUTE_DAYS.
  await prisma.recommendation.update({
    where: { id },
    data: {
      status: "dismissed",
      dismissReason: reason,
      mutedUntil: muteUntil(reason, now),
      decidedAt: now,
    },
  });
  return { ok: true, status: "dismissed" };
}

export type ExecuteResult =
  | { readonly ok: true; readonly summary: string; readonly result: unknown }
  | { readonly ok: false; readonly message: string };

/**
 * Exécute **une** action proposée, après confirmation.
 *
 * Les arguments sont repassés par le schéma de l'outil au moment d'écrire, pas
 * au moment où ils ont été proposés : le monde bouge entre la vacation de 07:00
 * et le clic de 14:00. Une action devenue invalide échoue en le disant, plutôt
 * que d'écrire sur la foi d'un état périmé.
 */
export async function executeProposedAction(
  recommendationId: string,
  index: number,
): Promise<ExecuteResult> {
  const row = await prisma.recommendation.findUnique({ where: { id: recommendationId } });
  if (row === null) return { ok: false, message: "Recommandation introuvable." };

  const actions = parseJson(row.actions, actionsSchema, []);
  const action = actions[index];
  if (action === undefined) return { ok: false, message: "Action introuvable." };

  const tool = findTool(action.tool);
  if (tool === undefined || tool.mode !== "write") {
    return { ok: false, message: "Outil inconnu ou non exécutable." };
  }

  // Revalidation explicite : `run()` refuserait de son côté, mais en renvoyant
  // `{ok: false}` plutôt qu'en levant. Sans ce test, une action mal formée
  // remonterait ici comme un succès et l'écran annoncerait « Fait ».
  if (!tool.accepts(action.input)) {
    return {
      ok: false,
      message:
        "Cette action n'est plus applicable : ses paramètres ne passent plus la validation de l'outil.",
    };
  }

  try {
    const summary = await tool.summarize(action.input);
    const result = await tool.run(action.input);
    if (!result.ok) {
      return {
        ok: false,
        message: "L'outil a refusé l'écriture — la fiche a probablement changé depuis la vacation.",
      };
    }
    return { ok: true, summary: summary.headline, result: result.data };
  } catch (error) {
    console.error(`[recommandation ${recommendationId}] action ${index}`, error);
    return {
      ok: false,
      message:
        "Cette action n'est plus applicable — la fiche a probablement changé depuis la recommandation.",
    };
  }
}

/** Journal des vacations, le plus récent d'abord. */
export async function listRuns(limit = 40) {
  return prisma.shiftRun.findMany({ orderBy: { startedAt: "desc" }, take: limit });
}

/** Consommation cumulée du mois en cours, pour la ligne de coût de /reglages. */
export async function monthlyUsage(now: Date = new Date()) {
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const rows = await prisma.shiftRun.aggregate({
    where: { startedAt: { gte: from } },
    _sum: { inputTokens: true, outputTokens: true },
    _count: { _all: true },
  });

  return {
    runs: rows._count._all,
    inputTokens: rows._sum.inputTokens ?? 0,
    outputTokens: rows._sum.outputTokens ?? 0,
  };
}
