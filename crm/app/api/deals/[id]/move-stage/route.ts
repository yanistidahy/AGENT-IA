import { moveStageSchema } from "@/lib/api/deal-schemas";
import { moveDealStage } from "@/lib/api/deals";
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

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = moveStageSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const result = await moveDealStage(id, parsed.data.stageId);
    if (result.ok === false) {
      return notFound(
        result.reason === "deal_not_found" ? "Affaire introuvable." : "Étape introuvable.",
      );
    }
    return jsonOk({ deal: result.deal });
  } catch (error) {
    return serverError(`POST /api/deals/${id}/move-stage`, error);
  }
}
