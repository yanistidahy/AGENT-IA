import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { readAutoSendStatus, writeAutoSend } from "@/lib/api/auto-send";
import { ensureAutoSendLoop } from "@/lib/api/auto-send-loop";
import { MIN_INTERVAL_SECONDS } from "@/lib/domain/auto-send";
import { z } from "zod";

export const dynamic = "force-dynamic";

/**
 * L'envoi automatique : son état, et ses réglages.
 *
 * `GET` lit — **et n'écrit rien**, pas même une échéance : le panneau se
 * rafraîchit toutes les cinq secondes pendant que l'ordonnanceur tourne, et une
 * lecture qui avancerait l'horloge ferait de l'affichage d'un écran une
 * décision d'envoi. `PATCH` enregistre.
 */
const settingsSchema = z.object({
  enabled: z.boolean(),
  /**
   * Refusé plutôt que ramené en silence au plancher : une cadence qu'on croit
   * avoir et qu'on n'a pas est pire qu'un refus.
   */
  intervalSeconds: z
    .number()
    .int()
    .min(MIN_INTERVAL_SECONDS, "L'intervalle ne peut pas descendre sous une minute.")
    .max(12 * 3600),
  startMinute: z.number().int().min(0).max(24 * 60),
  endMinute: z.number().int().min(0).max(24 * 60),
  vary: z.boolean(),
});

export async function GET(): Promise<Response> {
  try {
    return jsonOk(await readAutoSendStatus());
  } catch (error) {
    return serverError("GET /api/auto-send", error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");
  const parsed = settingsSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    // Armer l'interrupteur arme la boucle : sans cela, allumer depuis un autre
    // écran laisserait la file immobile jusqu'à la prochaine ouverture de
    // « Départs du jour ».
    ensureAutoSendLoop();
    const result = await writeAutoSend(parsed.data);
    if (!result.ok) return badRequest(result.message);
    return jsonOk({ ok: true, status: result.status });
  } catch (error) {
    return serverError("PATCH /api/auto-send", error);
  }
}
