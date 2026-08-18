import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, anthropicFailure, effortFor, thinkingFor } from "./client";
import { modelFor } from "@/lib/api/reference";
import { toolsFor } from "@/lib/agents/tools";
import { findAgent } from "@/lib/agents/registry";
import { promptForAgent } from "@/lib/api/agents";

/**
 * Test de connexion à l'API Anthropic, par **bissection**.
 *
 * Un 400 dit « la requête est invalide », pas « quel champ ». Plutôt que de
 * deviner, on envoie une suite de requêtes de plus en plus riches : d'abord le
 * strict minimum, puis un paramètre de plus à chaque étape. **La première qui
 * échoue nomme le coupable** — c'est le champ ajouté à cette étape.
 *
 * Chaque appel est plafonné à 16 jetons de sortie : la question est « l'API
 * accepte-t-elle cette forme ? », pas « que répond le modèle ». Un diagnostic
 * complet coûte donc quelques centimes.
 */

export type StepOutcome = "ok" | "failed" | "skipped";

export interface DiagnosticStep {
  /** Ce que cette étape ajoute par rapport à la précédente. */
  readonly adds: string;
  readonly outcome: StepOutcome;
  /** Statut HTTP, si l'API a répondu. */
  readonly status: number | null;
  /** Message de l'API, tel quel — c'est lui qui nomme le champ refusé. */
  readonly detail: string;
  readonly requestId: string | null;
  readonly durationMs: number;
}

export interface DiagnosticReport {
  readonly model: string;
  readonly steps: readonly DiagnosticStep[];
  /** Verdict en une phrase, en français. */
  readonly verdict: string;
}

const PROBE: Anthropic.MessageParam[] = [{ role: "user", content: "Réponds uniquement : OK" }];
const PROBE_TOKENS = 16;

interface Probe {
  readonly adds: string;
  readonly params: () => Promise<Anthropic.MessageCreateParamsNonStreaming>;
}

/**
 * Les étapes, du plus nu au plus complet.
 *
 * L'ordre n'est pas décoratif : chaque étape est celle d'avant **plus un
 * champ**. Il faut donc les exécuter dans l'ordre et s'arrêter au premier
 * échec — continuer après une rupture ne prouverait plus rien.
 */
/**
 * Le diagnostic porte sur le modèle **réellement réglé** pour la conversation,
 * pas sur une constante. Depuis que le modèle est un réglage, sonder Opus 5
 * pendant que la conversation tourne sur Sonnet 5 dirait « tout va bien » d'un
 * chemin qui n'est pas celui qui échoue.
 */
function probes(agentSlug: string, model: string): Probe[] {
  const base = { model, max_tokens: PROBE_TOKENS, messages: PROBE } as const;

  return [
    {
      adds: "requête minimale (modèle, max_tokens, un message)",
      params: async () => ({ ...base }),
    },
    {
      adds: "thinking: { type: adaptive, display: omitted }",
      params: async () => ({ ...base, thinking: thinkingFor(false) }),
    },
    {
      adds: "output_config: { effort: medium }",
      params: async () => ({
        ...base,
        thinking: thinkingFor(false),
        output_config: { effort: effortFor(false) },
      }),
    },
    {
      adds: "system (le prompt réel de l'agent)",
      params: async () => {
        const prompt = await promptForAgent(agentSlug);
        return {
          ...base,
          thinking: thinkingFor(false),
          output_config: { effort: effortFor(false) },
          system: prompt ?? "Tu es un assistant.",
        };
      },
    },
    {
      adds: "tools (les outils de l'agent, schémas compris)",
      params: async () => {
        const prompt = await promptForAgent(agentSlug);
        const definition = findAgent(agentSlug);
        const tools = toolsFor(definition?.tools ?? []).map((tool) => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
        }));
        return {
          ...base,
          thinking: thinkingFor(false),
          output_config: { effort: effortFor(false) },
          system: prompt ?? "Tu es un assistant.",
          ...(tools.length > 0 ? { tools } : {}),
        };
      },
    },
  ];
}

/**
 * Exécute le diagnostic.
 *
 * S'arrête à la première rupture et marque les suivantes « non exécutée » :
 * une fois qu'une forme est refusée, les formes plus riches le seraient aussi
 * et leur résultat n'apprendrait rien.
 */
export async function runDiagnostic(agentSlug: string): Promise<DiagnosticReport> {
  const steps: DiagnosticStep[] = [];
  let broken = false;

  const model = await modelFor("chat");

  for (const probe of probes(agentSlug, model)) {
    if (broken) {
      steps.push({
        adds: probe.adds,
        outcome: "skipped",
        status: null,
        detail: "Non exécutée : une étape précédente a échoué.",
        requestId: null,
        durationMs: 0,
      });
      continue;
    }

    const started = Date.now();
    try {
      const client = anthropic();
      await client.messages.create(await probe.params());
      steps.push({
        adds: probe.adds,
        outcome: "ok",
        status: 200,
        detail: "Acceptée.",
        requestId: null,
        durationMs: Date.now() - started,
      });
    } catch (error) {
      broken = true;
      const failure = anthropicFailure(error);
      steps.push({
        adds: probe.adds,
        outcome: "failed",
        status: failure?.status ?? null,
        detail:
          failure?.detail ??
          (error instanceof Error ? error.message : "Échec inattendu, sans message."),
        requestId: failure?.requestId ?? null,
        durationMs: Date.now() - started,
      });
    }
  }

  return { model, steps, verdict: verdictFor(steps) };
}

function verdictFor(steps: readonly DiagnosticStep[]): string {
  const failed = steps.find((step) => step.outcome === "failed");
  if (failed === undefined) {
    return "Connexion à l'API Anthropic établie. La requête complète du conseil est acceptée.";
  }
  if (steps[0]?.outcome === "failed") {
    return `Même la requête minimale est refusée : ${failed.detail}`;
  }
  return `Le champ ajouté à cette étape est refusé — « ${failed.adds} ». Réponse de l'API : ${failed.detail}`;
}
