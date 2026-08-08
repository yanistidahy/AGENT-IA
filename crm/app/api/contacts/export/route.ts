import type { NextRequest } from "next/server";
import { parseContactsQuery } from "@/lib/api/contact-schemas";
import { listContacts } from "@/lib/api/contacts";
import { getPilotage } from "@/lib/api/reference";
import { contactsToCsv, csvResponse } from "@/lib/api/csv-export";
import { invalidPayload, serverError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/** Export CSV des contacts, filtres de l'écran compris : on exporte ce qu'on voit. */
export async function GET(request: NextRequest) {
  const query = parseContactsQuery(request.nextUrl.searchParams);
  if (!query.success) return invalidPayload(query.error);

  try {
    const contacts = await listContacts(query.data, await getPilotage(), new Date());
    const day = new Date().toISOString().slice(0, 10);
    return csvResponse(contactsToCsv(contacts), `contacts-${day}.csv`);
  } catch (error) {
    return serverError("GET /api/contacts/export", error);
  }
}
