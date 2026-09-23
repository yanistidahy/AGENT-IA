import { z } from "zod";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { applyCampaignReset, planCampaignReset } from "@/lib/api/campaign-reset";

export const dynamic = "force-dynamic";

/**
 * Réinitialiser une campagne : tout le monde revient à l'étape 1.
 *
 * **Deux verbes, deux gestes** (jalons 8 et 81) : `POST` regarde — il compose
 * la phrase de confirmation, nomme les personnes qui ont répondu et celles
 * qui restent dehors, sans rien écrire ni composer ; `PUT` écrit, après que
 * l'utilisateur a lu cette phrase. Un point d'entrée unique ferait d'un
 * affichage d'écran cinquante-deux brouillons facturés.
 *
 * `includeRepliers` est **explicite des deux côtés** : le défaut du schéma est
 * `false`, donc un appel qui l'oublie exclut les personnes ayant répondu. Un
 * défaut inverse aurait fait partir un nouveau premier message à quelqu'un qui
 * a déjà répondu, pour la seule raison qu'un champ manquait.
 */

const schema = z.object({
  campaignId: z.string().min(1),
  includeRepliers: z.boolean().default(false),
});

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    return jsonOk(
      await planCampaignReset(parsed.data.campaignId, parsed.data.includeRepliers),
    );
  } catch (error) {
    return serverError("POST /api/campaigns/reset", error);
  }
}

export async function PUT(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    return jsonOk(
      await applyCampaignReset(parsed.data.campaignId, parsed.data.includeRepliers),
    );
  } catch (error) {
    return serverError("PUT /api/campaigns/reset", error);
  }
}
