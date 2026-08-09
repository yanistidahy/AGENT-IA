import { createServer } from "node:http";
import { inspectTool } from "../lib/domain/tool-schema";

/**
 * Serveur de substitution à l'API Anthropic, pour les vérifications locales.
 *
 * ## Pourquoi il est versionné, et pourquoi il valide
 *
 * La version précédente vivait dans un dossier temporaire et acceptait tout.
 * Elle a donc validé, quatre jalons durant, une requête que la vraie API
 * refusait : une clé de propriété accentuée (`catégorie`) rendait le conseil
 * entier inutilisable, et le mock répondait 200. **Un substitut plus permissif
 * que la production est pire que pas de substitut : il fabrique de la
 * confiance.**
 *
 * Il applique donc les contraintes connues de l'API, et surtout il les tire de
 * `lib/domain/tool-schema.ts` — le module qu'utilise aussi le test de garde.
 * Deux copies de la règle divergeraient, et c'est exactement ainsi que le
 * défaut a survécu.
 *
 * ## Ce qu'il ne fait pas
 *
 * Il ne simule aucun jugement : il rejoue ce qu'un modèle honnête produirait
 * (citer des identifiants présents dans son briefing), plus un identifiant
 * inventé, pour vérifier que la preuve fausse est écartée avant écriture. Il
 * n'établit rien sur la qualité des réponses — seulement sur la forme des
 * requêtes et le traitement des réponses.
 *
 * Usage : `npx tsx scripts/mock-anthropic.ts [port]`
 */

const PORT = Number(process.argv[2] ?? 3399);

/** Paramètres retirés sur Claude Opus 5 : la vraie API répond 400. */
const REMOVED_PARAMS = ["budget_tokens", "temperature", "top_p", "top_k"] as const;

interface Body {
  readonly model?: unknown;
  readonly max_tokens?: unknown;
  readonly messages?: unknown;
  readonly tools?: unknown;
  readonly thinking?: Record<string, unknown>;
  readonly [key: string]: unknown;
}

/**
 * Reproduit les refus documentés de l'API, dans l'ordre où elle les applique.
 *
 * Le message imite le format réel — c'est ce que la bissection du diagnostic
 * affiche, donc un message approximatif rendrait le diagnostic trompeur.
 */
function validate(body: Body): string | null {
  if (typeof body.model !== "string" || body.model === "") {
    return "model: field required";
  }
  if (typeof body.max_tokens !== "number" || body.max_tokens < 1) {
    return "max_tokens: must be a positive integer";
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return "messages: at least one message is required";
  }

  for (const param of REMOVED_PARAMS) {
    if (param in body) return `${param}: unexpected value — removed on this model`;
    if (body.thinking !== undefined && param in body.thinking) {
      return `thinking.${param}: unexpected value — removed on this model`;
    }
  }

  if (body.tools !== undefined) {
    if (!Array.isArray(body.tools)) return "tools: must be an array";
    for (const [index, tool] of body.tools.entries()) {
      const entry = tool as { name?: unknown; input_schema?: unknown };
      const name = typeof entry.name === "string" ? entry.name : "";
      const violations = inspectTool(name, entry.input_schema);
      const first = violations[0];
      if (first !== undefined) {
        // Format calqué sur la réponse réelle, index de l'outil compris : c'est
        // lui qui a permis de trouver le coupable en production.
        return first.path === "name"
          ? `tools.${index}.custom.name: Tool name should match pattern '^[a-zA-Z0-9_.-]{1,64}$'`
          : `tools.${index}.custom.input_schema${first.path}: Property keys should match pattern '^[a-zA-Z0-9_.-]{1,64}$'`;
      }
    }
  }

  return null;
}

/** Réponse rejouée : cite des identifiants du briefing, plus un inventé. */
function draftAnswer(brief: string): string {
  const ids = [...brief.matchAll(/\[contact:([^\]]+)\]/g)].map((match) => match[1]);
  const recommendations: unknown[] = [];

  if (ids.length >= 2) {
    recommendations.push({
      severity: "urgent",
      title: "Deux relances dépassées à traiter aujourd'hui",
      rationale: "Les échéances sont passées et aucune interaction ne les a suivies.",
      kind: "overdue-reminders",
      // ids[1] d'abord : l'ordre ne doit pas changer la clé de déduplication.
      evidenceIds: [ids[1], ids[0]],
      actions: [
        {
          tool: "set_reminder",
          input: { contactId: ids[0], contactName: "Contact cité", date: "2026-09-15" },
          summary: "Programmer une relance",
        },
        // Arguments invalides : l'action doit être retirée, le constat survivre.
        {
          tool: "set_reminder",
          input: { contactId: ids[0], contactName: "X", date: "pas-une-date" },
          summary: "Action mal formée",
        },
      ],
    });
  }

  // Preuve entièrement inventée : la recommandation ne doit pas survivre.
  recommendations.push({
    severity: "attention",
    title: "Constat sans preuve vérifiable",
    rationale: "Cite un identifiant qui n'existe pas.",
    kind: "hallucination",
    evidenceIds: ["ctc_inexistant_0000"],
    actions: [],
  });

  return JSON.stringify({ recommendations });
}

createServer((req, res) => {
  let raw = "";
  req.on("data", (chunk) => (raw += chunk));
  req.on("end", () => {
    let body: Body;
    try {
      body = JSON.parse(raw) as Body;
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          type: "error",
          error: { type: "invalid_request_error", message: "could not parse request body" },
        }),
      );
      return;
    }

    const problem = validate(body);
    if (problem !== null) {
      console.error(`400 ${problem}`);
      res.writeHead(400, { "content-type": "application/json", "request-id": "req_mocklocal01" });
      res.end(
        JSON.stringify({
          type: "error",
          error: { type: "invalid_request_error", message: problem },
        }),
      );
      return;
    }

    const messages = body.messages as { content?: unknown }[];
    const brief = messages
      .map((message) => (typeof message.content === "string" ? message.content : ""))
      .join("\n");
    const text = draftAnswer(brief);

    // Le chemin de conversation appelle `messages.stream()` : sans SSE, le SDK
    // échoue sur « request ended without sending any chunks ». La version
    // précédente ne répondait qu'en JSON — le chemin de conversation n'a donc
    // jamais été exercé localement, ce qui est l'autre moitié de l'incident.
    if (body.stream === true) {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
      });
      const send = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };
      send("message_start", {
        type: "message_start",
        message: {
          id: "msg_mock",
          type: "message",
          role: "assistant",
          model: body.model,
          content: [],
          stop_reason: null,
          usage: { input_tokens: 1234, output_tokens: 0 },
        },
      });
      send("content_block_start", {
        type: "content_block_start",
        index: 0,
        content_block: { type: "text", text: "" },
      });
      send("content_block_delta", {
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text },
      });
      send("content_block_stop", { type: "content_block_stop", index: 0 });
      send("message_delta", {
        type: "message_delta",
        delta: { stop_reason: "end_turn", stop_sequence: null },
        usage: { output_tokens: 210 },
      });
      send("message_stop", { type: "message_stop" });
      res.end();
      return;
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        id: "msg_mock",
        type: "message",
        role: "assistant",
        model: body.model,
        content: [{ type: "text", text }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1234, output_tokens: 210 },
      }),
    );
  });
}).listen(PORT, () => {
  console.log(`Substitut Anthropic sur http://127.0.0.1:${PORT} — valide la forme des outils.`);
});
