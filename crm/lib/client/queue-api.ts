import { requestJson, type ApiResult } from "./http";

/**
 * Appels client de la file d'action.
 *
 * Le serveur renvoie l'écriture inverse ; le client la garde le temps du
 * bandeau et la relit telle quelle pour annuler. Elle n'est jamais inspectée ni
 * reconstruite ici — c'est un jeton opaque, et le vérifier de nouveau côté
 * client donnerait deux définitions de l'annulation.
 */

export type QueueBatchAction = "postpone" | "assign" | "lost" | "complete" | "sequence";

export interface QueueBatchRequest {
  readonly ids: readonly string[];
  readonly action: QueueBatchAction;
  readonly days?: number;
  readonly owner?: string;
  readonly reason?: string;
  readonly sequenceId?: string;
  /** Compter ces lignes dans l'anneau du jour. Faux hors de la file d'accueil. */
  readonly mark?: boolean;
}

export interface QueueBatchResponse {
  readonly done: number;
  readonly failed: ReadonlyArray<{ id: string; reason: string }>;
  readonly undo: readonly unknown[];
  readonly message: string;
}

function isBatchResponse(value: unknown): value is QueueBatchResponse {
  if (typeof value !== "object" || value === null) return false;
  const bag: Record<string, unknown> = { ...value };
  return (
    typeof bag.done === "number" &&
    Array.isArray(bag.failed) &&
    Array.isArray(bag.undo) &&
    typeof bag.message === "string"
  );
}

export function runQueueBatch(body: QueueBatchRequest): Promise<ApiResult<QueueBatchResponse>> {
  return requestJson(
    "/api/queue",
    { method: "POST", body: JSON.stringify({ mode: "batch", ...body }) },
    isBatchResponse,
  );
}

function isUndoResponse(value: unknown): value is { restored: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "restored" in value &&
    typeof value.restored === "number"
  );
}

export function undoQueueBatch(
  steps: readonly unknown[],
  ids: readonly string[],
): Promise<ApiResult<{ restored: number }>> {
  return requestJson(
    "/api/queue",
    { method: "POST", body: JSON.stringify({ mode: "undo", steps, ids }) },
    isUndoResponse,
  );
}
