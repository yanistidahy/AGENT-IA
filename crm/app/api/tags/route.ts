import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import { deleteTag, deleteTagSchema, renameTag, renameTagSchema } from "@/lib/api/tags";
import { listTags } from "@/lib/api/contacts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk({ tags: await listTags() });
  } catch (error) {
    return serverError("GET /api/tags", error);
  }
}

/** Renomme une étiquette sur toutes les fiches qui la portent. */
export async function PATCH(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = renameTagSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const count = await renameTag(parsed.data.from, parsed.data.to);
    return jsonOk({ renamed: count, tags: await listTags() });
  } catch (error) {
    return serverError("PATCH /api/tags", error);
  }
}

/** Retire l'étiquette. Les fiches restent, seule l'étiquette est effacée. */
export async function DELETE(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = deleteTagSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const count = await deleteTag(parsed.data.tag);
    return jsonOk({ cleared: count, tags: await listTags() });
  } catch (error) {
    return serverError("DELETE /api/tags", error);
  }
}
