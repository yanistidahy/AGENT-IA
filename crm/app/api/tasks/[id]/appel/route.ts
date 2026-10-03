import { badRequest, jsonOk, notFound, serverError } from "@/lib/api/errors";
import { markCallDone } from "@/lib/api/tasks";

export const dynamic = "force-dynamic";

/**
 * « Appel passé » — **une route à elle, et c'est voulu**.
 *
 * Ce geste fait deux écritures qui ne valent que prises ensemble : consigner
 * l'appel dans l'historique du contact, et terminer la tâche. Le laisser au
 * `PATCH { done: true }` ordinaire aurait rendu possible de cocher sans
 * consigner — un travail qu'on croit tracé et qui ne l'est pas.
 *
 * Une route nommée rend aussi la garde statique vérifiable : l'écran ne peut pas
 * marquer un appel passé par un autre chemin.
 */
interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const result = await markCallDone(id);
    if (result === null) return notFound("Tâche introuvable.");
    if (!result.ok) return badRequest(result.message);
    return jsonOk({ message: result.message });
  } catch (error) {
    return serverError(`POST /api/tasks/${id}/appel`, error);
  }
}
