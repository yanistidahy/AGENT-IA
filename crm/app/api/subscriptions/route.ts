import { NextResponse } from "next/server";
import { badRequest, conflict, invalidPayload, jsonOk, notFound, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import {
  createSubscriptionLink,
  createSubscriptionSchema,
  listSubscriptionsForCompany,
} from "@/lib/api/subscriptions";

export const dynamic = "force-dynamic";

/** `GET /api/subscriptions?companyId=…` — les abonnements d'une société. */
export async function GET(request: Request): Promise<NextResponse> {
  const companyId = new URL(request.url).searchParams.get("companyId") ?? "";
  if (companyId === "") return badRequest("Le paramètre companyId est requis.");
  try {
    return jsonOk({ subscriptions: await listSubscriptionsForCompany(companyId) });
  } catch (error) {
    return serverError("GET /api/subscriptions", error);
  }
}

/** `POST /api/subscriptions` — génère le lien d'une société. */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Le corps de la requête n'est pas du JSON valide.");

  const parsed = createSubscriptionSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const result = await createSubscriptionLink(parsed.data);
    if (result.ok) return jsonOk({ subscription: result.view }, 201);
    if (result.code === "not_found") return notFound(result.message);
    if (result.code === "conflict") return conflict(result.message);
    return NextResponse.json({ error: { code: "unavailable", message: result.message } }, { status: 503 });
  } catch (error) {
    return serverError("POST /api/subscriptions", error);
  }
}
