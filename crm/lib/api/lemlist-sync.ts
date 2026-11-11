import "server-only";
import { prisma } from "../db";
import { searchText } from "../domain/text";
import { companyNameKey, contactNameKey } from "./name-keys";
import { normalizeCompanyName } from "./company-resolve";
import { groupOfTitle } from "../domain/contact-group";
import { syncMayWrite } from "../domain/company-profile";
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
import {
  fetchCampaignStats,
  hasLemlistKey,
  readActivityPages,
  readCampaignPages,
  type LemlistError,
} from "./lemlist-client";

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

/* ------------------------------------------------------- la réparation ----- */

/**
 * **Une ligne déjà importée se corrige, elle ne se duplique pas.**
 *
 * La date d'un événement est celle de l'activité chez lemlist, et elle l'a
 * toujours été : `readLemlistActivity` lit `createdAt` et **refuse l'activité**
 * si cette date est illisible, plutôt que de retomber sur l'instant de
 * l'import. Il n'y a donc jamais eu de chemin qui datait un événement de sa
 * synchronisation — le jalon 113 l'a vérifié ligne à ligne.
 *
 * Reste qu'une ligne en base peut porter une date fausse pour trois raisons qui
 * n'ont rien à voir avec notre code : lemlist corrige l'horodatage d'une
 * activité, une ligne a été écrite à la main (une recette, une reprise), ou une
 * version future de ce module s'est trompée. Dans ces trois cas, **le passage
 * suivant doit réparer** au lieu de regarder ailleurs : sans cela une ligne
 * fausse est définitive, puisque la contrainte d'unicité empêche de la
 * réécrire.
 *
 * On ne corrige que ce que lemlist fait autorité sur : l'instant du fait, le nom
 * de la campagne (qui se renomme) et **l'étape de séquence**. On ne touche **ni
 * le contact ni le type** : un rapprochement tranché à la main ne doit pas être
 * défait par une synchronisation, et un type qui changerait déplacerait un fait
 * d'un indicateur à un autre sans que personne l'ait demandé.
 *
 * ## L'étape se remplit à la resynchronisation, et c'est tout l'intérêt
 *
 * Les colonnes `stepIndex` / `stepType` sont arrivées au jalon 113 v2 : toutes
 * les lignes importées **avant** sont à `null`. Sans réparation, l'onglet
 * Campagnes afficherait « hors séquence » sur tout l'historique, pour
 * l'éternité — la contrainte d'unicité empêche de réécrire la ligne. Le passage
 * suivant les remplit donc, et c'est ce que le brief appelle « backfillé à la
 * prochaine synchronisation ».
 *
 * **On ne remplace jamais une étape connue par du vide.** Un `null` chez lemlist
 * veut dire « cette activité n'est pas née d'une étape », pas « oublie ce que tu
 * savais » : effacer sur un payload plus pauvre perdrait de l'information sans
 * que rien ne le signale.
 *
 * Rend `true` quand quelque chose a réellement changé — un `update`
 * inconditionnel compterait une réparation à chaque passage sur chaque ligne.
 */
async function repairEvent(activity: LemlistActivity): Promise<boolean> {
  const known = await prisma.outreachEvent.findUnique({
    where: { source_externalId: { source: "lemlist", externalId: activity.externalId } },
    select: { id: true, occurredAt: true, extCampaignName: true, stepIndex: true, stepType: true },
  });
  if (known === null) return false;

  const patch: {
    occurredAt?: Date;
    extCampaignName?: string;
    stepIndex?: number;
    stepType?: string;
  } = {};
  if (known.occurredAt.getTime() !== activity.occurredAt.getTime()) {
    patch.occurredAt = activity.occurredAt;
  }
  if (activity.campaignName !== "" && known.extCampaignName !== activity.campaignName) {
    patch.extCampaignName = activity.campaignName;
  }
  if (activity.stepIndex !== null && known.stepIndex !== activity.stepIndex) {
    patch.stepIndex = activity.stepIndex;
  }
  if (activity.stepType !== "" && known.stepType !== activity.stepType) {
    patch.stepType = activity.stepType;
  }
  if (Object.keys(patch).length === 0) return false;

  await prisma.outreachEvent.update({ where: { id: known.id }, data: patch });
  return true;
}

/* --------------------------------------------- l'état des campagnes ---------- */

/** Le nombre de pages de campagnes : 100 par page, donc 5 000 campagnes. */
const CAMPAIGN_PAGES = 50;

/**
 * La fenêtre demandée aux statistiques de campagne.
 *
 * `startDate` et `endDate` sont **obligatoires** sur cette route : les omettre
 * est un 400, pas un défaut « depuis toujours ». On la prend donc très large,
 * parce que ce qu'on cherche n'est pas une mesure de période mais un **état
 * courant** : combien de prospects la campagne contient, combien ont été
 * lancés. Une fenêtre étroite rendrait « 0 prospect en attente » sur une
 * campagne pleine simplement parce qu'elle dort depuis un mois.
 */
const STATS_WINDOW_YEARS = 10;

/**
 * **L'état des campagnes lemlist, relevé après les activités.**
 *
 * Deux appels de plus par passage, et ils répondent à deux questions que les
 * activités ne peuvent pas trancher :
 *
 * 1. **l'état** — `GET /campaigns` le dit (`running`, `paused`, `ended`…), là
 *    où l'écran le déduisait d'un silence de trente jours. Une campagne arrêtée
 *    pour de bon et une campagne simplement muette se lisaient pareil ;
 * 2. **les prospects en attente** — `nbLeads − nbLeadsLaunched`. Un événement
 *    ne parle que de ce qui est **parti** ; par construction, il ne peut rien
 *    dire de ce qui attend.
 *
 * **Bornes assumées.** On ne demande les statistiques que des campagnes que le
 * journal connaît déjà *ou* qui ne sont pas en cours : une campagne active de
 * mille prospects nous intéresse moins que celle qui dort avec trois personnes
 * en attente, et un appel par campagne sur un compte qui en a trois cents
 * consommerait trente secondes de limite de débit à chaque relevé. Le plafond
 * `STATS_BUDGET` dit la borne, et un relevé qui l'atteint le laisse dire par
 * son rapport plutôt que de la franchir en silence.
 *
 * **Un échec ici ne fait pas échouer le relevé.** Les activités sont déjà
 * écrites à ce stade, et elles sont l'essentiel ; perdre l'état des campagnes
 * coûte une puce moins précise, pas un fait. L'erreur est donc comptée et dite,
 * pas levée.
 */
const STATS_BUDGET = 40;

export interface CampaignRefresh {
  readonly seen: number;
  readonly withStats: number;
  readonly skipped: number;
  readonly error: string;
}

async function refreshCampaigns(now: Date): Promise<CampaignRefresh> {
  const pages = await readCampaignPages(CAMPAIGN_PAGES);
  if (!pages.ok) {
    return { seen: 0, withStats: 0, skipped: 0, error: pages.error.message };
  }

  const rows = pages.data;
  /*
    Les campagnes que le journal a déjà vues passer : ce sont celles que l'écran
    affiche, donc les seules dont l'état change quelque chose à ce qui est lu.
  */
  const known = new Set(
    (
      await prisma.outreachEvent.findMany({
        where: { extCampaignId: { not: "" } },
        distinct: ["extCampaignId"],
        select: { extCampaignId: true },
      })
    ).map((row) => row.extCampaignId),
  );

  const from = new Date(now.getTime() - STATS_WINDOW_YEARS * 365 * 86_400_000);
  let withStats = 0;
  let skipped = 0;
  let error = "";

  for (const row of rows) {
    /*
      **L'état est écrit pour toutes les campagnes, les statistiques pour
      quelques-unes.** Écrire l'état coûte zéro appel — il est déjà dans la
      réponse ; demander les statistiques coûte un appel par campagne.
    */
    let stats: { leads: number; leadsLaunched: number } | null = null;
    const wanted = known.has(row.extId) || row.status === "paused";
    if (wanted && withStats < STATS_BUDGET) {
      const outcome = await fetchCampaignStats(row.extId, from, now);
      if (outcome.ok) {
        stats = outcome.data;
        withStats += 1;
      } else if (error === "") {
        error = outcome.error.message;
      }
    } else if (wanted) {
      skipped += 1;
    }

    await prisma.lemlistCampaign.upsert({
      where: { extId: row.extId },
      create: {
        extId: row.extId,
        name: row.name,
        status: row.status,
        leads: stats?.leads ?? null,
        leadsLaunched: stats?.leadsLaunched ?? null,
        syncedAt: now,
      },
      /*
        **On n'écrase pas un compte connu par du vide.** Une campagne dont les
        statistiques n'ont pas été redemandées à ce passage garde celles du
        précédent : afficher « pas encore relevé » là où l'on savait hier serait
        une régression silencieuse de ce que l'écran peut dire.
      */
      update: {
        name: row.name,
        status: row.status,
        ...(stats === null ? {} : { leads: stats.leads, leadsLaunched: stats.leadsLaunched }),
        syncedAt: now,
      },
    });
  }

  return { seen: rows.length, withStats, skipped, error };
}

/* ------------------------------------------------- le profil de la marque ---- */

/**
 * **La niche et le trafic d'une marque, remplis sans jamais écraser la main.**
 *
 * Les deux arrivent dans les variables personnalisées du lead. Le relevé tourne
 * toutes les quinze minutes : sans la règle qui suit, une correction tapée dans
 * le CRM à 10 h 02 serait remplacée à 10 h 15 par la valeur fausse de lemlist,
 * sans trace et sans message. La personne recommencerait, puis cesserait de
 * corriger — c'est-à-dire que le champ cesserait de valoir quelque chose.
 *
 * `syncMayWrite` tranche champ par champ, sur la colonne de provenance : on
 * écrit si le champ est vide, ou s'il porte déjà une valeur que **cette**
 * synchronisation a posée (lemlist en est alors la source de vérité et un
 * trafic de l'an dernier n'a pas à être figé). On n'écrit pas sur une valeur du
 * CRM, ni sur une valeur d'origine inconnue : devant une provenance qu'on
 * ignore, écraser est le geste irréversible.
 *
 * Rend `true` quand quelque chose a réellement changé — un `update`
 * inconditionnel compterait un remplissage à chaque passage sur chaque ligne.
 */
async function fillCompanyProfile(
  companyId: string | null,
  activity: LemlistActivity,
): Promise<boolean> {
  if (companyId === null) return false;
  if (activity.niche === "" && activity.visitors === null) return false;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { niche: true, nicheSource: true, monthlyVisitors: true, visitorsSource: true },
  });
  if (company === null) return false;

  const patch: {
    niche?: string;
    nicheSource?: string;
    monthlyVisitors?: number;
    visitorsSource?: string;
  } = {};

  if (
    activity.niche !== "" &&
    activity.niche !== company.niche &&
    syncMayWrite({ filled: company.niche.trim() !== "", source: company.nicheSource })
  ) {
    patch.niche = activity.niche;
    patch.nicheSource = "lemlist";
  }

  if (
    activity.visitors !== null &&
    activity.visitors !== company.monthlyVisitors &&
    syncMayWrite({ filled: company.monthlyVisitors !== null, source: company.visitorsSource })
  ) {
    patch.monthlyVisitors = activity.visitors;
    patch.visitorsSource = "lemlist";
  }

  if (Object.keys(patch).length === 0) return false;
  await prisma.company.update({ where: { id: companyId }, data: patch });
  return true;
}

/* --------------------------------------------------------- l'application ----- */

export interface ApplyReport {
  /** Charges utiles reçues. */
  readonly received: number;
  /** Charges utiles illisibles — sans identifiant, sans type ou sans date. */
  readonly unreadable: number;
  /** Déjà en base : la contrainte d'unicité a fait son travail. */
  readonly duplicates: number;
  /**
   * Déjà en base, **et corrigé** : la date ou le nom de campagne que lemlist
   * rend maintenant ne sont plus ceux qu'on avait écrits. Voir `repairEvent`.
   */
  readonly repaired: number;
  /** Laissées de côté, faute de savoir à qui les attribuer. */
  readonly ambiguous: number;
  readonly contactsCreated: number;
  readonly companiesCreated: number;
  /** Écrits, par type du journal. */
  readonly written: Readonly<Record<string, number>>;
  /** Les types lemlist rangés dans `other`, avec leur compte. */
  readonly unmapped: Readonly<Record<string, number>>;
  /**
   * Marques dont la niche ou le trafic viennent d'être remplis par ce passage.
   * Une valeur tapée dans le CRM n'y entre jamais — voir `fillCompanyProfile`.
   */
  readonly profilesFilled: number;
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
  let repaired = 0;
  let ambiguous = 0;
  let contactsCreated = 0;
  let companiesCreated = 0;
  let profilesFilled = 0;
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
      stepIndex: activity.stepIndex,
      stepType: activity.stepType,
      detail: mapping.detail,
    });

    if (created) {
      bump(written, mapping.type);
    } else {
      duplicates += 1;
      if (await repairEvent(activity)) repaired += 1;
    }

    // Le profil de la marque, **après** l'événement : la niche et le trafic
    // n'ont de sens que sur une société, et la société peut venir d'être créée
    // juste au-dessus.
    if (await fillCompanyProfile(companyId, activity)) profilesFilled += 1;

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
    repaired,
    ambiguous,
    contactsCreated,
    companiesCreated,
    written,
    unmapped,
    profilesFilled,
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

  /*
    **L'état des campagnes se relève après les activités, et son échec ne fait
    pas échouer le relevé.** Les activités sont déjà écrites à ce stade et elles
    sont l'essentiel ; perdre l'état d'une campagne coûte une puce moins précise,
    pas un fait. Le rapport le dit plutôt que de le taire.
  */
  const campaigns = await refreshCampaigns(startedAt);

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
  /*
    L'état des campagnes est dit, y compris quand il a échoué : sans cette
    phrase, « la puce d'état vient de lemlist » resterait une promesse du code,
    et une puce déduite d'un silence ressemblerait à une puce relevée.
  */
  const campaignNote =
    campaigns.error !== ""
      ? ` L'état des campagnes n'a pas pu être relu : ${campaigns.error}`
      : campaigns.seen === 0
        ? ""
        : ` ${campaigns.seen} campagne${campaigns.seen > 1 ? "s" : ""} relue${campaigns.seen > 1 ? "s" : ""}, dont ${campaigns.withStats} avec leurs prospects en attente${campaigns.skipped > 0 ? ` (${campaigns.skipped} au-delà du plafond de ce passage)` : ""}.`;
  return {
    ok: true,
    status: "connected",
    /*
      **Le remplissage des profils est dit, pas seulement compté.**

      Sans cette phrase, « la niche se remplit depuis lemlist » resterait une
      promesse du code : on ne voit pas une colonne qui s'est remplie, et encore
      moins une qui ne s'est pas remplie parce qu'aucun lead ne porte la
      variable. Le compte est aussi ce qui dira, au premier relevé réel, si les
      variables s'appellent bien `niche` et `visiteurs` chez nous.
    */
    message: `${report.received} activités lues, ${total} événements écrits, ${report.duplicates} déjà connus${
      report.repaired > 0 ? `, dont ${report.repaired} dont la date a été corrigée` : ""
    }${
      report.profilesFilled > 0
        ? `. Niche ou trafic renseignés sur ${report.profilesFilled} marque${report.profilesFilled > 1 ? "s" : ""} (une valeur saisie dans le CRM n'est jamais écrasée)`
        : ""
    }.${campaignNote}${truncatedNote}`,
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
