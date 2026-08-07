import type { NextRequest } from "next/server";
import { createDealSchema, parseDealsQuery } from "@/lib/api/deal-schemas";
import { createDeal, listDeals } from "@/lib/api/deals";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = parseDealsQuery(request.nextUrl.searchParams);
  if (!query.success) return invalidPayload(query.error);

  try {
    const deals = await listDeals(query.data);
    return jsonOk({ deals, total: deals.length });
  } catch (error) {
    return serverError("GET /api/deals", error);
  }
}

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = createDealSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const deal = await createDeal(parsed.data);
    return jsonOk({ deal }, 201);
  } catch (error) {
    return serverError("POST /api/deals", error);
  }
}
