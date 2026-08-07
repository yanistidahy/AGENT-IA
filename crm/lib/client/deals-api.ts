import type { ApiErrorBody } from "../api/errors";

/**
 * Appels client vers l'API des affaires.
 *
 * Les erreurs sont renvoyées, jamais levées : chaque appelant est un
 * gestionnaire d'évènement qui doit afficher le message plutôt que laisser
 * remonter une exception non capturée.
 */
export type ApiResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly message: string;
      readonly fields?: Record<string, string[]>;
    };

function isErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const { error } = value;
  return typeof error === "object" && error !== null && "message" in error;
}

export interface DealPayload {
  readonly deal: { readonly id: string };
}

/** Les trois points d'entrée renvoient la même enveloppe : on la vérifie au lieu de l'affirmer. */
function isDealPayload(value: unknown): value is DealPayload {
  if (typeof value !== "object" || value === null || !("deal" in value)) return false;
  const { deal } = value;
  return (
    typeof deal === "object" &&
    deal !== null &&
    "id" in deal &&
    typeof deal.id === "string"
  );
}

async function send(url: string, init: RequestInit): Promise<ApiResult<DealPayload>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch {
    return { ok: false, message: "Le serveur est injoignable. Vérifiez votre connexion." };
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isErrorBody(payload)) {
      const { message, fields } = payload.error;
      return fields === undefined ? { ok: false, message } : { ok: false, message, fields };
    }
    return { ok: false, message: `Erreur serveur (${response.status}).` };
  }

  if (!isDealPayload(payload)) {
    return { ok: false, message: "Réponse inattendue du serveur." };
  }

  return { ok: true, data: payload };
}

export function createDeal(body: unknown): Promise<ApiResult<DealPayload>> {
  return send("/api/deals", { method: "POST", body: JSON.stringify(body) });
}

export function updateDeal(id: string, body: unknown): Promise<ApiResult<DealPayload>> {
  return send(`/api/deals/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function moveDealStage(id: string, stageId: string): Promise<ApiResult<DealPayload>> {
  return send(`/api/deals/${id}/move-stage`, {
    method: "POST",
    body: JSON.stringify({ stageId }),
  });
}
