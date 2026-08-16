import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { ownerOrDefault, syncReminderTask } from "./automation";
import { resolveCompanyLink } from "./company-resolve";
import { toActivityType, toDealStatus, toLifecycle } from "../domain/guards";
import {
  followUpStatus,
  idleDays,
  type FollowUpStatus,
} from "../domain/follow-up";
import { isLost, isTerminal, LOST_LIFECYCLE, TERMINAL_RESET } from "../domain/lost";
import { ANSWERED_OUTCOMES, isStale, nameOverflow } from "../domain/status";
import { compareByStatus, matchesContactFilter } from "../domain/contact-status";
import { REAL_ACTIVITY } from "./real-activity";
import { searchText, searchTerm } from "../domain/text";
import { addDays, daysSince, startOfDay } from "../domain/dates";
import type { FilterState } from "../domain/column-filters";
import { facetsFor, matchesAll, type FacetValue } from "../domain/column-match";
import { columnsWhere, derivedFilters } from "./column-filters";
import {
  CONTACT_DB_COLUMNS,
  CONTACT_FACET_COLUMNS,
  type ContactFacetRow,
} from "./contact-columns";
import {
  DEFAULT_PILOTAGE,
  type ActivityType,
  type DealStatus,
  type Lifecycle,
  type PilotageSettings,
} from "../domain/types";
import type {
  CreateContactInput,
  ListContactsQuery,
  UpdateContactInput,
} from "./contact-schemas";

/**
 * Accès aux contacts.
 *
 * Même motif que `lib/api/deals.ts` : une seule couche de service, appelée par
 * les routes d'API *et* directement par les composants serveur.
 *
 * `mode: "insensitive"` est propre à PostgreSQL — voir CLAUDE.md § Base de données.
 */
function containsFilter(value: string): Prisma.StringFilter {
  return { contains: value, mode: "insensitive" };
}

export interface ContactDealSummary {
  readonly id: string;
  readonly name: string;
  readonly amount: number;
  readonly status: DealStatus;
  readonly stage: { readonly id: string; readonly name: string; readonly color: string };
}

export interface ContactRecord {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly title: string;
  readonly dep: string;
  readonly email: string;
  readonly phone: string;
  readonly linkedin: string;
  /** Site du contact ; à défaut, le domaine de sa société. Voir `toRecord`. */
  readonly website: string;
  readonly lifecycle: Lifecycle;
  readonly source: string;
  readonly owner: string;
  readonly tag: string;
  readonly lostReason: string;
  /** Statut saisi ; vide = le calcul fait foi. Voir lib/domain/status.ts. */
  readonly status: string;
  readonly statusSetAt: Date | null;
  /** Date de la dernière interaction, pour repérer un statut figé. */
  readonly lastActivityAt: Date | null;
  readonly notes: string;
  readonly createdAt: Date;
  readonly lastContact: Date | null;
  readonly nextReminder: Date | null;
  readonly companyId: string | null;
  readonly company: { readonly id: string; readonly name: string } | null;
  readonly deals: readonly ContactDealSummary[];
  /** Interactions consignées — distingue « jamais contacté » d'un import daté. */
  readonly activityCount: number;
  /** Statut de relance, dérivé (voir lib/domain/follow-up.ts). */
  readonly followUp: FollowUpStatus;
  /** Jours depuis la dernière touche, `null` si elle n'a jamais eu lieu. */
  readonly idleDays: number | null;

  /**
   * De quoi juger l'effort fourni, sans ouvrir la chronologie.
   *
   * « 3 tentatives · 0 réponse » se lit en une seconde et tranche entre
   * insister et abandonner ; le même jugement demandait auparavant d'ouvrir la
   * fiche puis de compter les lignes à la main.
   */
  readonly attempts: number;
  /** Interactions dont l'issue est « sans réponse ». */
  readonly unanswered: number;
  /** Type et issue du dernier échange — le canal qui a servi en dernier. */
  readonly lastChannel: ActivityType | null;
  readonly lastOutcome: string;
  /** Lus sur la société liée : savoir qui l'on appelle sans changer d'écran. */
  readonly companySize: string;
  readonly companyIndustry: string;
  /** Jours depuis la création de la fiche — l'ancienneté dans le vivier. */
  readonly ageDays: number;
}

const contactInclude = {
  company: { select: { id: true, name: true, domain: true, size: true, industry: true } },
  deals: {
    select: {
      id: true,
      name: true,
      amount: true,
      status: true,
      stage: { select: { id: true, name: true, color: true } },
    },
    orderBy: { amount: "desc" },
  },
  // Deux comptes filtrés plutôt qu'un chargement des interactions : « combien
  // de tentatives, combien sans réponse » se répond en SQL, et rapatrier
  // l'historique de cent quarante fiches pour en compter deux nombres serait
  // payer une lecture entière pour un affichage.
  // `where` posé sur les deux : une note de correction n'est pas une prise de
  // contact, et la compter fait mentir « jamais contacté ». Voir
  // lib/api/real-activity.ts.
  _count: { select: { activities: { where: REAL_ACTIVITY } } },
  // La dernière interaction seule : elle sert à repérer un statut figé et à
  // nommer le dernier canal, pas à afficher la chronologie — celle-ci est
  // chargée à l'ouverture du tiroir. Une note de correction est plus récente
  // que le statut qu'elle vient d'écrire : la compter figerait toutes les
  // fiches corrigées.
  activities: {
    where: REAL_ACTIVITY,
    select: { date: true, type: true, outcome: true },
    orderBy: { date: "desc" },
    take: 1,
  },
} satisfies Prisma.ContactInclude;

type ContactRow = Prisma.ContactGetPayload<{ include: typeof contactInclude }>;

/**
 * Interactions sans réponse, par contact.
 *
 * Un `groupBy` pour toute la liste plutôt qu'un compte par fiche : Prisma ne
 * sait pas rendre deux compteurs de la même relation dans un seul `_count`
 * (l'un total, l'autre filtré), et cent quarante requêtes pour cent quarante
 * lignes seraient un prix absurde pour un second nombre.
 */
async function unansweredByContact(ids: readonly string[]): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.activity.groupBy({
    by: ["contactId"],
    where: { contactId: { in: [...ids] }, outcome: "no-answer", ...REAL_ACTIVITY },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.contactId !== null) map.set(row.contactId, row._count._all);
  }
  return map;
}

function toRecord(
  row: ContactRow,
  settings: PilotageSettings,
  now: Date,
  unanswered = 0,
): ContactRecord {
  const followUpInput = {
    lastContact: row.lastContact,
    nextReminder: row.nextReminder,
    activityCount: row._count.activities,
  };
  const last = row.activities[0];

  return {
    activityCount: row._count.activities,
    followUp: followUpStatus(followUpInput, settings, now),
    idleDays: idleDays(followUpInput, now),
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    title: row.title,
    dep: row.dep,
    email: row.email,
    phone: row.phone,
    linkedin: row.linkedin,
    lifecycle: toLifecycle(row.lifecycle),
    source: row.source,
    owner: row.owner,
    tag: row.tag,
    lostReason: row.lostReason,
    status: row.status,
    statusSetAt: row.statusSetAt,
    // Le domaine de la société sert de défaut **à l'affichage**, jamais en
    // base : recopier la valeur à l'écriture ferait diverger les deux le jour
    // où la société change de domaine, et personne ne saurait laquelle croire.
    website: row.website !== "" ? row.website : (row.company?.domain ?? ""),
    lastActivityAt: row.activities[0]?.date ?? null,
    attempts: row._count.activities,
    unanswered,
    lastChannel: last === undefined ? null : toActivityType(last.type),
    lastOutcome: last?.outcome ?? "",
    companySize: row.company?.size ?? "",
    companyIndustry: row.company?.industry ?? "",
    ageDays: daysSince(row.createdAt, now),
    notes: row.notes,
    createdAt: row.createdAt,
    lastContact: row.lastContact,
    nextReminder: row.nextReminder,
    companyId: row.companyId,
    company: row.company === null ? null : { id: row.company.id, name: row.company.name },
    deals: row.deals.map((deal) => ({
      id: deal.id,
      name: deal.name,
      amount: deal.amount,
      status: toDealStatus(deal.status),
      stage: deal.stage,
    })),
  };
}

/**
 * Miroir de recherche d'une fiche.
 *
 * Recalculé à chaque écriture plutôt que dérivé en base : la règle vit dans
 * `lib/domain/text.ts`, testable sans PostgreSQL, et n'oblige à aucune extension.
 */
function contactSearchText(contact: {
  readonly firstName?: string;
  readonly lastName?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly title?: string;
  readonly dep?: string;
}): string {
  return searchText([
    contact.firstName,
    contact.lastName,
    contact.email,
    contact.phone,
    contact.title,
    contact.dep,
  ]);
}

function orderBy(query: ListContactsQuery): Prisma.ContactOrderByWithRelationInput[] {
  const dir = query.dir ?? "asc";
  switch (query.sort) {
    case "firstName":
      return [{ firstName: dir }];
    case "company":
      return [{ company: { name: dir } }, { lastName: "asc" }];
    case "lifecycle":
      return [{ lifecycle: dir }, { lastName: "asc" }];
    case "owner":
      return [{ owner: dir }, { lastName: "asc" }];
    case "lastContact":
      // Un contact jamais touché doit remonter en tête d'un tri par fraîcheur,
      // pas se retrouver relégué en fin de liste avec les valeurs nulles.
      return [{ lastContact: { sort: dir, nulls: "first" } }];
    case "createdAt":
      return [{ createdAt: dir }];
    case "tag":
      // Les fiches sans étiquette en fin de liste : une absence n'est pas une
      // valeur qui se classe avant « À rappeler ».
      return [{ tag: dir }, { lastName: "asc" }];
    default:
      return [{ lastName: dir }, { firstName: "asc" }];
  }
}

/**
 * Liste des contacts.
 *
 * Le statut de relance est **dérivé**, pas stocké : il ne peut donc pas être
 * filtré ni trié en SQL. Le filtrage et le tri correspondants se font en mémoire,
 * après lecture. C'est assumé au volume d'un CRM d'indépendant ; si la table
 * devait atteindre des dizaines de milliers de lignes, il faudrait matérialiser
 * le statut ou l'exprimer en requête brute — au prix de la portabilité du schéma.
 */
export async function listContacts(
  query: ListContactsQuery = {},
  settings: PilotageSettings = DEFAULT_PILOTAGE,
  now: Date = new Date(),
  filters: FilterState = {},
): Promise<ContactRecord[]> {
  const rows = await prisma.contact.findMany({
    where: contactsWhere(query, filters, now),
    include: contactInclude,
    orderBy: orderBy(query),
  });

  const unanswered = await unansweredByContact(rows.map((row) => row.id));
  let records = rows.map((row) => toRecord(row, settings, now, unanswered.get(row.id) ?? 0));
  records = applyDerived(records, query, filters, settings, now);

  // Le filtre « à relancer » rassemble retards et échéances à venir : sans tri
  // explicite, il s'ordonne par échéance croissante, du plus urgent au plus
  // lointain. C'est la lecture attendue d'un pipeline de relances.
  const sortKey = query.sort ?? (query.followUp === "reminder" ? "nextReminder" : undefined);

  if (sortKey === "followUp") {
    const direction = query.dir === "desc" ? -1 : 1;
    // Le comparateur vit dans le domaine : c'est lui qui sait que les fiches
    // closes vont en fin de liste **dans les deux sens**. Inverser le tri ne doit
    // pas ramener des « Perdu » en tête d'une liste de travail.
    records = [...records].sort((a, b) => compareByStatus(a, b, direction, settings, now));
  }

  if (sortKey === "nextReminder") {
    const direction = query.dir === "desc" ? -1 : 1;
    // Sans relance programmée : en fin de liste dans les deux sens — l'absence
    // de date n'est ni la plus urgente ni la plus lointaine, elle n'est rien.
    const key = (contact: ContactRecord) =>
      contact.nextReminder === null ? Number.MAX_SAFE_INTEGER : contact.nextReminder.getTime();
    records = [...records].sort((a, b) => {
      if (a.nextReminder === null) return 1;
      if (b.nextReminder === null) return -1;
      return (key(a) - key(b)) * direction;
    });
  }

  return records;
}

/**
 * Clause de lecture : recherche, puces, et filtres de colonne.
 *
 * **`Perdu` est écarté par défaut.** Un prospect qui a dit non n'a rien à faire
 * dans la liste d'appels du matin ; il reste accessible par sa propre puce, par
 * la recherche, et sa fiche est intacte. L'exclusion est une règle d'affichage,
 * pas un archivage — d'où sa place ici plutôt que dans la donnée.
 */
function contactsWhere(
  query: ListContactsQuery,
  filters: FilterState,
  now: Date,
): Prisma.ContactWhereInput {
  const and: Prisma.ContactWhereInput[] = [];

  if (query.lifecycle !== undefined && query.lifecycle !== "all") {
    and.push({ lifecycle: query.lifecycle });
  } else if (query.lifecycle === undefined && filters.lifecycle === undefined) {
    and.push({ NOT: { lifecycle: LOST_LIFECYCLE } });
  }

  if (query.owner !== undefined) and.push({ owner: query.owner });
  if (query.source !== undefined) and.push({ source: query.source });
  if (query.companyId !== undefined) and.push({ companyId: query.companyId });
  if (query.tag !== undefined) {
    and.push(query.tag === "" ? { tag: "" } : { tag: query.tag });
  }

  // Les bandes de l'entonnoir : trois questions d'historique, une clause SQL
  // chacune. En mémoire il faudrait charger les interactions de chaque fiche
  // pour répondre à ce qu'un `EXISTS` tranche en base.
  if (query.followUp === "contacted") and.push({ activities: { some: REAL_ACTIVITY } });
  if (query.followUp === "recent") {
    and.push({
      activities: { some: { ...REAL_ACTIVITY, date: { gte: addDays(startOfDay(now), -7) } } },
    });
  }
  if (query.followUp === "answered") {
    and.push({
      activities: { some: { ...REAL_ACTIVITY, outcome: { in: [...ANSWERED_OUTCOMES] } } },
    });
  }

  // Recherche insensible aux accents : elle porte sur le miroir normalisé, pas
  // sur les champs d'origine — voir lib/domain/text.ts.
  const term = searchTerm(query.q);
  if (term !== "") {
    and.push({
      OR: [{ searchText: { contains: term } }, { company: { searchText: { contains: term } } }],
    });
  }

  // Le critère de longueur ne s'exprime pas en SQL avec Prisma : la puce
  // « incomplets » applique donc son prédicat complet après lecture (voir
  // `applyDerived`). C'est une puce délibérée et rare, sur ~150 fiches.
  if (query.incomplete === true) {
    and.push({ OR: [...INCOMPLETE_BRANCHES, { firstName: { contains: "," } }] });
  }

  const columns = columnsWhere(filters, CONTACT_DB_COLUMNS, now);
  if (Object.keys(columns).length > 0) and.push(columns as Prisma.ContactWhereInput);

  return and.length === 0 ? {} : { AND: and };
}

/**
 * « Contacts incomplets » : la fiche existe mais on ne sait pas la joindre.
 *
 * Deux cas, réunis parce qu'ils demandent le même travail — reprendre la ligne :
 * aucun moyen de contact (ni adresse ni téléphone), ou un nom explicitement
 * marqué à compléter par l'import.
 */
const INCOMPLETE_BRANCHES: Prisma.ContactWhereInput[] = [
  { AND: [{ email: "" }, { phone: "" }] },
  { lastName: { contains: "(à compléter)", mode: "insensitive" } },
  // Nom débordé : une note avalée dans le champ à l'import. La virgule se
  // cherche en SQL ; la longueur, non — elle est reprise après lecture.
  { lastName: { contains: "," } },
];

const INCOMPLETE_WHERE: Prisma.ContactWhereInput = { OR: INCOMPLETE_BRANCHES };

/** Filtres qui ne s'expriment pas en SQL : puce de relance et colonnes dérivées. */
function applyDerived(
  records: readonly ContactRecord[],
  query: ListContactsQuery,
  filters: FilterState,
  settings: PilotageSettings,
  now: Date,
): ContactRecord[] {
  let result = [...records];

  const filter = query.followUp;

  // « Statut figé » compare deux dates que le domaine ne reçoit pas dans
  // `FollowUpLike` : il est appliqué ici, où elles sont disponibles.
  if (filter === "stale-status") {
    return result.filter((contact) =>
      isStale({
        status: contact.status,
        statusSetAt: contact.statusSetAt,
        lastActivityAt: contact.lastActivityAt,
      }),
    );
  }

  if (filter !== undefined) {
    result = result.filter((contact) =>
      matchesContactFilter(
        {
          lastContact: contact.lastContact,
          nextReminder: contact.nextReminder,
          activityCount: contact.activityCount,
          // Le statut saisi entre dans la décision : sans lui, la puce
          // « Jamais contacté » ignorait 66 fiches qui le portaient en base.
          status: contact.status,
          // Et le cycle de vie tranche avant lui quand il est terminal.
          lifecycle: contact.lifecycle,
        },
        filter,
        settings,
        now,
      ),
    );
  }

  if (query.incomplete === true) {
    result = result.filter(isIncomplete);
  }

  const derived = derivedFilters(filters, CONTACT_DB_COLUMNS);
  if (Object.keys(derived).length > 0) {
    result = result.filter((contact) =>
      matchesAll(toFacetRow(contact), CONTACT_FACET_COLUMNS, derived, now),
    );
  }

  return result;
}

function toFacetRow(contact: ContactRecord): ContactFacetRow {
  return {
    id: contact.id,
    lifecycle: contact.lifecycle,
    owner: contact.owner,
    source: contact.source,
    tag: contact.tag,
    lostReason: contact.lostReason,
    status: contact.status,
    companyName: contact.company?.name ?? null,
    lastContact: contact.lastContact,
    nextReminder: contact.nextReminder,
  };
}

/**
 * Valeurs distinctes proposées par les menus de colonne, avec leur nombre.
 *
 * Une projection légère est lue — huit petits champs, aucune jointure lourde —
 * et le comptage se fait dessus. Le tableau affiché, lui, reste filtré en base :
 * la table complète ne traverse jamais le réseau vers le navigateur.
 */
export async function contactFacets(
  query: ListContactsQuery,
  filters: FilterState,
  now: Date = new Date(),
): Promise<{
  readonly facets: Readonly<Record<string, readonly FacetValue[]>>;
  readonly total: number;
}> {
  // Les filtres de colonne sont volontairement retirés de la clause : chaque
  // menu compte sur ce que *les autres* colonnes ont laissé passer.
  const rows = await prisma.contact.findMany({
    where: contactsWhere(query, {}, now),
    select: {
      id: true,
      lifecycle: true,
      owner: true,
      source: true,
      tag: true,
      lostReason: true,
      status: true,
      lastContact: true,
      nextReminder: true,
      company: { select: { name: true } },
    },
  });

  const projected: ContactFacetRow[] = rows.map((row) => ({
    id: row.id,
    lifecycle: row.lifecycle,
    owner: row.owner,
    source: row.source,
    status: row.status,
    tag: row.tag,
    lostReason: row.lostReason,
    companyName: row.company?.name ?? null,
    lastContact: row.lastContact,
    nextReminder: row.nextReminder,
  }));

  return {
    facets: facetsFor(projected, CONTACT_FACET_COLUMNS, filters, now),
    total: projected.length,
  };
}

/** Étiquettes réellement utilisées, avec leur nombre de fiches. */
export async function listTags(): Promise<ReadonlyArray<{ value: string; count: number }>> {
  const rows = await prisma.contact.groupBy({
    by: ["tag"],
    where: { NOT: { tag: "" } },
    _count: { _all: true },
  });

  return rows
    .map((row) => ({ value: row.tag, count: row._count._all }))
    .sort((a, b) => a.value.localeCompare(b.value, "fr"));
}

/** Sociétés qui portent au moins un contact — les seules utiles au filtre. */
export async function listCompaniesWithContacts(): Promise<
  ReadonlyArray<{ id: string; name: string; count: number }>
> {
  const rows = await prisma.company.findMany({
    where: { contacts: { some: {} } },
    select: { id: true, name: true, _count: { select: { contacts: true } } },
    orderBy: { name: "asc" },
  });

  return rows.map((row) => ({ id: row.id, name: row.name, count: row._count.contacts }));
}

/**
 * Nombre de fiches incomplètes — alimente le compteur de la puce.
 *
 * Compte aussi les noms trop longs, que SQL ne sait pas mesurer ici : la
 * projection reste minuscule (deux colonnes) et le compte doit correspondre
 * exactement à ce que la puce affichera.
 */
export async function countIncompleteContacts(): Promise<number> {
  const rows = await prisma.contact.findMany({
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
  });
  return rows.filter(isIncomplete).length;
}

/** Le prédicat complet, appliqué en mémoire. Source unique du compte et du filtre. */
function isIncomplete(contact: {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
}): boolean {
  if (contact.email.trim() === "" && contact.phone.trim() === "") return true;
  if (contact.lastName.toLowerCase().includes("(à compléter)")) return true;
  return nameOverflow(contact.firstName) || nameOverflow(contact.lastName);
}

export async function getContact(
  id: string,
  settings: PilotageSettings = DEFAULT_PILOTAGE,
  now: Date = new Date(),
): Promise<ContactRecord | null> {
  const row = await prisma.contact.findUnique({ where: { id }, include: contactInclude });
  if (row === null) return null;
  const unanswered = await unansweredByContact([row.id]);
  return toRecord(row, settings, now, unanswered.get(row.id) ?? 0);
}

/**
 * Création d'un contact.
 *
 * `companyName` déclenche la création de la société dans **la même
 * transaction** : si l'écriture du contact échoue, aucune société fantôme ne
 * reste derrière.
 */
export async function createContact(input: CreateContactInput): Promise<ContactRecord> {
  const row = await prisma.$transaction(async (tx) => {
    const companyId = await resolveCompanyLink(tx, input);
    const created = await tx.contact.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      lifecycle: input.lifecycle,
      title: input.title ?? "",
      dep: input.dep ?? "",
      email: input.email ?? "",
      phone: input.phone ?? "",
      linkedin: input.linkedin ?? "",
      website: input.website ?? "",
      source: input.source ?? "",
      owner: input.owner ?? "",
      tag: input.tag ?? "",
      lostReason: input.lostReason ?? "",
      notes: input.notes ?? "",
      searchText: contactSearchText(input),
      companyId: companyId ?? null,
      lastContact: input.lastContact ?? null,
      nextReminder: input.nextReminder ?? null,
    },
    include: contactInclude,
    });

    if (created.nextReminder !== null) {
      await syncReminderTask(tx, {
        contactId: created.id,
        contactName: `${created.firstName} ${created.lastName}`,
        owner: await ownerOrDefault(tx, created.owner),
        reminder: created.nextReminder,
      });
    }

    return created;
  });
  const unanswered = await unansweredByContact([row.id]);
  return toRecord(row, DEFAULT_PILOTAGE, new Date(), unanswered.get(row.id) ?? 0);
}

export async function updateContact(
  id: string,
  input: UpdateContactInput,
): Promise<ContactRecord | null> {
  const existing = await prisma.contact.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      title: true,
      dep: true,
      lifecycle: true,
    },
  });
  if (existing === null) return null;

  const data: Prisma.ContactUpdateInput = {};

  if (input.firstName !== undefined) data.firstName = input.firstName;
  if (input.lastName !== undefined) data.lastName = input.lastName;
  if (input.lifecycle !== undefined) data.lifecycle = input.lifecycle;
  if (input.title !== undefined) data.title = input.title;
  if (input.dep !== undefined) data.dep = input.dep;
  if (input.email !== undefined) data.email = input.email;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.linkedin !== undefined) data.linkedin = input.linkedin;
  if (input.website !== undefined) data.website = input.website;
  if (input.source !== undefined) data.source = input.source;
  if (input.owner !== undefined) data.owner = input.owner;
  if (input.tag !== undefined) data.tag = input.tag;
  if (input.lostReason !== undefined) data.lostReason = input.lostReason;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.lastContact !== undefined) data.lastContact = input.lastContact;
  if (input.nextReminder !== undefined) data.nextReminder = input.nextReminder;

  const row = await prisma.$transaction(async (tx) => {
    const companyId = await resolveCompanyLink(tx, input);
    if (companyId !== undefined) {
      data.company = companyId === null ? { disconnect: true } : { connect: { id: companyId } };
    }
    // Un cycle de vie **terminal** efface le statut saisi, sa date, la relance,
    // et referme la tâche miroir. Laisser une échéance sur quelqu'un qui a dit
    // non, c'est se rappeler soi-même de rappeler quelqu'un qui a refusé.
    //
    // La condition porte sur le cycle de vie **résultant**, pas sur la
    // transition : une fiche déjà « Perdu » à laquelle on écrit un statut par
    // ailleurs doit être nettoyée elle aussi. C'est ce que l'ancienne version,
    // qui ne réagissait qu'au passage, laissait passer.
    const resulting = toLifecycle(input.lifecycle ?? existing.lifecycle);
    const becomesLost = isTerminal(resulting);

    if (becomesLost) Object.assign(data, TERMINAL_RESET);

    const updated = await tx.contact.update({ where: { id }, data, include: contactInclude });

    await tx.contact.update({
      where: { id },
      data: { searchText: contactSearchText(updated) },
    });

    // La tâche « Relancer X » suit la date saisie : posée elle apparaît, déplacée
    // elle bouge, effacée elle disparaît. Voir lib/domain/automation.ts.
    if (input.nextReminder !== undefined || becomesLost) {
      await syncReminderTask(tx, {
        contactId: updated.id,
        contactName: `${updated.firstName} ${updated.lastName}`,
        owner: await ownerOrDefault(tx, updated.owner),
        reminder: updated.nextReminder,
      });
    }

    return updated;
  });

  const unanswered = await unansweredByContact([row.id]);
  return toRecord(row, DEFAULT_PILOTAGE, new Date(), unanswered.get(row.id) ?? 0);
}

/**
 * Suppression d'un contact.
 *
 * Les affaires et les interactions liées survivent, détachées (`SetNull` au
 * schéma) : supprimer une fiche ne doit pas effacer du chiffre d'affaires. Les
 * tâches, elles, disparaissent — une relance sur un contact supprimé n'a plus
 * d'objet.
 */
export async function deleteContact(id: string): Promise<boolean> {
  const existing = await prisma.contact.findUnique({ where: { id }, select: { id: true } });
  if (existing === null) return false;
  await prisma.contact.delete({ where: { id } });
  return true;
}
