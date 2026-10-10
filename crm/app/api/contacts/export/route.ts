import type { NextRequest } from "next/server";
import { parseContactsQuery } from "@/lib/api/contact-schemas";
import { listContacts } from "@/lib/api/contacts";
import { getPilotage } from "@/lib/api/reference";
import { contactsToCsv, csvResponse } from "@/lib/api/csv-export";
import { readExportExtras } from "@/lib/api/contact-export";
import { originFromHeaders } from "@/lib/domain/contact-export";
import { publicBaseUrl } from "@/lib/api/email-sends";
import { invalidPayload, serverError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

/**
 * Export CSV des contacts, filtres de l'écran compris : **on exporte ce qu'on
 * voit**.
 *
 * La requête traverse `parseContactsQuery` puis `listContacts`, c'est-à-dire
 * exactement le chemin de la page : la puce « Jamais contacté », le groupe de
 * fonction, la société, la recherche et les filtres de colonne s'appliquent donc
 * par construction, et le nombre de lignes exportées est celui qui s'affiche.
 * Un second chemin de lecture aurait fini par exporter autre chose que l'écran.
 */
export async function GET(request: NextRequest) {
  const query = parseContactsQuery(request.nextUrl.searchParams);
  if (!query.success) return invalidPayload(query.error);

  try {
    const now = new Date();
    const contacts = await listContacts(query.data, await getPilotage(), now);
    const extras = await readExportExtras(
      contacts.map((contact) => contact.id),
      now,
    );
    const day = new Date().toISOString().slice(0, 10);
    const origin = originFromHeaders(
      {
        forwardedHost: request.headers.get("x-forwarded-host") ?? "",
        forwardedProto: request.headers.get("x-forwarded-proto") ?? "",
        host: request.headers.get("host") ?? "",
      },
      { publicUrl: publicBaseUrl(), requestOrigin: request.nextUrl.origin },
    );
    const csv = contactsToCsv(contacts, { origin, extras });
    return csvResponse(csv, `contacts-${day}.csv`);
  } catch (error) {
    return serverError("GET /api/contacts/export", error);
  }
}
