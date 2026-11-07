import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  logManualMessages,
  readManualCounter,
  undoManualEntry,
} from "@/lib/api/manual-events";
import { isManualChannel, readEntryDate, readQuantity } from "@/lib/domain/manual-count";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * **Le compteur de messages manuels.**
 *
 * Fermée par le verrou d'espace de travail : la route n'est pas dans
 * `PUBLIC_PATHS`, donc le middleware du jalon 9 la refuse sans session. Rien à
 * vérifier ici — c'est la posture « tout est privé par défaut », et l'inverse
 * laisse passer la route qu'on oubliera.
 *
 * `POST` pour écrire, `DELETE` pour défaire, `GET` pour relire. Le `GET` existe
 * parce que le bloc relit l'état après chaque geste plutôt que de recomposer de
 * son côté ce que le serveur sait : deux avis sur « combien aujourd'hui » sont
 * exactement ce qui fait qu'une pastille finit par contredire sa liste (jalons
 * 49, 78 et 105).
 */

const logSchema = z.object({
  channel: z.string().refine(isManualChannel, "Canal inconnu du compteur."),
  /** Validée par le domaine, pas par Zod : le refus doit nommer la borne. */
  quantity: z.unknown().optional(),
  owner: z.string().max(80).optional(),
  /** `null` ou absent : le message est compté sans destinataire enregistré. */
  contactId: z.string().min(1).nullable().optional(),
  /** Antidatage, borné à sept jours. Absent : maintenant. */
  at: z.string().optional(),
});

const undoSchema = z.object({ entryId: z.string().min(1) });

export async function GET() {
  try {
    const state = await readManualCounter();
    return jsonOk({
      ...state,
      history: state.history.map((entry) => ({ ...entry, at: entry.at.toISOString() })),
    });
  } catch (error) {
    return serverError("GET /api/outreach/manual", error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = logSchema.safeParse(await request.json());
    if (!parsed.success) return invalidPayload(parsed.error);
    if (!isManualChannel(parsed.data.channel)) return badRequest("Canal inconnu du compteur.");

    /*
      **Les deux bornes sont lues par le domaine**, pas par le schéma : un refus
      doit dire *laquelle* est franchie (« au plus 20 d'un seul geste », « le
      compteur remonte à 7 jours »). Un `z.number().max(20)` rendrait
      « Invalid input », qui n'apprend rien et n'indique aucun geste.
    */
    const quantity = readQuantity(parsed.data.quantity ?? 1);
    if (!quantity.ok) return badRequest(quantity.message);

    const date = readEntryDate(parsed.data.at, new Date());
    if (!date.ok) return badRequest(date.message);

    const result = await logManualMessages({
      channel: parsed.data.channel,
      quantity: quantity.quantity,
      owner: parsed.data.owner ?? "",
      contactId: parsed.data.contactId ?? null,
      at: date.at,
    });
    if (!result.ok) return badRequest(result.message);

    const state = await readManualCounter();
    return jsonOk({
      ...result,
      today: state.today,
      history: state.history.map((entry) => ({ ...entry, at: entry.at.toISOString() })),
    });
  } catch (error) {
    return serverError("POST /api/outreach/manual", error);
  }
}

/** « Annuler » sur la dernière saisie, et la suppression depuis l'historique. */
export async function DELETE(request: NextRequest) {
  try {
    const parsed = undoSchema.safeParse(await request.json());
    if (!parsed.success) return invalidPayload(parsed.error);

    const result = await undoManualEntry(parsed.data.entryId);
    const state = await readManualCounter();
    return jsonOk({
      ...result,
      today: state.today,
      history: state.history.map((entry) => ({ ...entry, at: entry.at.toISOString() })),
    });
  } catch (error) {
    return serverError("DELETE /api/outreach/manual", error);
  }
}
