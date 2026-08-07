import type { ChatEvent } from "@/lib/agents/runtime/events";

/**
 * Lecture du flux SSE de `/api/chat`.
 *
 * Le découpage réseau ne respecte pas les frontières d'événements : on
 * accumule dans un tampon et on ne traite que les blocs terminés par une ligne
 * vide, sans quoi un JSON coupé en deux ferait échouer le parsing.
 */
function isChatEvent(value: unknown): value is ChatEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof value.type === "string"
  );
}

export async function* readChatStream(
  response: Response,
): AsyncGenerator<ChatEvent, void, undefined> {
  const body = response.body;
  if (body === null) {
    yield { type: "error", message: "Le serveur n'a renvoyé aucun flux." };
    return;
  }

  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += value;
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const line = chunk.trim();
        if (!line.startsWith("data:")) continue;
        try {
          const parsed: unknown = JSON.parse(line.slice(5).trim());
          if (isChatEvent(parsed)) yield parsed;
        } catch {
          // Bloc illisible : on l'ignore plutôt que d'interrompre le flux.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export interface StartChatInput {
  readonly conversationId: string;
  readonly message?: string;
}

export async function startChat(input: StartChatInput): Promise<Response> {
  return fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function confirmAction(
  conversationId: string,
  toolUseId: string,
  decision: "confirm" | "refuse",
): Promise<{ ok: boolean; turnComplete: boolean; message?: string }> {
  const response = await fetch("/api/actions/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, toolUseId, decision }),
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "object" &&
      payload.error !== null &&
      "message" in payload.error &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : "L'action n'a pas pu être exécutée.";
    return { ok: false, turnComplete: false, message };
  }

  const turnComplete =
    typeof payload === "object" &&
    payload !== null &&
    "turnComplete" in payload &&
    payload.turnComplete === true;

  return { ok: true, turnComplete };
}
