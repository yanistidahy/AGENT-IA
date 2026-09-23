import { jsonOk, serverError } from "@/lib/api/errors";
import { planRewriteQueue, rewriteQueue } from "@/lib/api/rewrite-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Réécrire toute la file avec les consignes du jour.
 *
 * **`GET` regarde, `POST` fait** — la séparation du jalon 56 : le plan annonce
 * combien de brouillons, combien de textes retouchés à la main seront
 * remplacés et combien ça coûte, **sans appeler aucun modèle**. Un point
 * d'entrée unique dépenserait de l'argent au simple affichage de l'écran.
 */
export async function GET() {
  try {
    return jsonOk({ plan: await planRewriteQueue() });
  } catch (error) {
    return serverError("GET /api/departures/rewrite", error);
  }
}

export async function POST() {
  try {
    return jsonOk({ outcome: await rewriteQueue() });
  } catch (error) {
    return serverError("POST /api/departures/rewrite", error);
  }
}
