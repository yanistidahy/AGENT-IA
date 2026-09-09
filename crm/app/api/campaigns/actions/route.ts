import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { archiveCampaign, listCampaigns, removeMember } from "@/lib/api/campaigns";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * Les opérations qui **changent un état** sans rien créer ni rien effacer :
 * archiver ou désarchiver une campagne, retirer un inscrit.
 *
 * Elles vivent dans leur propre route plutôt que dans un `POST` surchargé, et
 * chacune se nomme par `action` — même précaution que le champ `operation` de
 * `/api/maintenance` : une requête mal formée ne doit pas déclencher autre
 * chose par accident.
 *
 * **Aucune ne touche à un contact.** Archiver arrête les inscriptions et écarte
 * les départs en attente ; retirer arrête une inscription. Les fiches, leurs
 * interactions et leurs envois passés ne bougent pas.
 */
const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("archive"),
    campaignId: z.string().min(1),
    archived: z.boolean(),
  }),
  z.object({ action: z.literal("remove-member"), enrollmentId: z.string().min(1) }),
]);

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Corps de requête JSON illisible.");

  const parsed = actionSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const result =
      parsed.data.action === "archive"
        ? await archiveCampaign(parsed.data.campaignId, parsed.data.archived)
        : await removeMember(parsed.data.enrollmentId);
    if (!result.ok) return badRequest(result.message);
    return jsonOk({ campaigns: await listCampaigns() });
  } catch (error) {
    return serverError("POST /api/campaigns/actions", error);
  }
}
