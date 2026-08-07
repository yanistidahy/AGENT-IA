import { NextResponse } from "next/server";
import type { ZodError } from "zod";

/**
 * Réponses d'erreur normalisées.
 *
 * Aucune trace d'exécution ne sort jamais du serveur : un message Prisma
 * contient l'URL de la base et parfois un extrait du code appelant. Le détail
 * part dans les logs, le client reçoit un code et une phrase.
 */

export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly fields?: Record<string, string[]>;
  };
}

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

function fail(
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string[]>,
): NextResponse<ApiErrorBody> {
  return NextResponse.json<ApiErrorBody>(
    { error: fields === undefined ? { code, message } : { code, message, fields } },
    { status },
  );
}

export function badRequest(
  message: string,
  fields?: Record<string, string[]>,
): NextResponse<ApiErrorBody> {
  return fail(400, "bad_request", message, fields);
}

export function notFound(message: string): NextResponse<ApiErrorBody> {
  return fail(404, "not_found", message);
}

export function conflict(message: string): NextResponse<ApiErrorBody> {
  return fail(409, "conflict", message);
}

/** Regroupe les problèmes Zod par chemin de champ, pour affichage sous les entrées. */
export function zodFields(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";
    fields[key] = [...(fields[key] ?? []), issue.message];
  }
  return fields;
}

export function invalidPayload(error: ZodError): NextResponse<ApiErrorBody> {
  return badRequest("Les données envoyées sont invalides.", zodFields(error));
}

export function serverError(context: string, error: unknown): NextResponse<ApiErrorBody> {
  console.error(`[api] ${context}`, error);
  return fail(500, "server_error", "Le serveur n'a pas pu traiter la demande.");
}
