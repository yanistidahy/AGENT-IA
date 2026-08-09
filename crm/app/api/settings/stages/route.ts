import { badRequest, conflict, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { listStages } from "@/lib/api/reference";
import { updateStages, updateStagesSchema } from "@/lib/api/settings";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = updateStagesSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const result = await updateStages(parsed.data);
    if (!result.ok) return conflict(result.message);
    return jsonOk({ stages: await listStages() });
  } catch (error) {
    return serverError("PUT /api/settings/stages", error);
  }
}
