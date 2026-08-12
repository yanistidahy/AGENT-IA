import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { acceptDomain, acceptManyDomains, rejectDomain } from "@/lib/api/domain-review";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * La relecture des domaines proposés, **une société à la fois**.
 *
 * Route distincte de `/api/maintenance` parce que le contrat est différent :
 * les autres corrections s'appliquent en bloc après simulation, celle-ci se
 * décide ligne par ligne.
 *
 * `accept-many` existe, mais **uniquement pour les déductions** : le service
 * recalcule la proposition de chaque société et refuse tout ce qui vient du
 * nom plutôt que d'une adresse. Le bouton n'apparaît que sous le filtre
 * « Déduites d'une adresse » ; cette vérification-ci est ce qui rend la règle
 * vraie, l'affichage n'étant qu'une commodité.
 *
 * Rien dans cette route n'appelle l'adresse proposée : aucune requête sortante
 * n'est émise, ni pour vérifier, ni pour prévisualiser.
 */
const DOMAIN = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i;

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
    .regex(DOMAIN, "Ce n'est pas un domaine."),
});

/** Acceptation groupée. Le plafond borne la requête, pas la règle. */
const bulkSchema = z.object({
  action: z.literal("accept-many"),
  entries: z
    .array(
      z.object({
        companyId: z.string().trim().min(1),
        value: z.string().trim().regex(DOMAIN, "Ce n'est pas un domaine."),
      }),
    )
    .min(1, "Aucune ligne à accepter")
    .max(500),
});

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const bulk = bulkSchema.safeParse(body.value);
  if (bulk.success) {
    try {
      const result = await acceptManyDomains(
        bulk.data.entries.map((entry) => ({
          companyId: entry.companyId,
          value: entry.value.toLowerCase(),
        })),
      );
      return jsonOk({
        message: result.message,
        written: result.written,
        skipped: result.skipped,
        skippedRows: result.skippedRows,
        undo: result.undo,
      });
    } catch (error) {
      return serverError("POST /api/maintenance/domains (accept-many)", error);
    }
  }

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
