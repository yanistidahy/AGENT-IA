import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { qualifyContact, qualifySchema } from "@/lib/api/qualification";

export const dynamic = "force-dynamic";

/**
 * Qualifier un contact, et ouvrir l'affaire qui va avec.
 *
 * Une seule route pour les deux effets, parce que c'est un seul geste : le
 * cycle de vie et l'affaire partent dans la même transaction. Deux appels
 * successifs depuis le navigateur laisseraient, à la moindre coupure, un
 * contact qualifié sans rien à suivre.
 *
 * L'inverse revient dans la réponse et se rejoue par `POST /api/queue`
 * (`mode: "undo"`) — le même mécanisme que la file d'accueil, pas une seconde
 * implémentation de l'annulation.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = qualifySchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const result = await qualifyContact(parsed.data);
    if (!result.ok) return badRequest(result.message);
    return jsonOk(result, result.created ? 201 : 200);
  } catch (error) {
    return serverError("POST /api/qualify", error);
  }
}
