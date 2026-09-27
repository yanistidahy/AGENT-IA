import { z } from "zod";

import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { deleteTaskTab, listTaskTabs, saveTaskTab } from "@/lib/api/task-tabs";

export const dynamic = "force-dynamic";

/**
 * Les onglets personnalisés de l'écran Tâches.
 *
 * Privée par le middleware, comme tout `/api/*` depuis le jalon 9.
 */
const saveSchema = z.object({
  name: z.string().min(1, "Donnez un nom à cet onglet."),
  query: z.string().max(2000),
});

const deleteSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  try {
    return jsonOk({ tabs: await listTaskTabs() });
  } catch (error) {
    return serverError("GET /api/task-tabs", error);
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Corps de requête JSON illisible.");

  const parsed = saveSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const saved = await saveTaskTab(parsed.data.name, parsed.data.query);
    if (!saved.ok) return badRequest(saved.message);
    return jsonOk({ tab: saved.tab, tabs: await listTaskTabs() });
  } catch (error) {
    return serverError("POST /api/task-tabs", error);
  }
}

export async function DELETE(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return badRequest("Corps de requête JSON illisible.");

  const parsed = deleteSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    await deleteTaskTab(parsed.data.id);
    return jsonOk({ tabs: await listTaskTabs() });
  } catch (error) {
    return serverError("DELETE /api/task-tabs", error);
  }
}
