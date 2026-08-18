import { z } from "zod";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import {
  listDepartures,
  postponeDeparture,
  removeFromSequence,
  sendDeparture,
} from "@/lib/api/departures";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * La file du matin : lecture, et les trois décisions.
 *
 * Trois actions et pas une de plus — envoyer, reporter d'un jour, retirer de la
 * séquence. Une file qui demanderait plus d'un geste par ligne serait contournée
 * dès la deuxième semaine, et c'est alors le mode automatique qu'on activerait
 * trop tôt.
 */
const decisionSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["send", "postpone", "remove"], { error: "Action inconnue" }),
});

export async function GET() {
  try {
    return jsonOk({ departures: await listDepartures() });
  } catch (error) {
    return serverError("GET /api/departures", error);
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = decisionSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const { id, action } = parsed.data;
    // `auto: false` en dur : cette route est celle de l'humain. Un envoi
    // automatique ne passe jamais par HTTP, il part du passage quotidien — et
    // c'est ce qui fait que le compteur de départs « validés à la main » ne peut
    // pas être gonflé par la machine.
    const result =
      action === "send"
        ? await sendDeparture(id, false)
        : action === "postpone"
          ? await postponeDeparture(id)
          : await removeFromSequence(id);

    if (!result.ok) return badRequest(result.message);
    return jsonOk({ message: result.message, departures: await listDepartures() });
  } catch (error) {
    return serverError("POST /api/departures", error);
  }
}
