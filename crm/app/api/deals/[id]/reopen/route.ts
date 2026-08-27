import { reopenDeal } from "@/lib/api/deals";
import { conflict, jsonOk, notFound, serverError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

/**
 * « Rouvrir » — remettre l'affaire dans le pipeline, à l'étape qu'elle n'a
 * jamais quittée.
 *
 * Rouvrir plutôt que recréer : une affaire recréée perd son historique, sa date
 * de création — donc la vélocité qu'on mesure — et le fil des échanges déjà
 * consignés.
 */
export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  try {
    const result = await reopenDeal(id);
    if (result.ok) return jsonOk({ deal: result.deal });
    if (result.reason === "not_found") return notFound("Affaire introuvable.");
    return conflict("Cette affaire est déjà en cours : il n'y a rien à rouvrir.");
  } catch (error) {
    return serverError(`POST /api/deals/${id}/reopen`, error);
  }
}
