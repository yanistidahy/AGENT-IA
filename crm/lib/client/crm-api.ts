import type { ImportReport } from "../api/contact-import";
import { hasRecord, requestJson, type ApiResult } from "./http";

/** Appels client vers les API contacts et sociétés. */

export type IdPayload<K extends string> = Record<K, { id: string }>;

const isContact = hasRecord("contact");
const isCompany = hasRecord("company");

export function createContact(body: unknown): Promise<ApiResult<IdPayload<"contact">>> {
  return requestJson("/api/contacts", { method: "POST", body: JSON.stringify(body) }, isContact);
}

export function updateContact(
  id: string,
  body: unknown,
): Promise<ApiResult<IdPayload<"contact">>> {
  return requestJson(
    `/api/contacts/${id}`,
    { method: "PATCH", body: JSON.stringify(body) },
    isContact,
  );
}

function isDeleted(value: unknown): value is { deleted: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "deleted" in value &&
    typeof value.deleted === "string"
  );
}

export function deleteContact(id: string): Promise<ApiResult<{ deleted: string }>> {
  return requestJson(`/api/contacts/${id}`, { method: "DELETE" }, isDeleted);
}

export function createCompany(body: unknown): Promise<ApiResult<IdPayload<"company">>> {
  return requestJson("/api/companies", { method: "POST", body: JSON.stringify(body) }, isCompany);
}

export function updateCompany(
  id: string,
  body: unknown,
): Promise<ApiResult<IdPayload<"company">>> {
  return requestJson(
    `/api/companies/${id}`,
    { method: "PATCH", body: JSON.stringify(body) },
    isCompany,
  );
}

export function deleteCompany(id: string): Promise<ApiResult<{ deleted: string }>> {
  return requestJson(`/api/companies/${id}`, { method: "DELETE" }, isDeleted);
}

function isImportPayload(value: unknown): value is { report: ImportReport } {
  if (typeof value !== "object" || value === null || !("report" in value)) return false;
  const { report } = value;
  return (
    typeof report === "object" &&
    report !== null &&
    "created" in report &&
    typeof report.created === "number"
  );
}

export function importContacts(text: string, update = false): Promise<ApiResult<{ report: ImportReport }>> {
  return requestJson(
    "/api/contacts/import",
    { method: "POST", body: JSON.stringify({ text, update }) },
    isImportPayload,
  );
}
