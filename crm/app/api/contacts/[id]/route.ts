import { updateContactSchema } from "@/lib/api/contact-schemas";
import { deleteContact, getContact, updateContact } from "@/lib/api/contacts";
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
    const contact = await getContact(id);
    if (contact === null) return notFound("Contact introuvable.");
    return jsonOk({ contact });
  } catch (error) {
    return serverError(`GET /api/contacts/${id}`, error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;

  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = updateContactSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const contact = await updateContact(id, parsed.data);
    if (contact === null) return notFound("Contact introuvable.");
    return jsonOk({ contact });
  } catch (error) {
    return serverError(`PATCH /api/contacts/${id}`, error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const removed = await deleteContact(id);
    if (!removed) return notFound("Contact introuvable.");
    return jsonOk({ deleted: id });
  } catch (error) {
    return serverError(`DELETE /api/contacts/${id}`, error);
  }
}
