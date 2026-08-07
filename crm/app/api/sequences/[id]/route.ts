import { badRequest, invalidPayload, jsonOk, notFound, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { getSequence, updateSequence, updateSequenceSchema } from "@/lib/api/sequences";

export const dynamic = "force-dynamic";

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const sequence = await getSequence(id);
    if (sequence === null) return notFound("Séquence introuvable.");
    return jsonOk({ sequence });
  } catch (error) {
    return serverError(`GET /api/sequences/${id}`, error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = updateSequenceSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const sequence = await updateSequence(id, parsed.data);
    if (sequence === null) return notFound("Séquence introuvable.");
    return jsonOk({ sequence });
  } catch (error) {
    return serverError(`PATCH /api/sequences/${id}`, error);
  }
}
