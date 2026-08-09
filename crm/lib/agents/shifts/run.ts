import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { anthropic, MODEL } from "@/lib/agents/runtime/client";
import { findAgent } from "@/lib/agents/registry";
import { promptForAgent } from "@/lib/api/agents";
import { findTool } from "@/lib/agents/tools";
import {
  dedupeKey as buildKey,
  isMuted,
  isPublishable,
  isSeverity,
  type Evidence,
  type ProposedAction,
  type RecommendationDraft,
} from "@/lib/domain/recommendations";
import { qualityBriefing, renderBriefing, followUpBriefing, type Briefing } from "./briefing";
import { SHIFT_RULES } from "./prompt";

/**
 * Exécution d'une vacation.
 *
 * Une vacation **lit**, elle n'écrit jamais dans le CRM. Les actions proposées
 * sont des intentions validées, exécutées plus tard par la carte de confirmation
 * — le même chemin que pour une conversation.
 *
 * Le journal est écrit dans tous les cas, y compris l'échec : un run silencieux
 * qui a échoué est indiscernable d'un run qui n'a rien trouvé, et c'est
 * exactement la confusion qu'on veut éviter.
 */

/**
 * Les deux vacations câblées. Les six autres agents attendent la validation.
 *
 * Le briefing est nommé d'après ce qu'il collecte, pas d'après l'agent : c'est
 * un périmètre, et le renommer chaque fois qu'on renomme un agent n'aurait
 * aucun sens. Le lien entre les deux se fait ici, par le slug.
 */
export const SHIFTS = [
  { agentId: "sarah", brief: followUpBriefing, order: 1 },
  { agentId: "sabrina", brief: qualityBriefing, order: 2 },
] as const;

export type ShiftOutcome = "ok" | "empty" | "skipped" | "error";

export interface ShiftResult {
  readonly agentId: string;
  readonly outcome: ShiftOutcome;
  readonly detail: string;
  readonly produced: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly durationMs: number;
}

/** Ce que le modèle doit rendre. Toute forme non conforme est rejetée. */
const draftSchema = z.object({
  recommendations: z
    .array(
      z.object({
        severity: z.string(),
        title: z.string().trim().min(1),
        rationale: z.string().trim().default(""),
        kind: z.string().trim().min(1),
        evidenceIds: z.array(z.string().trim().min(1)).min(1),
        actions: z
          .array(
            z.object({
              tool: z.string().trim().min(1),
              input: z.record(z.string(), z.unknown()),
              summary: z.string().trim().min(1),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});

/**
 * Estimation grossière des jetons d'entrée : quatre caractères par jeton.
 *
 * Volontairement approximative et **prudente** — elle sert à refuser un appel
 * manifestement trop gros, pas à facturer. Un compte exact demanderait un
 * aller-retour réseau, c'est-à-dire précisément ce qu'on cherche à éviter.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Vérifie que chaque identifiant cité existe réellement.
 *
 * Un modèle peut inventer un identifiant. Une preuve qui ne résout pas produit
 * un lien mort, c'est-à-dire une recommandation qu'on ne peut pas vérifier — et
 * la règle est qu'une recommandation sans preuve est un bug. On résout donc
 * **avant** d'écrire, et ce qui ne résout pas est écarté.
 */
async function resolveEvidence(
  ids: readonly string[],
  briefing: Briefing,
): Promise<Evidence[]> {
  const known = new Map<string, { type: Evidence["type"]; label: string }>();
  for (const entry of briefing.sections) {
    for (const item of entry.items) known.set(item.id, { type: entry.type, label: item.label });
  }

  const cited = ids.filter((id) => known.has(id));
  if (cited.length === 0) return [];

  const contactIds = cited.filter((id) => known.get(id)?.type === "contact");
  const companyIds = cited.filter((id) => known.get(id)?.type === "company");

  const [contacts, companies] = await Promise.all([
    contactIds.length === 0
      ? Promise.resolve([])
      : prisma.contact.findMany({ where: { id: { in: contactIds } }, select: { id: true } }),
    companyIds.length === 0
      ? Promise.resolve([])
      : prisma.company.findMany({ where: { id: { in: companyIds } }, select: { id: true } }),
  ]);

  const alive = new Set([...contacts, ...companies].map((row) => row.id));

  return cited
    .filter((id) => alive.has(id))
    .map((id) => {
      const entry = known.get(id);
      return { type: entry?.type ?? "contact", id, label: entry?.label ?? id };
    });
}

/**
 * Valide les arguments d'une action proposée contre le schéma réel de l'outil.
 *
 * Une action dont les arguments ne passent pas est **retirée**, la recommandation
 * restant publiable si elle garde ses preuves : un constat juste assorti d'une
 * action mal formée vaut mieux qu'un constat perdu.
 */
async function validateActions(
  actions: readonly ProposedAction[],
): Promise<ProposedAction[]> {
  const kept: ProposedAction[] = [];

  for (const action of actions) {
    const tool = findTool(action.tool);
    if (tool === undefined || tool.mode !== "write") continue;

    // Arguments invalides : l'action est retirée, la recommandation survit si
    // elle garde ses preuves. Un constat juste vaut mieux qu'un constat perdu.
    //
    // `accepts()` et non `summarize()` : ce dernier ne lève pas sur une entrée
    // invalide, il retombe sur « <outil> — arguments invalides ». S'y fier
    // laisserait passer l'action jusqu'à la carte de confirmation, où elle
    // n'échouerait qu'au clic — soit exactement le contraire de « rien de muet ».
    if (!tool.accepts(action.input)) continue;

    const summary = await tool.summarize(action.input);
    kept.push({ ...action, summary: summary.headline || action.summary });
  }

  return kept;
}

async function persist(
  drafts: readonly RecommendationDraft[],
  runId: string,
  now: Date,
): Promise<number> {
  if (drafts.length === 0) return 0;

  const existing = await prisma.recommendation.findMany({
    where: { dedupeKey: { in: drafts.map((draft) => draft.dedupeKey) } },
    select: { dedupeKey: true, status: true, mutedUntil: true, snoozedUntil: true },
  });

  const byKey = new Map(existing.map((row) => [row.dedupeKey, row]));
  let written = 0;

  for (const draft of drafts) {
    const previous = byKey.get(draft.dedupeKey);
    if (
      previous !== undefined &&
      isMuted(
        {
          dedupeKey: previous.dedupeKey,
          status: previous.status as "new",
          mutedUntil: previous.mutedUntil,
          snoozedUntil: previous.snoozedUntil,
        },
        now,
      )
    ) {
      continue;
    }

    // `upsert` sur `dedupeKey` : la contrainte d'unicité est ce qui empêche le
    // doublon, pas la vérification ci-dessus — qui ne fait qu'éviter d'écraser
    // une décision encore valide.
    await prisma.recommendation.upsert({
      where: { dedupeKey: draft.dedupeKey },
      create: {
        agentId: draft.agentId,
        severity: draft.severity,
        title: draft.title,
        rationale: draft.rationale,
        evidence: JSON.stringify(draft.evidence),
        actions: JSON.stringify(draft.actions),
        dedupeKey: draft.dedupeKey,
        runId,
      },
      update: {
        severity: draft.severity,
        title: draft.title,
        rationale: draft.rationale,
        evidence: JSON.stringify(draft.evidence),
        actions: JSON.stringify(draft.actions),
        status: "new",
        decidedAt: null,
        runId,
      },
    });
    written += 1;
  }

  return written;
}

/**
 * Une vacation, du briefing au journal.
 *
 * L'ordre des garde-fous compte : budget avant appel, preuves avant écriture,
 * journal dans tous les cas.
 */
export async function runShift(
  shift: (typeof SHIFTS)[number],
  options: { readonly manual: boolean; readonly now?: Date } = { manual: false },
): Promise<ShiftResult> {
  const now = options.now ?? new Date();
  const started = Date.now();

  const run = await prisma.shiftRun.create({
    data: { agentId: shift.agentId, manual: options.manual, outcome: "ok" },
    select: { id: true },
  });

  const finish = async (result: Omit<ShiftResult, "agentId" | "durationMs">) => {
    const durationMs = Date.now() - started;
    await prisma.shiftRun.update({
      where: { id: run.id },
      data: {
        durationMs,
        outcome: result.outcome,
        detail: result.detail,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        produced: result.produced,
      },
    });
    return { ...result, agentId: shift.agentId, durationMs };
  };

  const nothing = { produced: 0, inputTokens: 0, outputTokens: 0 };

  try {
    const agent = findAgent(shift.agentId);
    if (agent === undefined) {
      return finish({ ...nothing, outcome: "error", detail: "Agent inconnu." });
    }

    const briefing = await shift.brief(now);

    // Le silence est une sortie valide, et la moins chère : aucun appel.
    if (briefing.empty) {
      return finish({ ...nothing, outcome: "empty", detail: "Rien à signaler." });
    }

    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
    const budget = settings?.shiftTokenBudget ?? 4000;

    const prompt = await promptForAgent(shift.agentId);
    if (prompt === null) {
      return finish({ ...nothing, outcome: "error", detail: "Prompt introuvable." });
    }
    const system = `${prompt}\n\n${SHIFT_RULES}`;
    const body = renderBriefing(briefing);
    const estimated = estimateTokens(system + body);

    // Le plafond s'applique **avant** l'appel : on n'interrompt pas une
    // complétion en cours, on refuse de la lancer.
    if (estimated > budget * 4) {
      return finish({
        ...nothing,
        outcome: "skipped",
        detail: `Briefing trop volumineux (~${estimated} jetons pour un budget de ${budget}). Vacation non lancée.`,
      });
    }

    const client = anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: budget,
      system,
      messages: [{ role: "user", content: body }],
    });

    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n");

    const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    const parsed = draftSchema.safeParse(JSON.parse(json === "" ? "{}" : json));

    const usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };

    if (!parsed.success) {
      return finish({
        ...usage,
        produced: 0,
        outcome: "error",
        detail: "Réponse du modèle non conforme au format attendu.",
      });
    }

    const drafts: RecommendationDraft[] = [];
    for (const candidate of parsed.data.recommendations) {
      const evidence = await resolveEvidence(candidate.evidenceIds, briefing);
      const draft: RecommendationDraft = {
        agentId: shift.agentId,
        severity: isSeverity(candidate.severity) ? candidate.severity : "info",
        title: candidate.title,
        rationale: candidate.rationale,
        evidence,
        actions: await validateActions(candidate.actions),
        dedupeKey: buildKey(shift.agentId, candidate.kind, evidence.map((item) => item.id)),
      };
      if (isPublishable(draft)) drafts.push(draft);
    }

    const produced = await persist(drafts, run.id, now);

    return finish({
      ...usage,
      produced,
      outcome: produced === 0 ? "empty" : "ok",
      detail:
        produced === 0
          ? "Aucune recommandation retenue — preuves invérifiables ou constats déjà traités."
          : "",
    });
  } catch (error) {
    // Un échec est journalisé et la vacation suivante a quand même lieu.
    console.error(`[vacation ${shift.agentId}]`, error);
    return finish({
      ...nothing,
      outcome: "error",
      detail: error instanceof Error ? error.message.slice(0, 200) : "Échec inattendu.",
    });
  }
}

/** Toutes les vacations du jour, dans l'ordre. Alfred passe en dernier. */
export async function runAllShifts(manual = false): Promise<readonly ShiftResult[]> {
  const results: ShiftResult[] = [];
  for (const shift of [...SHIFTS].sort((a, b) => a.order - b.order)) {
    results.push(await runShift(shift, { manual }));
  }
  return results;
}
