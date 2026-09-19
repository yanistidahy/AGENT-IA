import { readColleagues } from "@/lib/api/account";
import { listContactLists } from "@/lib/api/contact-lists";
import { enrolledContactIds } from "@/lib/api/campaigns";
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
import { presetWindow } from "@/lib/domain/added-window";
import { startOfDay } from "@/lib/domain/dates";

/**
 * Vue liste des contacts. Comme pour les affaires, les filtres passent par l'URL
 * et l'écran appelle directement la couche service.
 *
 * **Un seul écran, deux routes.** `/contacts` l'appelle sans portée, la page
 * d'une liste (`/listes/[id]`, jalon 77) l'appelle avec la sienne. C'était la
 * demande — « le même tableau que /contacts, avec les colonnes et le sélecteur
 * existants » — et la seule façon de la tenir dans le temps : deux tableaux
 * auraient fini par ne plus offrir les mêmes colonnes, et c'est toujours le
 * second qu'on oublie de compléter (jalons 55, 64 et 66).
 */
export async function ContactsScreen({
  raw,
  listScope,
}: {
  readonly raw: Record<string, string | string[] | undefined>;
  /** La liste qu'on regarde, quand l'écran sert de page de liste. */
  readonly listScope?: { readonly id: string; readonly name: string };
}) {
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    flat[key] = Array.isArray(value) ? value[0] : value;
  }

  const parsed = parseContactsQuery(flat);
  /*
    La portée de liste **l'emporte sur l'URL** : la page d'une liste montre cette
    liste, et `lifecycle: "all"` avec elle. Une liste est un choix fait à la
    main, et en masquer les fiches closes ferait diverger le compte affiché sur
    la vignette de ce que la page montre — l'écart que le jalon 49 a payé une
    fois entre une puce et sa liste.
  */
  const query =
    listScope === undefined
      ? parsed.success
        ? parsed.data
        : {}
      : {
          // Le cycle de vie par défaut passe à « tous » : une liste est un choix
          // fait à la main, et en masquer les fiches closes ferait diverger le
          // compte de la vignette de ce que la page montre — l'écart que le
          // jalon 49 a payé une fois. Un cycle **explicitement** choisi dans
          // l'URL l'emporte, pour qu'on puisse croiser la liste avec lui.
          lifecycle: "all" as const,
          ...(parsed.success ? parsed.data : {}),
          liste: listScope.id,
        };

  // Les filtres de colonne sont lus depuis les paramètres **bruts** : ils
  // passent par des paramètres répétés (`f.lifecycle=Lead&f.lifecycle=Prospect`),
  // que l'aplatissement ci-dessus réduirait à leur première valeur.
  const filters = parseFilters(raw, CONTACT_FILTER_COLUMNS);

  // Le statut de relance dépend de `coldDays` : les réglages sont lus avant la
  // liste, pas en parallèle, pour que le calcul porte sur la valeur courante.
  const settings = await getPilotage();
  const now = new Date();

  const [
    lists,
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
    listContactLists(),
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
  // **Combien de fiches ajoutées cette semaine**, sur tout le portefeuille.
  // C'est le nombre qui dit si le sourcing tourne, et il porte sur tout le
  // vivier, jamais sur la liste filtrée : une puce qui compte son propre
  // résultat afficherait toujours le total de ce qu'elle vient de sélectionner.
  const addedWeekCount = await prisma.contact.count({
    where: { createdAt: { gte: presetWindow("semaine", now).from } },
  });

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

  // Les collègues de la seule fiche ouverte : une requête par rendu de tiroir,
  // jamais une par ligne de la liste.
  const colleagues = ficheId === undefined ? [] : await readColleagues(ficheId);

  // La campagne dont on choisit les contacts, quand on arrive par /campagnes.
  const campagneId = flat.campagne;
  const campaignTarget =
    campagneId === undefined
      ? null
      : await prisma.campaign.findUnique({
          where: { id: campagneId },
          select: { id: true, name: true, sequence: { select: { id: true } } },
        });

  // Les fiches déjà inscrites : marquées dans la liste et exclues du réajout,
  // plutôt que silencieusement dédoublonnées à l'inscription — voir jalon 55.
  const enrolledIds =
    campaignTarget?.sequence == null
      ? []
      : [...(await enrolledContactIds(campaignTarget.sequence.id))];

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
      colleagues={colleagues}
      campaignTarget={campaignTarget === null ? null : { id: campaignTarget.id, name: campaignTarget.name }}
      listScope={listScope ?? null}
      lists={lists.map((list) => ({ id: list.id, name: list.name }))}
      enrolledIds={enrolledIds}
      reminderCounts={reminderCounts}
      account={query.account}
      dm={query.dm}
      instagramCounts={instaCounts}
      ajout={query.ajout}
      du={query.du}
      au={query.au}
      addedWeekCount={addedWeekCount}
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
