import { listContactEmails } from "@/lib/api/email-sends";
import { serverError } from "@/lib/api/errors";

/** Les emails envoyés à une fiche — lus par le bloc de l'onglet Historique. */
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json({ emails: await listContactEmails(id) });
  } catch (error) {
    return serverError("GET /api/contacts/[id]/emails", error);
  }
}
