import { updateDealSchema } from "@/lib/api/deal-schemas";
import { getDeal, updateDeal } from "@/lib/api/deals";
import {
  badRequest,
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
    const deal = await getDeal(id);
    if (deal === null) return notFound("Affaire introuvable.");
    return jsonOk({ deal });
  } catch (error) {
    return serverError(`GET /api/deals/${id}`, error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = updateDealSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const deal = await updateDeal(id, parsed.data);
    if (deal === null) return notFound("Affaire introuvable.");
    return jsonOk({ deal });
  } catch (error) {
    return serverError(`PATCH /api/deals/${id}`, error);
  }
}
