import type { NextRequest } from "next/server";
import { createActivitySchema, parseActivitiesQuery } from "@/lib/api/activity-schemas";
import { listActivities, listCompanyTimeline, logActivity } from "@/lib/api/activities";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = parseActivitiesQuery(request.nextUrl.searchParams);
  if (!query.success) return invalidPayload(query.error);

  try {
    // Une société agrège : sa chronologie montre aussi ce qui s'est passé sur ses
    // affaires et ses contacts, sans quoi une fiche active paraîtrait muette.
    const { companyId, contactId, dealId } = query.data;
    const activities =
      companyId !== undefined && contactId === undefined && dealId === undefined
        ? await listCompanyTimeline(companyId)
        : await listActivities(query.data);

    return jsonOk({ activities, total: activities.length });
  } catch (error) {
    return serverError("GET /api/activities", error);
  }
}

/**
 * Consigne une interaction. La réponse porte la tâche créée par « prochaine
 * action » quand il y en a une : l'appelant peut la confirmer à l'écran plutôt
 * que de demander à l'utilisateur de vérifier lui-même dans /taches.
 */
export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = createActivitySchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const result = await logActivity(parsed.data);
    return jsonOk(
      { activity: result.activity, task: result.task, reminderTask: result.reminderTask },
      201,
    );
  } catch (error) {
    return serverError("POST /api/activities", error);
  }
}
