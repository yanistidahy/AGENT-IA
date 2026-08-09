import { deleteCompany, getCompany, updateCompany } from "@/lib/api/companies";
import { updateCompanySchema } from "@/lib/api/company-schemas";
import {
  badRequest,
  conflict,
  invalidPayload,
  jsonOk,
  notFound,
  serverError,
} from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";

export const dynamic = "force-dynamic";

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const company = await getCompany(id);
    if (company === null) return notFound("Société introuvable.");
    return jsonOk({ company });
  } catch (error) {
    return serverError(`GET /api/companies/${id}`, error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = updateCompanySchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const company = await updateCompany(id, parsed.data);
    if (company === null) return notFound("Société introuvable.");
    return jsonOk({ company });
  } catch (error) {
    return serverError(`PATCH /api/companies/${id}`, error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const result = await deleteCompany(id);
    if (result.ok) return jsonOk({ deleted: id });
    if (result.reason === "not_found") return notFound("Société introuvable.");

    return conflict(
      `Cette société porte ${result.contacts} contact(s) et ${result.deals} affaire(s). ` +
        "Détachez-les avant de la supprimer.",
    );
  } catch (error) {
    return serverError(`DELETE /api/companies/${id}`, error);
  }
}
