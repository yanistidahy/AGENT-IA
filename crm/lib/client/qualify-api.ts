import { requestJson, type ApiResult } from "./http";

/**
 * Appel client de la qualification.
 *
 * Le document d'annulation est traité comme opaque, exactement comme celui de
 * la file : il vient du serveur et repart tel quel. L'inspecter ici créerait
 * une seconde définition de ce que « défaire » veut dire.
 */
export interface QualifyResponse {
  readonly created: boolean;
  readonly dealId: string;
  readonly dealName: string;
  readonly message: string;
  readonly undo: readonly unknown[];
}

function isQualifyResponse(value: unknown): value is QualifyResponse {
  if (typeof value !== "object" || value === null) return false;
  const bag: Record<string, unknown> = { ...value };
  return (
    typeof bag.created === "boolean" &&
    typeof bag.dealId === "string" &&
    typeof bag.dealName === "string" &&
    typeof bag.message === "string" &&
    Array.isArray(bag.undo)
  );
}

export function qualifyContact(body: {
  contactId: string;
  amount: number;
  offer: string;
}): Promise<ApiResult<QualifyResponse>> {
  return requestJson("/api/qualify", { method: "POST", body: JSON.stringify(body) }, isQualifyResponse);
}
