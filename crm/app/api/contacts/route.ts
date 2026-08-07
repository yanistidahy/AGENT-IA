import type { NextRequest } from "next/server";
import { createContactSchema, parseContactsQuery } from "@/lib/api/contact-schemas";
import { createContact, listContacts } from "@/lib/api/contacts";
import { badRequest, invalidPayload, jsonOk, serverError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/request";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = parseContactsQuery(request.nextUrl.searchParams);
  if (!query.success) return invalidPayload(query.error);

  try {
    const contacts = await listContacts(query.data);
    return jsonOk({ contacts, total: contacts.length });
  } catch (error) {
    return serverError("GET /api/contacts", error);
  }
}

export async function POST(request: NextRequest) {
  const body = await readJson(request);
  if (body.ok === false) return badRequest("Corps de requête JSON illisible.");

  const parsed = createContactSchema.safeParse(body.value);
  if (!parsed.success) return invalidPayload(parsed.error);

  try {
    const contact = await createContact(parsed.data);
    return jsonOk({ contact }, 201);
  } catch (error) {
    return serverError("POST /api/contacts", error);
  }
}
