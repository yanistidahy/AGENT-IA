import { updateDealSchema } from "@/lib/api/deal-schemas";
import { dealDeletionReport, deleteDeal, getDeal, updateDeal } from "@/lib/api/deals";
import {
  badRequest,
  conflict,
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

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    // `?suppression=1` rend les faits qui décident **avant** de demander
    // confirmation : une confirmation qui ignore ce qu'elle va détruire ne vaut
    // pas mieux qu'un « Êtes-vous sûr ? ».
    if (new URL(request.url).searchParams.get("suppression") !== null) {
      const report = await dealDeletionReport(id);
      if (report === null) return notFound("Affaire introuvable.");
      return jsonOk({ suppression: report });
    }

    const deal = await getDeal(id);
    if (deal === null) return notFound("Affaire introuvable.");
    return jsonOk({ deal });
  } catch (error) {
    return serverError(`GET /api/deals/${id}`, error);
  }
}

/**
 * Suppression — réservée aux vraies erreurs de saisie.
 *
 * Le refus est un **409 qui nomme ce qui retient**, pas un 403 muet : c'est une
 * règle métier, pas un défaut de droit, et l'utilisateur a besoin de savoir
 * quoi faire à la place. Le verdict est relu ici, au moment d'écrire, et non
 * repris de l'affichage — la confirmation peut rester ouverte pendant qu'un
 * appel se consigne ailleurs.
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const result = await deleteDeal(id);
    if (result.ok) return jsonOk({ deleted: true });
    if (result.reason === "not_found") return notFound("Affaire introuvable.");
    return conflict(result.message);
  } catch (error) {
    return serverError(`DELETE /api/deals/${id}`, error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = updateDealSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const deal = await updateDeal(id, parsed.data);
    if (deal === null) return notFound("Affaire introuvable.");
    return jsonOk({ deal });
  } catch (error) {
    return serverError(`PATCH /api/deals/${id}`, error);
  }
}
