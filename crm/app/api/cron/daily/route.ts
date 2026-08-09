import { runAllShifts } from "@/lib/agents/shifts/run";
import { takeSnapshot } from "@/lib/api/snapshots";
import { cronAuthorised, cronDenied } from "@/lib/api/cron-auth";
import { jsonOk, serverError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Le passage quotidien : sauvegarde puis vacations.
 *
 * **La sauvegarde passe en premier, et l'ordre est le sujet.** Elle capture
 * l'état d'avant tout ce que la journée pourra écrire, et surtout elle a lieu
 * même si les vacations échouent — l'inverse ferait dépendre le filet de
 * sécurité du bon fonctionnement d'un appel à un modèle.
 *
 * Un échec de sauvegarde n'empêche pas les vacations, et réciproquement : ce
 * sont deux travaux indépendants qui partagent un déclencheur, pas une chaîne.
 * Chacun journalise le sien.
 */
export async function POST(request: Request) {
  if (!cronAuthorised(request)) return cronDenied();

  try {
    const snapshot = await takeSnapshot();
    const runs = await runAllShifts(false);
    return jsonOk({ snapshot, runs });
  } catch (error) {
    return serverError("POST /api/cron/daily", error);
  }
}
