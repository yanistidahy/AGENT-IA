import type { NextRequest } from "next/server";
import { z } from "zod";
import { isManualType, readManualState, setManualEvent } from "@/lib/api/manual-events";
import { readReplyEvents, setReplyCategory } from "@/lib/api/reply-category";
import { invalidPayload, jsonOk, serverError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

const schema = z.object({
  contactId: z.string().min(1),
  type: z.string().refine(isManualType, "Ce type ne se consigne pas à la main."),
  present: z.boolean(),
});

const categorySchema = z.object({
  eventId: z.string().min(1),
  /** `""` retire le classement : « non catégorisée » est un état du produit. */
  category: z.string(),
});

/**
 * L'état de prospection d'une fiche : les trois interrupteurs et ses réponses.
 *
 * Lecture seule, donc `GET`. Le panneau le lit lui-même au lieu de recevoir
 * son état du tiroir : le tiroir sert quatre onglets et six écrans, et lui
 * faire porter une donnée qu'un seul panneau affiche l'alourdirait pour tout
 * le monde.
 */
export async function GET(request: NextRequest) {
  try {
    const contactId = request.nextUrl.searchParams.get("contact") ?? "";
    if (contactId === "") {
      return jsonOk({ state: {}, replies: [] });
    }
    const [state, replies] = await Promise.all([
      readManualState(contactId),
      readReplyEvents(contactId),
    ]);
    return jsonOk({ state, replies });
  } catch (error) {
    return serverError("GET /api/outreach", error);
  }
}

/** Classer une réponse, ou retirer son classement. */
export async function PATCH(request: NextRequest) {
  try {
    const parsed = categorySchema.safeParse(await request.json());
    if (!parsed.success) return invalidPayload(parsed.error);

    const outcome = await setReplyCategory(parsed.data.eventId, parsed.data.category);
    return jsonOk(outcome);
  } catch (error) {
    return serverError("PATCH /api/outreach", error);
  }
}

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
