import { z } from "zod";
import { badRequest, invalidPayload, jsonOk, notFound, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { decide, decisionSchema, executeProposedAction } from "@/lib/api/recommendations";

export const dynamic = "force-dynamic";

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * Décider d'une recommandation, ou exécuter une de ses actions.
 *
 * Les deux passent par la même route mais restent **deux gestes distincts** :
 * accepter un constat ne déclenche rien, exécuter une action est un second clic.
 * Confondre les deux ferait d'un « je suis d'accord » une écriture en base.
 */
const bodySchema = z.union([
  decisionSchema,
  z.object({ execute: z.number().int().min(0) }),
]);

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    if ("execute" in parsed.data) {
      const result = await executeProposedAction(id, parsed.data.execute);
      if (!result.ok) return badRequest(result.message);
      return jsonOk({ executed: true, summary: result.summary, result: result.result });
    }

    const result = await decide(id, parsed.data);
    if (!result.ok) return notFound(result.message);
    return jsonOk({ status: result.status });
  } catch (error) {
    return serverError(`PATCH /api/recommendations/${id}`, error);
  }
}
