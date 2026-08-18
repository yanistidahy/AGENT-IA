import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import {
  appendMessage,
  loadMessages,
  replaceMessage,
  toAnthropicMessages,
  type StoredMessage,
} from "../messages";
import { findAgent, isUnlocked, type AgentDefinition } from "../registry";
import { findAgentProfile, promptForAgent } from "@/lib/api/agents";
import { alexDynamicRules, DRAFT_PROTOCOL } from "@/lib/agents/alex-rules";
import { findTool, toolsFor } from "../tools";
import { anthropic, describeAnthropicError, logAnthropicError } from "./client";
import { requestFor } from "./request";
import { modelFor } from "@/lib/api/reference";
import { budgetRefusal, recordUsage, usageOf } from "@/lib/api/usage";
import type { Purpose } from "@/lib/domain/model-pricing";

import { encodeEvent, toolLabel, type ChatEvent } from "./events";

/**
 * Boucle de conversation avec interruption sur écriture.
 *
 * Règle centrale du jalon : dès qu'un outil `mode: "write"` est demandé, la
 * boucle s'arrête et rend la main à l'utilisateur. Aucun chemin de ce fichier
 * n'exécute un outil d'écriture — seul `/api/actions/confirm` le fait, après le
 * clic.
 *
 * Les lectures demandées dans le même tour sont exécutées immédiatement et leurs
 * résultats sont consignés au fur et à mesure dans le message `tool`. Le tour
 * n'est complet — et la boucle ne repart — que lorsque chaque `tool_use` a son
 * `tool_result` : l'API l'exige, et c'est aussi ce qui rend la reprise après
 * confirmation exacte.
 */

const MAX_TURNS = 8;

type Emit = (event: ChatEvent) => void;

interface RunOptions {
  readonly conversationId: string;
  readonly agent: AgentDefinition;
  readonly deep: boolean;
  readonly emit: Emit;
  /**
   * Prompt système déjà composé, sous l'identité réglée de l'agent.
   *
   * Résolu une fois à l'ouverture du flux plutôt qu'à chaque tour : c'est une
   * lecture en base, et la relire à chaque tour ferait courir le risque qu'un
   * agent change de nom au milieu de sa propre réponse.
   */
  readonly systemPrompt: string;
  /** Nom affiché, pour les messages destinés à l'utilisateur. */
  readonly agentName: string;
  /** `chat` ou `revision` — décide du modèle et de la ligne de facture. */
  readonly purpose: Purpose;
  /** Résolu une fois à l'ouverture du flux, comme le prompt système. */
  readonly model: string;
}

function toolUseBlocks(blocks: readonly Anthropic.ContentBlockParam[]) {
  return blocks.filter(
    (block): block is Anthropic.ToolUseBlockParam => block.type === "tool_use",
  );
}

function resultIds(message: StoredMessage | undefined): Set<string> {
  if (message === undefined) return new Set();
  const ids = message.blocks
    .filter((block): block is Anthropic.ToolResultBlockParam => block.type === "tool_result")
    .map((block) => block.tool_use_id);
  return new Set(ids);
}

function toolResult(id: string, payload: unknown): Anthropic.ToolResultBlockParam {
  return {
    type: "tool_result",
    tool_use_id: id,
    content: [{ type: "text", text: JSON.stringify(payload) }],
  };
}

/**
 * Traite les `tool_use` d'un tour d'assistant.
 * Renvoie `true` si le tour est complet et que la boucle peut continuer,
 * `false` si une écriture attend une confirmation.
 */
async function settleTurn(
  options: RunOptions,
  assistant: StoredMessage,
  existing: StoredMessage | undefined,
): Promise<boolean> {
  const uses = toolUseBlocks(assistant.blocks);
  if (uses.length === 0) return true;

  const done = resultIds(existing);
  const results: Anthropic.ToolResultBlockParam[] = existing
    ? existing.blocks.filter(
        (b): b is Anthropic.ToolResultBlockParam => b.type === "tool_result",
      )
    : [];

  let pendingWrite: Anthropic.ToolUseBlockParam | null = null;

  for (const use of uses) {
    if (done.has(use.id)) continue;

    const tool = findTool(use.name);
    if (tool === undefined || !options.agent.tools.includes(use.name)) {
      results.push(
        toolResult(use.id, {
          erreur: `L'outil « ${use.name} » ne fait pas partie de ceux dont tu disposes.`,
        }),
      );
      continue;
    }

    if (tool.mode === "write") {
      // Première écriture non résolue : on s'arrête ici et on demande.
      if (pendingWrite === null) pendingWrite = use;
      continue;
    }

    options.emit({ type: "tool_start", name: use.name, label: toolLabel(use.name) });
    const outcome = await tool.run(use.input);
    const empty =
      typeof outcome.data === "object" && outcome.data !== null && "vide" in outcome.data;
    options.emit({ type: "tool_end", name: use.name, empty });
    results.push(toolResult(use.id, outcome.data));
  }

  // Consigne les résultats obtenus, même partiels : une confirmation refusée ne
  // doit pas faire perdre les lectures déjà payées.
  if (existing === undefined) {
    if (results.length > 0) await appendMessage(options.conversationId, "tool", results);
  } else {
    await replaceMessage(existing.id, results);
  }

  if (pendingWrite !== null) {
    const tool = findTool(pendingWrite.name);
    // `pendingWrite` n'est posé que sur un outil trouvé plus haut ; ce repli
    // existe pour ne pas dépendre d'une assertion.
    const summary =
      tool === undefined
        ? { headline: pendingWrite.name, details: [] as readonly string[] }
        : await tool.summarize(pendingWrite.input);

    options.emit({
      type: "action_proposed",
      action: {
        toolUseId: pendingWrite.id,
        toolName: pendingWrite.name,
        agentName: options.agentName,
        headline: summary.headline,
        details: summary.details,
      },
    });
    return false;
  }

  return results.length === uses.length;
}

/** Un tour : appel du modèle en streaming, puis règlement des outils. */
async function runTurn(options: RunOptions): Promise<"continue" | "stop"> {
  const stored = await loadMessages(options.conversationId);

  // Un tour d'assistant terminé par des tool_use dont les résultats manquent
  // doit être réglé avant tout nouvel appel au modèle.
  const last = stored[stored.length - 1];
  if (last !== undefined && last.role === "assistant" && toolUseBlocks(last.blocks).length > 0) {
    const settled = await settleTurn(options, last, undefined);
    if (!settled) return "stop";
    return "continue";
  }
  if (last !== undefined && last.role === "tool") {
    const assistant = stored[stored.length - 2];
    if (assistant !== undefined && assistant.role === "assistant") {
      const settled = await settleTurn(options, assistant, last);
      if (!settled) return "stop";
    }
  }

  const tools = toolsFor(options.agent.tools).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
  }));

  const stream = anthropic().messages.stream({
    ...requestFor(options.purpose, options.model, { deep: options.deep }),
    system: options.systemPrompt,
    messages: toAnthropicMessages(stored),
    ...(tools.length > 0 ? { tools } : {}),
  });

  for await (const event of stream) {
    if (event.type !== "content_block_delta") continue;
    if (event.delta.type === "text_delta") {
      options.emit({ type: "text", text: event.delta.text });
    } else if (event.delta.type === "thinking_delta") {
      options.emit({ type: "thinking", text: event.delta.thinking });
    }
  }

  const message = await stream.finalMessage();
  await appendMessage(options.conversationId, "assistant", message.content);

  // Une ligne de facture **par tour**, pas par conversation : une réponse qui
  // enchaîne trois lectures d'outils coûte trois appels, et n'en compter qu'un
  // ferait passer la boucle d'outils — le mécanisme le plus cher du produit —
  // pour le moins cher.
  await recordUsage({
    agentId: options.agent.slug,
    purpose: options.purpose,
    model: options.model,
    usage: usageOf(message.usage),
  });

  if (message.stop_reason !== "tool_use") return "stop";

  const assistant: StoredMessage = {
    id: "",
    role: "assistant",
    blocks: message.content,
    createdAt: new Date(),
  };
  const settled = await settleTurn(options, assistant, undefined);
  return settled ? "continue" : "stop";
}

/** Flux SSE complet d'une conversation. */
export function streamConversation(
  conversationId: string,
  agentId: string,
  deep: boolean,
  purpose: Purpose = "chat",
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      const emit: Emit = (event) => {
        controller.enqueue(encoder.encode(encodeEvent(event)));
      };

      try {
        const agent = findAgent(agentId);
        if (agent === undefined) throw new Error(`Agent inconnu : ${agentId}`);

        // Le plafond mensuel est vérifié **avant** d'ouvrir le flux : on ne
        // coupe pas une réponse en cours, on refuse de la commencer, et on le
        // dit dans le fil plutôt que de laisser le silence.
        const refusal = await budgetRefusal();
        if (refusal !== null) {
          emit({ type: "error", message: refusal });
          return;
        }

        const profile = await findAgentProfile(agentId);
        const agentName = profile?.name ?? agent.name;

        if (!isUnlocked(agent)) {
          emit({ type: "error", message: `${agentName} est verrouillé.` });
          return;
        }

        // Alex écrit des emails dans **tous** ses fils, y compris ceux ouverts
        // depuis le rail : sa signature, son lien et le protocole de brouillon
        // font partie de son prompt, pas d'un contexte particulier.
        const extra =
          agentId === "alex" ? `${await alexDynamicRules()}\n\n${DRAFT_PROTOCOL}` : undefined;

        const systemPrompt = await promptForAgent(agentId, extra);
        if (systemPrompt === null) throw new Error(`Prompt introuvable : ${agentId}`);

        const options: RunOptions = {
          conversationId,
          agent,
          deep,
          emit,
          systemPrompt,
          agentName,
          purpose,
          model: await modelFor(purpose),
        };
        for (let turn = 0; turn < MAX_TURNS; turn += 1) {
          const outcome = await runTurn(options);
          if (outcome === "stop") break;
        }
        emit({ type: "done" });
      } catch (error) {
        logAnthropicError("chat", error);
        emit({ type: "error", message: describeAnthropicError(error) });
      } finally {
        controller.close();
      }
    },
  });
}
