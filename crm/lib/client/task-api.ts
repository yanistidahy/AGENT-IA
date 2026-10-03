import { requestJson, type ApiResult } from "./http";

/**
 * **« Appel passé » passe par sa propre route**, et c'est le point.
 *
 * Le geste fait deux écritures qui ne valent que prises ensemble : consigner
 * l'appel dans l'historique du contact, et terminer la tâche. Le laisser au
 * `PATCH { done: true }` ordinaire aurait rendu possible de cocher sans
 * consigner — un travail qu'on croit tracé et qui ne l'est pas. Une fonction
 * nommée rend aussi la garde statique vérifiable : l'écran ne peut pas marquer
 * un appel passé par un autre chemin.
 */
interface CallDonePayload {
  readonly message: string;
}

function isCallDone(value: unknown): value is CallDonePayload {
  return typeof value === "object" && value !== null && "message" in value;
}

export function markCallDone(id: string): Promise<ApiResult<CallDonePayload>> {
  return requestJson(`/api/tasks/${id}/appel`, { method: "POST" }, isCallDone);
}
