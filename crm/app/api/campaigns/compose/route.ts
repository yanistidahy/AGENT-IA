import { z } from "zod";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { composeForCampaign, planComposition } from "@/lib/api/compose-now";
import { listCampaigns } from "@/lib/api/campaigns";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Composer les départs d'une campagne : le plan, puis le travail.
 *
 * **Deux verbes, et la séparation est le sujet.** `GET` établit le plan — combien
 * de brouillons, combien d'appels, combien ça coûte — et **n'appelle aucun
 * modèle** : c'est ce que lit la confirmation. `POST` fait le travail. Un seul
 * point d'entrée qui ferait les deux dépenserait de l'argent au simple
 * affichage d'un écran, et la règle « aucune écriture sans clic » du jalon 8
 * vaut d'autant plus quand l'écriture est facturée.
 *
 * Privée par le middleware, comme tout `/api/*` depuis le jalon 9.
 */
const schema = z.object({ campaignId: z.string().min(1) });

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("campaignId") ?? "";
  if (id === "") return badRequest("Campagne non désignée.");

  // `aInscrire` : les fiches cochées, pas encore inscrites. Elles comptent dans
  // le prix annoncé — sinon la confirmation d'une inscription de cinquante
  // personnes annoncerait « 0 brouillon ».
  const pending = Number.parseInt(params.get("aInscrire") ?? "0", 10);

  try {
    return jsonOk({ plan: await planComposition(id, new Date(), Number.isFinite(pending) ? pending : 0) });
  } catch (error) {
    return serverError("GET /api/campaigns/compose", error);
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Corps de requête JSON illisible.");

  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const outcome = await composeForCampaign(parsed.data.campaignId);
    return jsonOk({ outcome, campaigns: await listCampaigns() });
  } catch (error) {
    return serverError("POST /api/campaigns/compose", error);
  }
}
