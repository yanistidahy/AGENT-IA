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

/**
 * Le collage de trafics : simulation puis application, **même route**.
 *
 * Le rapport rendu est exactement celui du plan du domaine
 * (`lib/domain/visitors-import.ts`), jusqu'au détail ligne par ligne : ce que
 * l'écran affiche avant d'appliquer est donc ce qui s'appliquera.
 */
function isVisitorsReport(value: unknown): value is { report: VisitorsReport } {
  if (typeof value !== "object" || value === null || !("report" in value)) return false;
  const report = (value as { report: unknown }).report;
  return typeof report === "object" && report !== null && "updated" in report;
}

export interface VisitorsReportLine {
  readonly line: number;
  readonly raw: string;
  readonly rawValue: string;
  readonly outcome: string;
  readonly companyName: string;
  readonly visitors: number | null;
  readonly before: number | null;
  readonly reason: string;
}

export interface VisitorsReport {
  readonly lines: readonly VisitorsReportLine[];
  readonly updated: number;
  readonly unchanged: number;
  readonly unmatched: number;
  readonly ambiguous: number;
  readonly unreadable: number;
  readonly read: number;
  readonly applied: boolean;
}

export function importVisitors(
  text: string,
  apply = false,
): Promise<ApiResult<{ report: VisitorsReport }>> {
  return requestJson(
    "/api/companies/visitors",
    { method: "POST", body: JSON.stringify({ text, apply }) },
    isVisitorsReport,
  );
}
