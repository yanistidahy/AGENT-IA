import { z } from "zod";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import {
  queueBatchSchema,
  queueUndoSchema,
  runQueueBatch,
  undoQueueBatch,
} from "@/lib/api/queue";

export const dynamic = "force-dynamic";

/**
 * Actions groupées de la file d'accueil, et leur annulation.
 *
 * Une seule route pour les deux : l'annulation rejoue le chemin d'écriture en
 * sens inverse, et les séparer aurait autorisé les deux moitiés à diverger. Le
 * corps porte son mode dans `mode`, validé avant toute lecture de base.
 *
 * L'inverse de l'action est renvoyé au client, jamais gardé sur le serveur. Une
 * pile d'annulation côté serveur devrait être attribuée à une session, expirée,
 * nettoyée — de l'état à gérer pour cinq secondes de bandeau.
 */
const bodySchema = z.discriminatedUnion("mode", [
  queueBatchSchema.extend({ mode: z.literal("batch") }),
  queueUndoSchema.extend({ mode: z.literal("undo") }),
]);

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = bodySchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    if (parsed.data.mode === "undo") {
      const { steps, ids } = parsed.data;
      const result = await undoQueueBatch(steps, ids ?? []);
      return jsonOk(result);
    }

    // `mode` voyage avec le reste : une clé en trop est ignorée par le service,
    // et la retirer demanderait une déstructuration dont la variable inutilisée
    // serait signalée par le lint.
    const result = await runQueueBatch(parsed.data);
    return jsonOk(result);
  } catch (error) {
    return serverError("POST /api/queue", error);
  }
}
