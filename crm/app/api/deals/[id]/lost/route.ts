import { markLostSchema } from "@/lib/api/deal-schemas";
import { markDealLost } from "@/lib/api/deals";
import {
  badRequest,
  invalidPayload,
  jsonOk,
  notFound,
  serverError,
} from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";

export const dynamic = "force-dynamic";

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * « Marquer perdue » — le chemin normal de sortie du pipeline.
 *
 * Une route à elle plutôt qu'un `PATCH { status: "lost" }` : l'écriture porte
 * un motif, une note système et une date de clôture, et l'ensemble doit partir
 * dans une transaction. Passer par la mise à jour générique aurait rendu
 * possible un statut « perdu » sans rien de tout cela.
 */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = markLostSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const deal = await markDealLost(id, parsed.data.reason ?? "");
    if (deal === null) return notFound("Affaire introuvable.");
    return jsonOk({ deal });
  } catch (error) {
    return serverError(`POST /api/deals/${id}/lost`, error);
  }
}
