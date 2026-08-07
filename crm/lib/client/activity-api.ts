import { hasRecord, requestJson, type ApiResult } from "./http";

/** Appels client vers les API interactions, tâches et séquences. */

const isActivity = hasRecord("activity");
const isTask = hasRecord("task");

export function logActivity(body: unknown): Promise<ApiResult<Record<"activity", { id: string }>>> {
  return requestJson("/api/activities", { method: "POST", body: JSON.stringify(body) }, isActivity);
}

export function createTask(body: unknown): Promise<ApiResult<Record<"task", { id: string }>>> {
  return requestJson("/api/tasks", { method: "POST", body: JSON.stringify(body) }, isTask);
}

export function updateTask(
  id: string,
  body: unknown,
): Promise<ApiResult<Record<"task", { id: string }>>> {
  return requestJson(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(body) }, isTask);
}

function isDeleted(value: unknown): value is { deleted: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "deleted" in value &&
    typeof value.deleted === "string"
  );
}

export function deleteTask(id: string): Promise<ApiResult<{ deleted: string }>> {
  return requestJson(`/api/tasks/${id}`, { method: "DELETE" }, isDeleted);
}

function isUnknownPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Lectures : la forme précise est vérifiée par les parseurs de `components/activities/types`. */
export function fetchJson(url: string): Promise<ApiResult<Record<string, unknown>>> {
  return requestJson(url, { method: "GET" }, isUnknownPayload);
}

export interface RunSequenceBody {
  readonly owner: string;
  readonly start: string;
  readonly contactId?: string | null;
  readonly companyId?: string | null;
  readonly dealId?: string | null;
}

function isRunResult(value: unknown): value is { created: number } {
  return (
    typeof value === "object" &&
    value !== null &&
    "created" in value &&
    typeof value.created === "number"
  );
}

export function runSequence(
  id: string,
  body: RunSequenceBody,
): Promise<ApiResult<{ created: number }>> {
  return requestJson(
    `/api/sequences/${id}/run`,
    { method: "POST", body: JSON.stringify(body) },
    isRunResult,
  );
}

function isSequence(value: unknown): value is { sequence: { id: string } } {
  return hasRecord("sequence")(value);
}

export function updateSequence(
  id: string,
  body: unknown,
): Promise<ApiResult<{ sequence: { id: string } }>> {
  return requestJson(
    `/api/sequences/${id}`,
    { method: "PATCH", body: JSON.stringify(body) },
    isSequence,
  );
}
