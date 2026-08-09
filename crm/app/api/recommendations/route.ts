import { jsonOk, serverError } from "@/lib/api/errors";
import { listRecommendations } from "@/lib/api/recommendations";
import { isSeverity } from "@/lib/domain/recommendations";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const severity = params.get("severity");
  const scopeParam = params.get("scope");

  try {
    return jsonOk({
      recommendations: await listRecommendations({
        agentId: params.get("agent") ?? undefined,
        severity: severity !== null && isSeverity(severity) ? severity : undefined,
        scope: scopeParam === "decided" || scopeParam === "all" ? scopeParam : "open",
      }),
    });
  } catch (error) {
    return serverError("GET /api/recommendations", error);
  }
}
