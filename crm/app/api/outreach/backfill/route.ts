import { backfillOutreachEvents } from "@/lib/api/outreach-events";
import { jsonOk, serverError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/**
 * La reprise de l'historique dans le journal d'événements.
 *
 * `POST` : elle écrit. Idempotente — chaque ligne reprise porte un identifiant
 * déterministe dérivé de sa source, donc un second passage ne crée rien. Elle
 * ne touche aucune table source : ni envoi, ni réponse, ni clic, ni interaction
 * n'est modifié.
 */
export async function POST() {
  try {
    return jsonOk(await backfillOutreachEvents());
  } catch (error) {
    return serverError("POST /api/outreach/backfill", error);
  }
}
