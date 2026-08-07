import { importContacts } from "@/lib/api/contact-import";
import { importContactsSchema } from "@/lib/api/contact-schemas";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";

export const dynamic = "force-dynamic";

/**
 * Import de contacts collés depuis un tableur.
 *
 * Un collage mal formé est une erreur de client (400) ; un collage lisible dont
 * certaines lignes échouent est un succès (200) accompagné de son rapport. La
 * distinction compte : dans le second cas, des contacts ont bien été créés.
 */
export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = importContactsSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const outcome = await importContacts(parsed.data.text);
    if (!outcome.ok) return badRequest(outcome.message);
    return jsonOk({ report: outcome.report });
  } catch (error) {
    return serverError("POST /api/contacts/import", error);
  }
}
