import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../db";
import {
  budgetState,
  costMicros,
  isAnomalous,
  NO_USAGE,
  type BudgetState,
  type Purpose,
  type TokenUsage,
} from "../domain/model-pricing";

/**
 * Le compteur de dépense.
 *
 * **Mesurer d'abord, couper ensuite.** Avant ce module, la seule chose que le
 * CRM savait de sa facture, c'était deux compteurs de jetons sur les vacations
 * — donc rien sur la rédaction d'emails, qui est justement ce qui coûte. Une
 * réduction décidée sans mesure préalable est une conviction ; on ne saurait
 * pas davantage après qu'avant si elle a servi.
 *
 * L'écriture a lieu **après** la réponse, et son échec n'annule rien : un appel
 * payé dont la comptabilisation échoue reste un appel payé, et perdre la
 * réponse par-dessus le marché ferait payer deux fois.
 */

export interface RecordedCall {
  readonly agentId: string;
  readonly purpose: Purpose;
  readonly model: string;
  readonly usage: TokenUsage;
  /** Contexte libre — ce qui aide à comprendre une anomalie. */
  readonly detail?: string;
}

/** `YYYY-MM-DD` et `YYYY-MM` dans le fuseau du serveur. */
function keysOf(now: Date): { day: string; month: string } {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return { day: `${year}-${month}-${day}`, month: `${year}-${month}` };
}

/**
 * Lit la consommation d'une réponse de l'API.
 *
 * Les champs de cache sont facultatifs dans le SDK — aucun appel du CRM n'en
 * pose aujourd'hui. Ils sont lus quand même pour que le compteur reste juste
 * le jour où le prompt système passera en cache.
 */
export function usageOf(usage: Anthropic.Usage | undefined): TokenUsage {
  if (usage === undefined) return NO_USAGE;
  return {
    input: usage.input_tokens,
    output: usage.output_tokens,
    // L'API ne ventile pas la réflexion : elle est comprise dans la sortie.
    thinking: null,
    cacheRead: usage.cache_read_input_tokens ?? 0,
    cacheWrite: usage.cache_creation_input_tokens ?? 0,
  };
}

/**
 * Consigne un appel. Ne lève jamais.
 *
 * Rend le coût calculé, pour que l'appelant puisse le journaliser sans relire
 * la base.
 */
export async function recordUsage(call: RecordedCall, now = new Date()): Promise<number> {
  const micros = costMicros(call.model, call.usage);
  const anomaly = isAnomalous(call.purpose, micros);
  const { day, month } = keysOf(now);

  if (anomaly) {
    // **Signalé, pas avalé.** Un appel qui coûte dix fois son ordinaire est
    // soit un contexte qui a gonflé, soit une boucle d'outils qui tourne :
    // dans les deux cas c'est un défaut, et il doit laisser une trace lisible
    // côté serveur en plus de la ligne en base.
    console.warn(
      `[coût ${call.purpose}] anomalie : ${micros} µ$ pour ${call.model} ` +
        `(${call.usage.input} entrée / ${call.usage.output} sortie) — agent ${call.agentId}`,
    );
  }

  try {
    await prisma.apiUsage.create({
      data: {
        day,
        month,
        agentId: call.agentId,
        purpose: call.purpose,
        model: call.model,
        inputTokens: call.usage.input,
        outputTokens: call.usage.output,
        thinkingTokens: call.usage.thinking,
        cacheReadTokens: call.usage.cacheRead,
        cacheWriteTokens: call.usage.cacheWrite,
        costMicros: micros,
        anomaly,
        detail: call.detail ?? "",
      },
    });
  } catch (error) {
    console.error("[coût] impossible de consigner l'appel", error);
  }

  return micros;
}

/** Dépense du mois en cours, en micro-dollars. */
export async function monthSpentMicros(now = new Date()): Promise<number> {
  const { month } = keysOf(now);
  const total = await prisma.apiUsage.aggregate({
    where: { month },
    _sum: { costMicros: true },
  });
  return total._sum.costMicros ?? 0;
}

/** Le plafond réglé, en micro-dollars. `0` = pas de plafond. */
export async function ceilingMicros(): Promise<number> {
  const row = await prisma.settings.findUnique({ where: { id: "singleton" } });
  return (row?.monthlyBudgetCents ?? 2000) * 10_000;
}

/**
 * Où en est le mois. `null` quand aucun plafond n'est réglé.
 *
 * Lu par le bandeau d'accueil **et** par la garde de requête : deux lectures du
 * même état, une seule définition de « on a dépassé ».
 */
export async function readBudget(now = new Date()): Promise<BudgetState | null> {
  const [spent, ceiling] = await Promise.all([monthSpentMicros(now), ceilingMicros()]);
  return budgetState(spent, ceiling);
}

/**
 * Refuse-t-on de lancer cet appel ?
 *
 * **Avant l'appel, pas pendant.** On n'interrompt pas une complétion en cours :
 * on refuse de la lancer, et on le dit. Le garde-fou existait pour les
 * vacations depuis le jalon 14 ; il couvre désormais aussi la rédaction et la
 * conversation, qui sont ce qui coûte réellement.
 */
export async function budgetRefusal(now = new Date()): Promise<string | null> {
  const state = await readBudget(now);
  if (state === null || state.level !== "over") return null;
  const spent = (state.spentMicros / 1_000_000).toFixed(2).replace(".", ",");
  const ceiling = (state.ceilingMicros / 1_000_000).toFixed(2).replace(".", ",");
  return `Plafond mensuel atteint : ${spent} $ dépensés pour un plafond de ${ceiling} $. Relevez-le dans Réglages → Coûts de l'API, ou attendez le mois prochain.`;
}

export interface UsageBucket {
  readonly key: string;
  readonly label: string;
  readonly calls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costMicros: number;
}

export interface UsageReport {
  readonly month: string;
  readonly monthMicros: number;
  readonly budget: BudgetState | null;
  readonly byDay: readonly UsageBucket[];
  readonly byAgent: readonly UsageBucket[];
  readonly byPurpose: readonly UsageBucket[];
  readonly anomalies: number;
  /** Le dernier brouillon consigné — la ventilation demandée, sur un cas réel. */
  readonly lastDraft: {
    readonly model: string;
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly thinkingTokens: number | null;
    readonly costMicros: number;
    readonly at: Date;
  } | null;
}

interface Row {
  readonly day: string;
  readonly agentId: string;
  readonly purpose: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costMicros: number;
  readonly anomaly: boolean;
}

function group(rows: readonly Row[], pick: (row: Row) => string): UsageBucket[] {
  const buckets = new Map<string, UsageBucket>();
  for (const row of rows) {
    const key = pick(row);
    const current = buckets.get(key) ?? {
      key,
      label: key,
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      costMicros: 0,
    };
    buckets.set(key, {
      key,
      label: key,
      calls: current.calls + 1,
      inputTokens: current.inputTokens + row.inputTokens,
      outputTokens: current.outputTokens + row.outputTokens,
      costMicros: current.costMicros + row.costMicros,
    });
  }
  return [...buckets.values()].sort((a, b) => b.costMicros - a.costMicros);
}

/** Le rapport du mois en cours : par jour, par agent, par usage. */
export async function readUsageReport(now = new Date()): Promise<UsageReport> {
  const { month } = keysOf(now);

  const [rows, budget, lastDraft] = await Promise.all([
    prisma.apiUsage.findMany({
      where: { month },
      select: {
        day: true,
        agentId: true,
        purpose: true,
        inputTokens: true,
        outputTokens: true,
        costMicros: true,
        anomaly: true,
      },
    }),
    readBudget(now),
    prisma.apiUsage.findFirst({
      where: { purpose: "draft" },
      orderBy: { createdAt: "desc" },
      select: {
        model: true,
        inputTokens: true,
        outputTokens: true,
        thinkingTokens: true,
        costMicros: true,
        createdAt: true,
      },
    }),
  ]);

  const monthMicros = rows.reduce((total, row) => total + row.costMicros, 0);

  return {
    month,
    monthMicros,
    budget,
    // Par jour, du plus récent au plus ancien : c'est l'ordre où on le lit.
    byDay: group(rows, (row) => row.day).sort((a, b) => b.key.localeCompare(a.key)),
    byAgent: group(rows, (row) => row.agentId),
    byPurpose: group(rows, (row) => row.purpose),
    anomalies: rows.filter((row) => row.anomaly).length,
    lastDraft:
      lastDraft === null
        ? null
        : {
            model: lastDraft.model,
            inputTokens: lastDraft.inputTokens,
            outputTokens: lastDraft.outputTokens,
            thinkingTokens: lastDraft.thinkingTokens,
            costMicros: lastDraft.costMicros,
            at: lastDraft.createdAt,
          },
  };
}
