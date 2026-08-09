import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { getPilotage, getReminderDelays } from "@/lib/api/reference";
import { updateSettings, updateSettingsSchema } from "@/lib/api/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk({ settings: await getPilotage(), delays: await getReminderDelays() });
  } catch (error) {
    return serverError("GET /api/settings", error);
  }
}

export async function PATCH(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = updateSettingsSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const result = await updateSettings(parsed.data);
    if (!result.ok) return badRequest(result.message);
    return jsonOk({ settings: await getPilotage(), delays: await getReminderDelays() });
  } catch (error) {
    return serverError("PATCH /api/settings", error);
  }
}
