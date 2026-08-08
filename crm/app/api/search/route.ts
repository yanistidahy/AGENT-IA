import type { NextRequest } from "next/server";
import { jsonOk, serverError } from "@/lib/api/errors";
import { search } from "@/lib/api/search";

export const dynamic = "force-dynamic";

/** Recherche de la palette Ctrl+K. Une requête vide renvoie une liste vide, pas tout. */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q") ?? "";

  try {
    const hits = await search(query);
    return jsonOk({ hits, total: hits.length });
  } catch (error) {
    return serverError("GET /api/search", error);
  }
}
