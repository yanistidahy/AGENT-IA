import type { NextRequest } from "next/server";
import { z } from "zod";
import { isManualType, setManualEvent } from "@/lib/api/manual-events";
import { invalidPayload, jsonOk, serverError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const schema = z.object({
  contactId: z.string().min(1),
  type: z.string().refine(isManualType, "Ce type ne se consigne pas à la main."),
  present: z.boolean(),
});

/**
 * Les trois consignations à la main du jalon 109 — et leur annulation.
 *
 * `POST` seulement : chaque appel écrit ou retire un fait, et une route qui
 * écrit ne doit pas répondre à un préchargement de navigateur (jalon 16).
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return invalidPayload(parsed.error);

    const outcome = await setManualEvent(
      parsed.data.contactId,
      parsed.data.type,
      parsed.data.present,
    );
    return jsonOk(outcome);
  } catch (error) {
    return serverError("POST /api/outreach", error);
  }
}
