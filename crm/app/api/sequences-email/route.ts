import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";
import {
  enroll,
  enrollSchema,
  listSequences,
  saveSequence,
  sequenceSchema,
} from "@/lib/api/email-sequences";

export const dynamic = "force-dynamic";

/**
 * Séquences d'emails : définition et inscriptions.
 *
 * `PUT` porte l'inscription plutôt que `POST` : c'est une opération sur des
 * contacts, pas la création d'une séquence, et les mêler sous un seul verbe
 * aurait obligé la charge utile à porter un champ « type » que le serveur
 * n'aurait pu que croire.
 */
export async function GET() {
  try {
    return jsonOk({ sequences: await listSequences() });
  } catch (error) {
    return serverError("GET /api/sequences-email", error);
  }
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = sequenceSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const result = await saveSequence(parsed.data);
    if (!result.ok) return badRequest(result.message);
    return jsonOk({ sequence: result.sequence, sequences: await listSequences() });
  } catch (error) {
    return serverError("POST /api/sequences-email", error);
  }
}

export async function PUT(request: Request) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = enrollSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    return jsonOk({ outcome: await enroll(parsed.data), sequences: await listSequences() });
  } catch (error) {
    return serverError("PUT /api/sequences-email", error);
  }
}
