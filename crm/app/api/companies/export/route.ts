import type { NextRequest } from "next/server";
import { listCompanies } from "@/lib/api/companies";
import { parseCompaniesQuery } from "@/lib/api/company-schemas";
import { companiesToCsv, csvResponse } from "@/lib/api/csv-export";
import { invalidPayload, serverError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/** Export CSV des sociétés, filtres de l'écran compris. */
export async function GET(request: NextRequest) {
  const query = parseCompaniesQuery(request.nextUrl.searchParams);
  if (!query.success) return invalidPayload(query.error);

  try {
    const companies = await listCompanies(query.data);
    const day = new Date().toISOString().slice(0, 10);
    return csvResponse(companiesToCsv(companies), `societes-${day}.csv`);
  } catch (error) {
    return serverError("GET /api/companies/export", error);
  }
}
