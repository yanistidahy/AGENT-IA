import type { NextRequest } from "next/server";
import { createCompany, listCompanies } from "@/lib/api/companies";
import { createCompanySchema, parseCompaniesQuery } from "@/lib/api/company-schemas";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = parseCompaniesQuery(request.nextUrl.searchParams);
  if (!query.success) return invalidPayload(query.error);

  try {
    const companies = await listCompanies(query.data);
    return jsonOk({ companies, total: companies.length });
  } catch (error) {
    return serverError("GET /api/companies", error);
  }
}

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = createCompanySchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const company = await createCompany(parsed.data);
    return jsonOk({ company }, 201);
  } catch (error) {
    return serverError("POST /api/companies", error);
  }
}
