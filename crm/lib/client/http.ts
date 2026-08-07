import type { ApiErrorBody } from "../api/errors";

/**
 * Appels JSON depuis le navigateur.
 *
 * Les erreurs sont renvoyées, jamais levées : chaque appelant est un gestionnaire
 * d'évènement qui doit afficher le message plutôt que laisser remonter une
 * exception non capturée. C'est la généralisation du motif écrit au jalon 1 pour
 * les affaires, réemployé tel quel par les contacts et les sociétés.
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

/**
 * `guard` est obligatoire : la réponse est vérifiée, jamais affirmée. Sans lui,
 * il faudrait une assertion de type sur une valeur venue du réseau.
 */
export async function requestJson<T>(
  url: string,
  init: RequestInit,
  guard: (value: unknown) => value is T,
): Promise<ApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers:
        init.body === undefined
          ? init.headers
          : { "Content-Type": "application/json", ...init.headers },
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

  if (!guard(payload)) return { ok: false, message: "Réponse inattendue du serveur." };
  return { ok: true, data: payload };
}

/** Enveloppe `{ <key>: { id } }`, forme de retour commune aux trois entités. */
export function hasRecord<K extends string>(
  key: K,
): (value: unknown) => value is Record<K, { id: string }> {
  return (value): value is Record<K, { id: string }> => {
    if (typeof value !== "object" || value === null) return false;
    // Copie plutôt qu'assertion : `value[key]` sur un `object` générique n'est pas
    // indexable en TypeScript, et le codebase n'utilise pas d'assertion de type.
    const bag: Record<string, unknown> = { ...value };
    const record = bag[key];
    return (
      typeof record === "object" &&
      record !== null &&
      "id" in record &&
      typeof record.id === "string"
    );
  };
}
