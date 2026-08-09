import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { updateList, updateListSchema } from "@/lib/api/settings";

export const dynamic = "force-dynamic";

/** Remplace une liste éditable (propriétaires, offres, sources, cycles de vie). */
export async function PUT(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = updateListSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    await updateList(parsed.data.kind, parsed.data.values);
    return jsonOk({ kind: parsed.data.kind, count: parsed.data.values.length });
  } catch (error) {
    return serverError("PUT /api/settings/lists", error);
  }
}
