import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import {
  createCampaign,
  createCampaignSchema,
  deleteCampaign,
  enrollSelection,
  listCampaigns,
  updateCampaign,
  updateCampaignSchema,
} from "@/lib/api/campaigns";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Les campagnes : liste, création, réglage, inscription.
 *
 * `PUT` porte l'inscription — c'est une opération sur des fiches, pas la
 * création d'une ressource, même distinction que `/api/sequences-email`. Elle
 * ré-évalue la sélection **au moment du clic** : ce que /contacts montrait est
 * ce qui s'inscrit, et rien ne s'inscrit sans ce clic.
 *
 * Privée par le middleware, comme tout `/api/*` depuis le jalon 9.
 */
export async function GET() {
  try {
    return jsonOk({ campaigns: await listCampaigns() });
  } catch (error) {
    return serverError("GET /api/campaigns", error);
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Corps de requête JSON illisible.");

  const parsed = createCampaignSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const created = await createCampaign(parsed.data);
    if (!created.ok) return badRequest(created.message);
    return jsonOk({ id: created.id, campaigns: await listCampaigns() });
  } catch (error) {
    return serverError("POST /api/campaigns", error);
  }
}

export async function PATCH(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Corps de requête JSON illisible.");

  const parsed = updateCampaignSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const updated = await updateCampaign(parsed.data);
    if (!updated.ok) return badRequest(updated.message);
    return jsonOk({ campaigns: await listCampaigns() });
  } catch (error) {
    return serverError("PATCH /api/campaigns", error);
  }
}

const enrollSchema = z.object({
  campaignId: z.string().min(1),
  /** La query string de /contacts qui décrit la sélection. Vide = tout le vivier. */
  selection: z.string().max(4000),
  /** Les fiches cochées. Prioritaires sur le filtre — voir `enrollSelection`. */
  contactIds: z.array(z.string().min(1)).max(2000).optional(),
});

export async function PUT(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Corps de requête JSON illisible.");

  const parsed = enrollSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const result = await enrollSelection(
      parsed.data.campaignId,
      parsed.data.selection,
      parsed.data.contactIds,
    );
    if (!result.ok) return badRequest(result.message);

    /*
      **L'inscription n'écrit plus de brouillon.** Le jalon 56 composait ici
      pour éviter la boucle de vingt-quatre heures ; mais inscrire et écrire
      sont deux décisions, et les lier obligeait à payer des appels au modèle au
      moment où l'on constitue une sélection. « Écrire les mails », sur la carte
      de la campagne, est le geste qui dépense, et il annonce son prix avant.
    */
    return jsonOk({
      outcome: result.outcome,
      campaigns: await listCampaigns(),
    });
  } catch (error) {
    return serverError("PUT /api/campaigns", error);
  }
}

/**
 * Supprime une campagne.
 *
 * Vide, une simple confirmation suffit. Ayant envoyé, `confirmName` doit
 * désigner **exactement** son nom — vérifié ici comme à l'écran
 * (`nameConfirms`, revérifié dans `deleteCampaign` : le serveur fait toujours
 * foi, un client altéré ne peut pas sauter la saisie). Le verdict est relu au
 * moment d'écrire, dans le service : la confirmation peut rester ouverte
 * pendant qu'un départ part, et c'est exactement l'instant où une campagne
 * vide cesse de l'être (leçon du jalon 47).
 */
export async function DELETE(request: Request) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id") ?? "";
  if (id === "") return badRequest("Campagne non désignée.");
  const confirmName = params.get("confirmName") ?? undefined;

  try {
    const result = await deleteCampaign(id, confirmName);
    if (!result.ok) return badRequest(result.message);
    return jsonOk({ campaigns: await listCampaigns() });
  } catch (error) {
    return serverError("DELETE /api/campaigns", error);
  }
}
