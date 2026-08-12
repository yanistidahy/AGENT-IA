import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { acceptDomain, rejectDomain } from "@/lib/api/domain-review";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * La relecture des domaines proposés, **une société à la fois**.
 *
 * Route distincte de `/api/maintenance` parce que le contrat est différent :
 * les autres corrections s'appliquent en bloc après simulation, celle-ci se
 * décide ligne par ligne. Il n'existe volontairement aucun point d'entrée qui
 * accepterait plusieurs propositions d'un coup — un domaine proposé n'est pas
 * un fait vérifié, et rien dans cette route ne le vérifie : aucune requête
 * sortante n'est émise vers l'adresse proposée.
 */
const decisionSchema = z.object({
  companyId: z.string().min(1, "Société manquante"),
  action: z.enum(["accept", "reject"], { error: "Action inconnue" }),
  /** La valeur affichée à l'écran, renvoyée telle quelle. */
  value: z
    .string()
    .trim()
    .min(3, "Domaine trop court")
    .max(253, "Domaine trop long")
    // Un domaine, pas une URL : rien qui puisse porter un schéma ou un chemin.
    .regex(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i, "Ce n'est pas un domaine."),
});

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = decisionSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const { companyId, action, value } = parsed.data;
    const result =
      action === "accept"
        ? await acceptDomain(companyId, value.toLowerCase())
        : await rejectDomain(companyId, value.toLowerCase());

    if (!result.ok) return badRequest(result.message);
    return jsonOk({ message: result.message });
  } catch (error) {
    return serverError("POST /api/maintenance/domains", error);
  }
}
