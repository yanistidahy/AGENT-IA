import { runAllShifts } from "@/lib/agents/shifts/run";
import { cronAuthorised, cronDenied } from "@/lib/api/cron-auth";
import { jsonOk, serverError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Une vacation dépasse largement le délai par défaut d'une route Next. */
export const maxDuration = 300;

/** Vacations seules. Conservée pour pouvoir les relancer sans sauvegarder. */
export async function POST(request: Request) {
  if (!cronAuthorised(request)) return cronDenied();

  try {
    // Chaque vacation journalise son propre résultat, y compris en cas d'échec :
    // le tableau renvoyé ici est une commodité pour le cron, pas la trace.
    return jsonOk({ runs: await runAllShifts(false) });
  } catch (error) {
    return serverError("POST /api/cron/shifts", error);
  }
}
