import { jsonOk, serverError } from "@/lib/api/errors";
import { listRuns, monthlyUsage } from "@/lib/api/recommendations";
import { runAllShifts } from "@/lib/agents/shifts/run";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET() {
  try {
    const [runs, usage] = await Promise.all([listRuns(), monthlyUsage()]);
    return jsonOk({ runs, usage });
  } catch (error) {
    return serverError("GET /api/shifts", error);
  }
}

/**
 * Déclenchement manuel depuis `/reglages`.
 *
 * Même code que le cron : `runAllShifts`. Le seul écart est le drapeau `manual`
 * du journal, pour qu'on distingue plus tard un run déclenché à la main d'un run
 * planifié — sans quoi une vacation d'essai fausserait la lecture du coût.
 */
export async function POST() {
  try {
    return jsonOk({ runs: await runAllShifts(true) });
  } catch (error) {
    return serverError("POST /api/shifts", error);
  }
}
