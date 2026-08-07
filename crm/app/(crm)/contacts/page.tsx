import { ContactsView } from "@/components/contacts/contacts-view";
import { parseContactsQuery } from "@/lib/api/contact-schemas";
import { listContacts } from "@/lib/api/contacts";
import { readAlerts } from "@/lib/api/alerts";
import { getPilotage, listOwners, listSources } from "@/lib/api/reference";
import { listSequences } from "@/lib/api/sequences";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Vue liste des contacts. Comme pour les affaires, les filtres passent par l'URL
 * et la page appelle directement la couche service.
 */
export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    flat[key] = Array.isArray(value) ? value[0] : value;
  }

  const parsed = parseContactsQuery(flat);
  const query = parsed.success ? parsed.data : {};

  const [contacts, owners, sources, settings, companies, linkableDeals, sequences, alerts] =
    await Promise.all([
    listContacts(query),
    listOwners(),
    listSources(),
    getPilotage(),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.deal.findMany({
      where: { status: "open" },
      select: { id: true, name: true, contactId: true },
      orderBy: { name: "asc" },
    }),
      listSequences(),
      readAlerts(),
    ]);

  return (
    <ContactsView
      contacts={contacts}
      owners={owners}
      sources={sources}
      companies={companies}
      settings={settings}
      linkableDeals={linkableDeals}
      sequences={sequences}
      alerts={alerts}
    />
  );
}
