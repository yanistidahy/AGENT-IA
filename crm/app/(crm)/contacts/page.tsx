import { ContactsView } from "@/components/contacts/contacts-view";
import { parseContactsQuery } from "@/lib/api/contact-schemas";
import { getContact, listContacts } from "@/lib/api/contacts";
import { readAlerts } from "@/lib/api/alerts";
import { getPilotage, listOwners, listSources } from "@/lib/api/reference";
import { listSequences } from "@/lib/api/sequences";
import { prisma } from "@/lib/db";
import { startOfDay } from "@/lib/domain/dates";

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

  // Le statut de relance dépend de `coldDays` : les réglages sont lus avant la
  // liste, pas en parallèle, pour que le calcul porte sur la valeur courante.
  const settings = await getPilotage();
  const now = new Date();

  const [contacts, owners, sources, companies, linkableDeals, sequences, alerts] =
    await Promise.all([
    listContacts(query, settings, now),
    listOwners(),
    listSources(),
    prisma.company.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.deal.findMany({
      where: { status: "open" },
      select: { id: true, name: true, contactId: true },
      orderBy: { name: "asc" },
    }),
      listSequences(),
      readAlerts(),
    ]);

  // La fiche visée par `?fiche=` peut ne pas figurer dans la liste filtrée :
  // on la charge séparément pour que le lien ouvre bien le tiroir.
  // Les compteurs de la puce portent sur **tous** les contacts, pas sur la liste
  // filtrée : une puce qui compte son propre résultat afficherait toujours le
  // total de ce qu'elle vient de sélectionner, ce qui n'apprend rien.
  const withReminder = await prisma.contact.findMany({
    where: { nextReminder: { not: null } },
    select: { nextReminder: true },
  });
  const startOfToday = startOfDay(now);
  const reminderCounts = {
    total: withReminder.length,
    late: withReminder.filter(
      (row) => row.nextReminder !== null && startOfDay(row.nextReminder) <= startOfToday,
    ).length,
  };

  const ficheId = flat.fiche;
  const focused =
    ficheId === undefined || contacts.some((contact) => contact.id === ficheId)
      ? null
      : await getContact(ficheId, settings, now);

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
      focused={focused}
      reminderCounts={reminderCounts}
    />
  );
}
