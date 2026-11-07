import "server-only";
import { prisma } from "../db";
import { searchText } from "../domain/text";
import { companyNameKey, contactNameKey } from "./name-keys";
import { normalizeCompanyName } from "./company-resolve";
import { groupOfTitle } from "../domain/contact-group";
import {
  LEMLIST_STATUS_LABELS,
  MISSING_KEY_MESSAGE,
  companyDomainOf,
  mapLemlistType,
  normaliseLinkedin,
  ownerFromLemlist,
  readLemlistActivity,
  type LemlistActivity,
} from "../domain/lemlist";
import { recordOutreachEvent } from "./outreach-events";
import { hasLemlistKey, readActivityPages, type LemlistError } from "./lemlist-client";

/**
 * **Un seul écrivain, deux chemins.**
 *
 * Le webhook et le relevé périodique n'écrivent pas chacun de leur côté : les
 * deux appellent `applyActivities`. C'est la décision qui rend le reste simple
 * — et c'est la leçon du jalon 12, où une règle écrite deux fois (une fois pour
 * le terminal, une fois pour le bouton) était la garantie qu'elles finiraient
 * par divergir.
 *
 * ## Pourquoi un rejeu est inoffensif
 *
 * Chaque événement porte `source: "lemlist"` et `externalId` = l'identifiant de
 * l'activité (`act_…`). La contrainte d'unicité `(source, externalId)` du jalon
 * 109 fait le reste : `recordOutreachEvent` avale le `P2002` et rend `false`.
 * Le webhook qui reçoit deux fois la même notification, le relevé qui repasse
 * sur une activité déjà vue, et le webhook et le relevé qui se croisent sur la
 * même activité **produisent une ligne**. Ce n'est pas une vérification
 * applicative que deux appels simultanés contourneraient : c'est la base qui
 * tranche.
 *
 * ## Le rapprochement, et le refus de fusionner
 *
 * Par adresse d'abord — coupée, en minuscules —, puis par URL LinkedIn réduite
 * à sa forme comparable. **Deux fiches qui répondent au même critère ne sont
 * jamais fusionnées** : l'activité est laissée de côté et l'ambiguïté est
 * écrite dans `lemlist_issues`, que `/reglages` affiche. Choisir « la première »
 * attribuerait silencieusement du travail à la mauvaise personne, et deviner
 * laquelle des deux fiches est la bonne n'est pas une décision de programme.
 *
 * Personne d'inconnu ? On crée la fiche, et sa société — rapprochée **par
 * domaine**, créée à défaut. Les domaines de messagerie publique sont écartés
 * en amont (`companyDomainOf`), sinon tous les indépendants du portefeuille
 * finiraient dans une société nommée Gmail.
 */

/* --------------------------------------------------------- les anomalies ----- */

export const ISSUE_KINDS = ["unmapped_type", "ambiguous_match"] as const;
export type IssueKind = (typeof ISSUE_KINDS)[number];

/**
 * Note une anomalie, ou incrémente la sienne.
 *
 * `(kind, key)` est unique en base : le même type inconnu rencontré mille fois
 * monte un compteur au lieu de produire mille lignes. `upsert` plutôt qu'un
 * `findFirst` suivi d'une écriture — une course ne contourne pas une
 * contrainte, elle contourne toujours une vérification.
 */
async function noteIssue(kind: IssueKind, key: string, detail: string): Promise<void> {
  const now = new Date();
  await prisma.lemlistIssue.upsert({
    where: { kind_key: { kind, key } },
    create: { kind, key, detail, firstAt: now, lastAt: now },
    update: { detail, lastAt: now, seen: { increment: 1 } },
  });
}

/* ------------------------------------------------------ le rapprochement ----- */

type Match =
  | { readonly kind: "found"; readonly contactId: string; readonly companyId: string | null; readonly owner: string }
  | { readonly kind: "ambiguous"; readonly on: string }
  | { readonly kind: "none" };

/**
 * Retrouve la fiche d'une activité, sans jamais en fusionner deux.
 *
 * La comparaison se fait **en mémoire** sur une projection légère, et non en
 * SQL. C'est la même raison qu'au jalon 6 pour les noms de société :
 * `mode: "insensitive"` ne couvre pas la normalisation que nous appliquons
 * (l'URL LinkedIn réduite), et une règle qu'on ne peut pas tester hors
 * production finit par laisser passer ce qu'elle prétend attraper. Au volume
 * d'un CRM d'indépendant, lire les contacts porteurs d'une adresse ou d'un
 * LinkedIn coûte moins qu'une règle invérifiable.
 */
async function matchContact(activity: LemlistActivity): Promise<Match> {
  if (activity.email !== "") {
    const byEmail = await prisma.contact.findMany({
      where: { email: { not: "" } },
      select: { id: true, email: true, companyId: true, owner: true },
    });
    const hits = byEmail.filter((row) => row.email.trim().toLowerCase() === activity.email);
    if (hits.length > 1) return { kind: "ambiguous", on: activity.email };
    const one = hits[0];
    if (one !== undefined) {
      return { kind: "found", contactId: one.id, companyId: one.companyId, owner: one.owner };
    }
  }

  if (activity.linkedinUrl !== "") {
    const byLinkedin = await prisma.contact.findMany({
      where: { linkedin: { not: "" } },
      select: { id: true, linkedin: true, companyId: true, owner: true },
    });
    const hits = byLinkedin.filter(
      (row) => normaliseLinkedin(row.linkedin) === activity.linkedinUrl,
    );
    if (hits.length > 1) return { kind: "ambiguous", on: activity.linkedinUrl };
    const one = hits[0];
    if (one !== undefined) {
      return { kind: "found", contactId: one.id, companyId: one.companyId, owner: one.owner };
    }
  }

  return { kind: "none" };
}

/**
 * La société d'un prospect importé : rapprochée par **domaine**, puis par nom,
 * créée à défaut.
 *
 * Le domaine passe avant le nom parce qu'il est la seule des deux valeurs qui
 * ne se réécrit pas : « Acme », « ACME SAS » et « Acme Inc. » sont trois façons
 * d'écrire `acme.com`. Sans domaine exploitable — adresse personnelle, pas de
 * site — on retombe sur le nom, avec la normalisation du jalon 6 (accents et
 * casse pliés), et la fiche se crée si rien ne correspond.
 */
async function resolveCompany(activity: LemlistActivity): Promise<string | null> {
  const domain = activity.companyDomain;
  if (domain !== "") {
    const byDomain = await prisma.company.findMany({
      where: { domain: { not: "" } },
      select: { id: true, domain: true },
    });
    const hit = byDomain.find((row) => companyDomainOf(row.domain, "") === domain);
    if (hit !== undefined) return hit.id;
  }

  const name = activity.companyName.trim();
  if (name === "" && domain === "") return null;

  const label = name !== "" ? name : domain;
  // La normalisation du jalon 6 : accents et casse pliés, pour que « Zénith
  // Labs » et « zenith labs » ne fassent pas deux maisons.
  const needle = normalizeCompanyName(label);
  const all = await prisma.company.findMany({ select: { id: true, name: true } });
  const existing = all.find((row) => normalizeCompanyName(row.name) === needle);
  if (existing !== undefined) return existing.id;

  const created = await prisma.company.create({
    data: {
      name: label,
      domain,
      searchText: searchText([label, domain]),
      nameKey: companyNameKey(label),
    },
    select: { id: true },
  });
  return created.id;
}

/** Le repère que porte une fiche venue de lemlist, écrit une fois. */
export const LEMLIST_IMPORT_MARK = "importé de lemlist";

/**
 * Crée la fiche d'un inconnu, marquée de son origine.
 *
 * `source` porte `lemlist` — donc le filtre de colonne « Source » de
 * `/contacts` la montre sans qu'on ajoute d'écran — et les notes portent la
 * phrase lisible. Le cycle de vie est `Lead` : quelqu'un qu'une séquence vient
 * de toucher n'est pas encore un prospect qualifié, et `Prospect` est ce que le
 * produit réserve à une réponse (jalon 13).
 */
async function createContact(activity: LemlistActivity, owners: readonly string[]): Promise<{
  readonly contactId: string;
  readonly companyId: string | null;
}> {
  const companyId = await resolveCompany(activity);
  const firstName = activity.firstName;
  const lastName = activity.lastName;
  const created = await prisma.contact.create({
    data: {
      firstName,
      lastName,
      email: activity.email,
      linkedin: activity.linkedinUrl === "" ? "" : `https://${activity.linkedinUrl}`,
      phone: activity.phone,
      title: activity.jobTitle,
      lifecycle: "Lead",
      source: "lemlist",
      owner: ownerFromLemlist(activity.sendUserName, owners),
      notes: `${LEMLIST_IMPORT_MARK} (${activity.campaignName === "" ? "hors campagne" : activity.campaignName}).`,
      companyId,
      searchText: searchText([firstName, lastName, activity.email, activity.phone, activity.jobTitle]),
      nameKey: contactNameKey({ firstName, lastName }),
      contactGroup: groupOfTitle(activity.jobTitle),
      groupSetBy: "auto",
    },
    select: { id: true, companyId: true },
  });
  return { contactId: created.id, companyId: created.companyId };
}

/* --------------------------------------------------------- l'application ----- */

export interface ApplyReport {
  /** Charges utiles reçues. */
  readonly received: number;
  /** Charges utiles illisibles — sans identifiant, sans type ou sans date. */
  readonly unreadable: number;
  /** Déjà en base : la contrainte d'unicité a fait son travail. */
  readonly duplicates: number;
  /** Laissées de côté, faute de savoir à qui les attribuer. */
  readonly ambiguous: number;
  readonly contactsCreated: number;
  readonly companiesCreated: number;
  /** Écrits, par type du journal. */
  readonly written: Readonly<Record<string, number>>;
  /** Les types lemlist rangés dans `other`, avec leur compte. */
  readonly unmapped: Readonly<Record<string, number>>;
}

function bump(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

/**
 * **L'écrivain unique.** Prend des charges utiles brutes et rend ce qu'il a
 * fait, type par type.
 *
 * Séquentiel, et c'est voulu : deux activités du même inconnu arrivant en
 * parallèle créeraient deux fiches, parce qu'il n'existe aucune contrainte
 * d'unicité sur une adresse de contact dans ce schéma (un prospect sans
 * adresse est un cas courant depuis le jalon 50). Les traiter l'une après
 * l'autre est la seule façon honnête de tenir « une deuxième activité pour la
 * même personne réutilise sa fiche ».
 */
export async function applyActivities(raws: readonly unknown[]): Promise<ApplyReport> {
  const owners = (
    await prisma.settingsList.findMany({ where: { kind: "owner" }, select: { value: true } })
  ).map((row) => row.value);

  let unreadable = 0;
  let duplicates = 0;
  let ambiguous = 0;
  let contactsCreated = 0;
  let companiesCreated = 0;
  const written: Record<string, number> = {};
  const unmapped: Record<string, number> = {};

  for (const raw of raws) {
    const activity = readLemlistActivity(raw);
    if (activity === null) {
      unreadable += 1;
      continue;
    }

    const mapping = mapLemlistType(activity.rawType);
    if (mapping.type === "other") {
      bump(unmapped, activity.rawType);
    }

    const match = await matchContact(activity);
    if (match.kind === "ambiguous") {
      ambiguous += 1;
      await noteIssue(
        "ambiguous_match",
        match.on,
        `Deux fiches ou plus répondent à « ${match.on} ». Aucune activité lemlist ne leur est attribuée tant que le doublon n'est pas tranché à la main.`,
      );
      continue;
    }

    let contactId: string;
    let companyId: string | null;
    let owner: string;
    if (match.kind === "found") {
      contactId = match.contactId;
      companyId = match.companyId;
      owner = match.owner !== "" ? match.owner : ownerFromLemlist(activity.sendUserName, owners);
    } else {
      const companiesBefore = await prisma.company.count();
      const fresh = await createContact(activity, owners);
      contactId = fresh.contactId;
      companyId = fresh.companyId;
      owner = ownerFromLemlist(activity.sendUserName, owners);
      contactsCreated += 1;
      if ((await prisma.company.count()) > companiesBefore) companiesCreated += 1;
    }

    const created = await recordOutreachEvent(prisma, {
      contactId,
      companyId,
      // `campaignId` reste nul : une campagne lemlist n'a pas de ligne dans
      // `campaigns`, et lui en inventer une la ferait apparaître dans
      // `/campagnes` avec des boutons qui n'ont aucun sens sur elle.
      campaignId: null,
      extCampaignId: activity.campaignId,
      extCampaignName: activity.campaignName,
      channel: mapping.channel,
      type: mapping.type,
      occurredAt: activity.occurredAt,
      owner,
      source: "lemlist",
      externalId: activity.externalId,
      detail: mapping.detail,
    });

    if (created) bump(written, mapping.type);
    else duplicates += 1;

    if (mapping.type === "other") {
      await noteIssue(
        "unmapped_type",
        activity.rawType,
        `${mapping.detail}. Importé en « Autre activité » : compté nulle part, visible dans le journal.`,
      );
    }
  }

  return {
    received: raws.length,
    unreadable,
    duplicates,
    ambiguous,
    contactsCreated,
    companiesCreated,
    written,
    unmapped,
  };
}

/* ------------------------------------------------------------ le relevé ------ */

/**
 * Le nombre de pages d'un passage. 100 activités par page, donc 20 000
 * activités au plus par reprise d'historique — largement au-delà d'un compte
 * réel, et borné pour qu'une requête HTTP ne tourne pas sans fin.
 */
const MAX_PAGES = 200;

/**
 * Le recouvrement d'un relevé incrémental.
 *
 * On ne repart pas de l'instant exact du dernier succès mais **deux heures
 * avant**. Deux raisons qui se cumulent : le cron de GitHub n'est pas
 * ponctuel (la file décale l'exécution, c'est écrit dans le workflow du jalon
 * 41), et une activité peut être enregistrée chez lemlist avec un `createdAt`
 * légèrement antérieur à son apparition dans l'API. Repasser sur deux heures
 * déjà vues ne coûte rien : la contrainte d'unicité les avale.
 */
const OVERLAP_MS = 2 * 60 * 60 * 1000;

export interface SyncOutcome {
  readonly ok: boolean;
  /** `connected` | `missing_key` | `refused` | `unknown` */
  readonly status: string;
  readonly message: string;
  readonly report: ApplyReport | null;
  readonly fullHistory: boolean;
}

/** L'état du relevé, créé à la première lecture. */
async function syncRow() {
  return prisma.lemlistSync.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {},
  });
}

/**
 * **Le relevé périodique**, appelé par le passage de quinze minutes et par le
 * bouton « Synchroniser maintenant ».
 *
 * La borne basse n'avance **que sur un succès**. Un passage qui échoue au
 * milieu laisse `lastSuccessAt` où il était : le suivant relira l'intervalle
 * entier plutôt que de laisser un trou que personne ne verrait.
 */
export async function syncLemlist(): Promise<SyncOutcome> {
  const state = await syncRow();
  const startedAt = new Date();

  if (!hasLemlistKey()) {
    await prisma.lemlistSync.update({
      where: { id: "singleton" },
      data: {
        lastAttemptAt: startedAt,
        status: "missing_key",
        lastError: MISSING_KEY_MESSAGE,
      },
    });
    return {
      ok: false,
      status: "missing_key",
      message: MISSING_KEY_MESSAGE,
      report: null,
      fullHistory: false,
    };
  }

  const fullHistory = !state.historyDone || state.lastSuccessAt === null;
  const minDate = fullHistory
    ? undefined
    : new Date(state.lastSuccessAt!.getTime() - OVERLAP_MS);

  const pages = await readActivityPages(minDate, MAX_PAGES);
  if (!pages.ok) {
    const error: LemlistError = pages.error;
    await prisma.lemlistSync.update({
      where: { id: "singleton" },
      data: {
        lastAttemptAt: startedAt,
        status: error.kind === "refused" ? "refused" : "unknown",
        lastError: error.message,
      },
    });
    return { ok: false, status: error.kind === "refused" ? "refused" : "unknown", message: error.message, report: null, fullHistory };
  }

  const report = await applyActivities(pages.data.raw);
  const total = Object.values(report.written).reduce((sum, count) => sum + count, 0);

  await prisma.lemlistSync.update({
    where: { id: "singleton" },
    data: {
      lastAttemptAt: startedAt,
      // Tronqué veut dire « il en reste » : on ne déclare pas l'historique
      // terminé, et le passage suivant continuera depuis la même borne.
      lastSuccessAt: pages.data.truncated ? state.lastSuccessAt : startedAt,
      historyDone: state.historyDone || !pages.data.truncated,
      status: "connected",
      lastError: "",
      lastRead: report.received,
      lastWritten: total,
    },
  });

  const truncatedNote = pages.data.truncated
    ? ` La reprise a été bornée à ${MAX_PAGES} pages : le prochain passage continuera.`
    : "";
  return {
    ok: true,
    status: "connected",
    message: `${report.received} activités lues, ${total} événements écrits, ${report.duplicates} déjà connus.${truncatedNote}`,
    report,
    fullHistory,
  };
}

/**
 * **Le chemin du webhook** : les mêmes activités, le même écrivain.
 *
 * Il n'avance pas `lastSuccessAt` — ce serait affirmer que tout l'intervalle a
 * été relu, alors qu'une notification ne parle que d'elle-même. Il note en
 * revanche que la connexion fonctionne, parce que recevoir un appel de lemlist
 * **est** une preuve de connexion.
 */
export async function applyWebhook(raws: readonly unknown[]): Promise<ApplyReport> {
  await syncRow();
  const report = await applyActivities(raws);
  const total = Object.values(report.written).reduce((sum, count) => sum + count, 0);
  await prisma.lemlistSync.update({
    where: { id: "singleton" },
    data: {
      lastAttemptAt: new Date(),
      lastRead: report.received,
      lastWritten: total,
      ...(hasLemlistKey() ? {} : { status: "missing_key" }),
    },
  });
  return report;
}

/* -------------------------------------------------------------- l'écran ------ */

export interface LemlistStatus {
  readonly status: string;
  readonly statusLabel: string;
  readonly lastSuccessAt: Date | null;
  readonly lastAttemptAt: Date | null;
  readonly lastError: string;
  readonly lastRead: number;
  readonly lastWritten: number;
  readonly historyDone: boolean;
  /** Événements importés depuis lemlist, par type du journal. */
  readonly byType: ReadonlyArray<{ readonly type: string; readonly count: number }>;
  readonly unmappedTypes: ReadonlyArray<{ readonly key: string; readonly detail: string; readonly seen: number }>;
  readonly ambiguous: ReadonlyArray<{ readonly key: string; readonly detail: string; readonly seen: number }>;
}

/** La table du domaine, relayée pour les appelants de ce module. */
export const STATUS_LABELS = LEMLIST_STATUS_LABELS;

/**
 * Ce que `/reglages` affiche.
 *
 * **La clé absente l'emporte sur l'état stocké.** Si quelqu'un retire la
 * variable du service, l'écran doit le dire tout de suite — pas au prochain
 * relevé. Lire `hasLemlistKey()` ici, et non la colonne, est ce qui fait que
 * l'écran parle de maintenant.
 */
export async function readLemlistStatus(): Promise<LemlistStatus> {
  const [state, grouped, issues] = await Promise.all([
    syncRow(),
    prisma.outreachEvent.groupBy({
      by: ["type"],
      where: { source: "lemlist" },
      _count: { _all: true },
    }),
    prisma.lemlistIssue.findMany({ orderBy: { seen: "desc" } }),
  ]);

  const status = hasLemlistKey() ? state.status : "missing_key";
  const lastError = hasLemlistKey()
    ? state.lastError
    : MISSING_KEY_MESSAGE;

  return {
    status,
    statusLabel: STATUS_LABELS[status] ?? STATUS_LABELS["unknown"] ?? "",
    lastSuccessAt: state.lastSuccessAt,
    lastAttemptAt: state.lastAttemptAt,
    lastError,
    lastRead: state.lastRead,
    lastWritten: state.lastWritten,
    historyDone: state.historyDone,
    byType: grouped
      .map((row) => ({ type: row.type, count: row._count._all }))
      .sort((a, b) => b.count - a.count),
    unmappedTypes: issues
      .filter((issue) => issue.kind === "unmapped_type")
      .map((issue) => ({ key: issue.key, detail: issue.detail, seen: issue.seen })),
    ambiguous: issues
      .filter((issue) => issue.kind === "ambiguous_match")
      .map((issue) => ({ key: issue.key, detail: issue.detail, seen: issue.seen })),
  };
}
