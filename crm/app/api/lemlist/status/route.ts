import { readLemlistStatus } from "@/lib/api/lemlist-sync";
import { jsonOk, serverError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * L'état de la synchronisation, relu après un « Synchroniser maintenant ».
 *
 * Le panneau ne recompose pas les comptes de son côté : il relit la même
 * fonction que le rendu serveur. Deux avis sur « combien d'événements » sont
 * exactement ce qui fait qu'une pastille finit par contredire sa liste — c'est
 * l'écart que les jalons 49, 78 et 105 ont payé trois fois.
 *
 * Fermée par le verrou d'espace de travail : elle n'est pas dans
 * `PUBLIC_PATHS`. **Elle ne renvoie jamais la clé** — `readLemlistStatus` ne la
 * lit que pour savoir si elle existe.
 */
export async function GET() {
  try {
    const status = await readLemlistStatus();
    return jsonOk({
      ...status,
      lastSuccessAt: status.lastSuccessAt?.toISOString() ?? null,
      lastAttemptAt: status.lastAttemptAt?.toISOString() ?? null,
    });
  } catch (error) {
    return serverError("GET /api/lemlist/status", error);
  }
}
