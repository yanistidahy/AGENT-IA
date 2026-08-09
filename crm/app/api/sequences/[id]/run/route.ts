import { badRequest, conflict, invalidPayload, jsonOk, notFound, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { runSequence, runSequenceSchema } from "@/lib/api/sequences";
import { OPT_OUT_MESSAGE } from "@/lib/domain/lost";

export const dynamic = "force-dynamic";

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

/** Lance une séquence sur une fiche : chaque étape devient une tâche datée. */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = runSequenceSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const result = await runSequence(id, parsed.data);
    if (result.ok) return jsonOk({ tasks: result.tasks, created: result.tasks.length }, 201);
    if (result.reason === "not_found") return notFound("Séquence introuvable.");
    if (result.reason === "opted_out") return conflict(OPT_OUT_MESSAGE);
    return conflict("Cette séquence est en pause. Réactivez-la avant de la lancer.");
  } catch (error) {
    return serverError(`POST /api/sequences/${id}/run`, error);
  }
}
