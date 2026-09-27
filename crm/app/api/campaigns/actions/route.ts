import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import {
  archiveCampaign,
  listCampaigns,
  removeMember,
  setCampaignGroupFilter,
  setCampaignOtherRouting,
  setCampaignRunning,
} from "@/lib/api/campaigns";
import { CONTACT_GROUPS } from "@/lib/domain/contact-group";
import { OTHER_ROUTINGS } from "@/lib/domain/step-variants";
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
  /*
    **Lancer et mettre en pause, distincts d'archiver.** Archiver clôt une
    campagne (inscriptions arrêtées, départs écartés) ; la pause ne fait que
    couper l'envoi, et relancer reprend où l'on en était. Les mêler sous un
    seul verbe aurait fait d'une pause de deux heures une clôture.
  */
  z.object({
    action: z.literal("running"),
    campaignId: z.string().min(1),
    running: z.boolean(),
  }),
  /*
    **Le public visé, par groupe de fonction.** Une liste vide vaut « tous », et
    c'est ce que portent les campagnes d'avant les groupes : le filtre ne peut
    donc pas rétrécir un public par accident de migration. Le filtre est
    ré-appliqué **à l'inscription**, côté serveur, pas seulement à l'écran.
  */
  z.object({
    action: z.literal("group-filter"),
    campaignId: z.string().min(1),
    groups: z.array(z.enum(CONTACT_GROUPS)).max(CONTACT_GROUPS.length),
  }),
  /*
    **Le routage d'« Autre » et des fiches non classées.** Il choisit *quelle
    variante ces contacts reçoivent*, et rien d'autre : `setCampaignOtherRouting`
    n'écrit qu'une colonne de la campagne, jamais le groupe d'une fiche.
  */
  z.object({
    action: z.literal("other-routing"),
    campaignId: z.string().min(1),
    routing: z.enum(OTHER_ROUTINGS),
  }),
]);

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Corps de requête JSON illisible.");

  const parsed = actionSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    if (parsed.data.action === "group-filter") {
      await setCampaignGroupFilter(parsed.data.campaignId, parsed.data.groups);
      return jsonOk({ campaigns: await listCampaigns() });
    }

    if (parsed.data.action === "other-routing") {
      await setCampaignOtherRouting(parsed.data.campaignId, parsed.data.routing);
      return jsonOk({ campaigns: await listCampaigns() });
    }

    const result =
      parsed.data.action === "archive"
        ? await archiveCampaign(parsed.data.campaignId, parsed.data.archived)
        : parsed.data.action === "running"
          ? await setCampaignRunning(parsed.data.campaignId, parsed.data.running)
          : await removeMember(parsed.data.enrollmentId);
    if (!result.ok) return badRequest(result.message);
    return jsonOk({ campaigns: await listCampaigns() });
  } catch (error) {
    return serverError("POST /api/campaigns/actions", error);
  }
}
