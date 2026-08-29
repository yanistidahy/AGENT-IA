import { ContactsView } from "@/components/contacts/contacts-view";
import { parseContactsQuery } from "@/lib/api/contact-schemas";
import {
  contactFacets,
  countIncompleteContacts,
  countUnidentifiedContacts,
  getContact,
  instagramCounts,
  listCompaniesWithContacts,
  listContacts,
  listTags,
} from "@/lib/api/contacts";
import { CONTACT_FILTER_COLUMNS } from "@/lib/api/contact-columns";
import { parseFilters } from "@/lib/domain/column-filters";
import { readAlerts } from "@/lib/api/alerts";
import { getPilotage, listOffers, listOwners, listSources } from "@/lib/api/reference";
import { lastSoldOffer } from "@/lib/api/qualification";
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

  // Les filtres de colonne sont lus depuis les paramètres **bruts** : ils
  // passent par des paramètres répétés (`f.lifecycle=Lead&f.lifecycle=Prospect`),
  // que l'aplatissement ci-dessus réduirait à leur première valeur.
  const filters = parseFilters(raw, CONTACT_FILTER_COLUMNS);

  // Le statut de relance dépend de `coldDays` : les réglages sont lus avant la
  // liste, pas en parallèle, pour que le calcul porte sur la valeur courante.
  const settings = await getPilotage();
  const now = new Date();

  const [
    contacts,
    owners,
    sources,
    companies,
    linkableDeals,
    sequences,
    alerts,
    facetData,
    companyOptions,
    tags,
    incompleteCount,
    unidentifiedCount,
    offers,
    defaultOffer,
    instaCounts,
  ] = await Promise.all([
    listContacts(query, settings, now, filters),
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
    contactFacets(query, filters, now),
    listCompaniesWithContacts(),
    listTags(),
    countIncompleteContacts(),
    countUnidentifiedContacts(),
    listOffers(),
    lastSoldOffer(),
    // Sur tout le portefeuille, jamais sur la liste filtrée : une puce qui
    // compte son propre résultat n'apprend rien (jalon 6).
    instagramCounts(),
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
      offers={offers}
      defaultOffer={defaultOffer ?? offers[0] ?? ""}
      companies={companies}
      settings={settings}
      linkableDeals={linkableDeals}
      sequences={sequences}
      alerts={alerts}
      focused={focused}
      reminderCounts={reminderCounts}
      account={query.account}
      dm={query.dm}
      instagramCounts={instaCounts}
      facets={facetData.facets}
      totalRows={facetData.total}
      incompleteCount={incompleteCount}
      unidentifiedCount={unidentifiedCount}
      companyOptions={companyOptions}
      tagCounts={tags}
      tags={tags.map((tag) => tag.value)}
    />
  );
}
