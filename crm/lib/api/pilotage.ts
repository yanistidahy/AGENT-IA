import "server-only";
import { z } from "zod";
import { prisma } from "../db";
import { readEventRows } from "./outreach-events";
import { readManualCounter, type ManualCounterState } from "./manual-events";
import { contactTitle } from "../domain/contact-identity";
import {
  DEFAULT_TARGETS,
  PERIOD_KEYS,
  customPeriod,
  parisMonth,
  parisWeek,
  type EventRow,
  type Period,
  type PeriodKey,
  type PilotageFilters,
  type WeeklyTargets,
} from "../domain/pilotage";
import { OUTREACH_CHANNELS } from "../domain/outreach";
import { isSizeBucket } from "../domain/size-buckets";
import { nicheSuggestions, type NicheSuggestion } from "../domain/company-profile";
import type { CampaignReport } from "../domain/campaigns-board";

/**
 * **Ce que l'écran reçoit : des lignes, des cibles, et de quoi remplir les
 * menus. Aucun chiffre.**
 *
 * Tous les nombres sont calculés par `lib/domain/pilotage.ts`, et
 * `tests/pilotage-source.test.ts` échoue si ce fichier ou un composant se met à
 * compter lui-même. La raison n'est pas l'élégance : c'est que le nombre
 * affiché et la liste qu'il ouvre doivent sortir du **même** appel, sans quoi
 * une pastille annonce 23 au-dessus d'une liste de 21 — l'écart payé aux jalons
 * 49, 78 et 105.
 */

const querySchema = z.object({
  periode: z.enum(PERIOD_KEYS).optional(),
  du: z.string().optional(),
  au: z.string().optional(),
  campagne: z.string().optional(),
  canal: z.string().optional(),
  proprietaire: z.string().optional(),
  /**
   * La tranche de taille. La barre ne la montre pas — le prototype ne la
   * demande pas —, mais elle existe pour que les liens de l'onglet
   * « Segments » puissent ouvrir la liste d'**une** tranche : un lien ne peut
   * porter qu'un filtre qui existe.
   */
  taille: z.string().optional(),
  niche: z.string().optional(),
  fonction: z.string().optional(),
  origine: z.string().optional(),
  /** Le mode de l'entonnoir : nombres ou pourcentages. */
  part: z.string().optional(),
});

export interface PilotageQuery {
  readonly periodKey: PeriodKey;
  readonly from: string;
  readonly to: string;
  readonly filters: PilotageFilters;
  readonly asShare: boolean;
}

export function parsePilotageQuery(
  params: Record<string, string | string[] | undefined> | URLSearchParams,
): PilotageQuery {
  const read = (key: string): string => {
    if (params instanceof URLSearchParams) return params.get(key) ?? "";
    const value = params[key];
    return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  };

  const parsed = querySchema.safeParse({
    periode: read("periode") === "" ? undefined : read("periode"),
    du: read("du"),
    au: read("au"),
    campagne: read("campagne"),
    canal: read("canal"),
    proprietaire: read("proprietaire"),
    taille: read("taille"),
    niche: read("niche"),
    fonction: read("fonction"),
    origine: read("origine"),
    part: read("part"),
  });

  const data = parsed.success ? parsed.data : {};
  const from = data.du ?? "";
  const to = data.au ?? "";
  // Une plage libre sans ses deux bornes retombe sur la semaine : un lien
  // vieilli doit ouvrir l'écran, pas une erreur (la règle du jalon 59).
  const key: PeriodKey = data.periode === "libre" && (from === "" || to === "") ? "semaine" : (data.periode ?? "semaine");

  return {
    periodKey: key,
    from,
    to,
    filters: {
      campaignId: data.campagne ?? "",
      channel: (OUTREACH_CHANNELS as readonly string[]).includes(data.canal ?? "")
        ? (data.canal ?? "")
        : "",
      owner: data.proprietaire ?? "",
      size: isSizeBucket(data.taille ?? "") ? (data.taille ?? "") : "",
      niche: data.niche ?? "",
      group: data.fonction ?? "",
      source: data.origine ?? "",
    },
    asShare: data.part === "1",
  };
}

export function periodOf(query: PilotageQuery, now: Date): Period {
  switch (query.periodKey) {
    case "semaine":
      return parisWeek(now, 0);
    case "semaine-1":
      return parisWeek(now, 1);
    case "mois":
      return parisMonth(now);
    case "libre":
      return customPeriod(new Date(`${query.from}T12:00:00Z`), new Date(`${query.to}T12:00:00Z`));
  }
}

export interface PilotageData {
  /** L'histoire entière : « nouvelle personne » et la qualification en ont besoin. */
  readonly rows: readonly EventRow[];
  readonly targets: WeeklyTargets;
  /**
   * Le menu des campagnes, **les deux outils réunis**. `id` y porte la clé de
   * `campaignKey` — préfixée `crm:` ou `lemlist:` — et non un identifiant brut :
   * le filtre compare ce que le regroupement produit, sinon choisir une
   * campagne dans le menu ne retiendrait rien.
   */
  readonly campaigns: readonly { readonly id: string; readonly name: string }[];
  readonly owners: readonly string[];
  /**
   * **Les niches du menu, lues sur les sociétés et non sur le journal.**
   *
   * Sur les sociétés, parce qu'une niche renseignée sur une marque qu'on n'a pas
   * encore contactée doit se proposer quand même : le menu sert aussi à poser la
   * valeur. Regroupées par clé pliée, et la variante proposée est la plus
   * fréquente — proposer « bijoux » à quelqu'un qui a toujours écrit « Bijoux »
   * le pousserait à créer la variante qu'on cherche à éviter.
   */
  readonly niches: readonly NicheSuggestion[];
  /** Les groupes de fonction réellement portés par le journal (jalon 94). */
  readonly groups: readonly string[];
  /** Les origines réellement portées par le journal : crm, lemlist, manual. */
  readonly sources: readonly string[];
  /**
   * Les campagnes du CRM archivées, en clés de `campaignKey`.
   *
   * C'est le seul cas où « terminée » est un fait et non une déduction sur un
   * silence : archiver est une décision humaine. Voir `boardState`.
   */
  readonly archivedCampaigns: readonly string[];
  /**
   * **Ce que la synchronisation a relevé des campagnes lemlist** (jalon 114) :
   * leur état publié, et combien de prospects attendent d'être lancés.
   *
   * Vide tant qu'aucun relevé n'a eu lieu, et l'onglet Campagnes retombe alors
   * sur ce qu'il savait déjà déduire d'un silence de trente jours. Une liste
   * vide n'est donc pas un écran cassé, c'est un écran moins précis — et il le
   * dit.
   */
  readonly reportedCampaigns: readonly CampaignReport[];
  /** Combien de sociétés n'ont pas de visiteurs mensuels, pour le dire à l'écran. */
  readonly companiesWithoutVisitors: number;
  /**
   * L'état du compteur manuel (jalon 112) : le décompte du jour et les vingt
   * dernières saisies.
   */
  readonly manual: ManualCounterState;
  /**
   * Les fiches, pour le sélecteur facultatif du compteur.
   *
   * Chargées avec la page plutôt que par un appel au premier focus : à
   * l'échelle de ce CRM c'est une projection de deux champs sur quelques
   * centaines de lignes, et une liste déjà là est une liste qui répond au
   * premier caractère tapé. À dix mille fiches il faudrait une recherche
   * serveur — c'est dit dans CLAUDE.md et le code ne prétend pas le contraire.
   */
  readonly contactOptions: readonly { readonly id: string; readonly label: string }[];
}

export async function readPilotage(): Promise<PilotageData> {
  const [
    rows,
    settings,
    crmCampaigns,
    lemlistCampaigns,
    owners,
    withoutVisitors,
    manual,
    niches,
    archived,
    lemlistCampaignRows,
    contacts,
  ] = await Promise.all([
    readEventRows(),
    prisma.settings.findUnique({
      where: { id: "singleton" },
      select: {
        cibleMessagesSemaine: true,
        cibleDemosSemaine: true,
        cibleQualifieesSemaine: true,
      },
    }),
    prisma.campaign.findMany({ orderBy: { nameKey: "asc" }, select: { id: true, name: true } }),
    /*
      Les campagnes lemlist n'ont pas de table : elles se lisent dans le
      journal. `groupBy` plutôt qu'un `distinct` sur deux colonnes, parce qu'une
      campagne renommée chez lemlist laisse deux noms pour un identifiant et que
      l'on veut alors le plus récent — d'où le `_max` sur la date.
    */
    prisma.outreachEvent.groupBy({
      by: ["extCampaignId", "extCampaignName"],
      where: { extCampaignId: { not: "" } },
      _max: { occurredAt: true },
    }),
    prisma.settingsList.findMany({
      where: { kind: "owners" },
      orderBy: { position: "asc" },
      select: { value: true },
    }),
    prisma.company.count({ where: { monthlyVisitors: null } }),
    readManualCounter(),
    prisma.company.findMany({ where: { niche: { not: "" } }, select: { niche: true } }),
    prisma.campaign.findMany({ where: { archivedAt: { not: null } }, select: { id: true } }),
    prisma.lemlistCampaign.findMany({
      select: { extId: true, status: true, leads: true, leadsLaunched: true },
    }),
    prisma.contact.findMany({
      orderBy: { nameKey: "asc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        instagram: true,
        company: { select: { name: true } },
      },
    }),
  ]);

  return {
    rows,
    targets: {
      messages: settings?.cibleMessagesSemaine ?? DEFAULT_TARGETS.messages,
      demos: settings?.cibleDemosSemaine ?? DEFAULT_TARGETS.demos,
      qualified: settings?.cibleQualifieesSemaine ?? DEFAULT_TARGETS.qualified,
    },
    campaigns: mergeCampaigns(crmCampaigns, lemlistCampaigns),
    /*
      **Les propriétaires du menu : la liste des réglages, plus ceux que le
      journal porte réellement.**

      La liste des réglages est le vocabulaire (celui des tâches, jalon 105) ;
      mais un événement peut porter un nom qui en a été retiré, ou qui n'y a
      jamais été ajouté. Ne proposer que la liste laisserait des lignes
      inatteignables par le filtre — un filtre qui ne peut pas atteindre une
      partie des données ment sur ce qu'il couvre.
    */
    owners: mergeOwners(
      owners.map((owner) => owner.value),
      rows.map((row) => row.owner),
    ),
    niches: nicheSuggestions(niches.map((row) => row.niche)),
    groups: distinct(rows.map((row) => row.group)),
    sources: distinct(rows.map((row) => row.source)),
    archivedCampaigns: archived.map((campaign) => `crm:${campaign.id}`),
    /*
      Le préfixe `lemlist:` est posé **ici**, une fois, parce que c'est la clé
      que `campaignKey` produit : comparer un identifiant brut à une clé
      préfixée ne rapprocherait jamais rien, et l'état relevé n'atteindrait
      aucune ligne du tableau sans qu'aucun test de type ne s'en plaigne.
    */
    reportedCampaigns: lemlistCampaignRows.map((row) => ({
      key: `lemlist:${row.extId}`,
      status: row.status,
      leads: row.leads,
      leadsLaunched: row.leadsLaunched,
    })),
    companiesWithoutVisitors: withoutVisitors,
    manual,
    /*
      Le libellé vient de `contactTitle`, la seule fonction qui décide comment
      une fiche s'appelle (jalon 50 : une fiche de marque n'a personne de
      nommé). Recomposer « prénom nom » ici rendrait le sélecteur muet sur ces
      fiches-là, qui sont justement celles qu'on contacte en DM.
    */
    contactOptions: contacts.map((contact) => ({
      id: contact.id,
      label: contactTitle(contact),
    })),
  };
}

/** Les valeurs non vides, dédoublonnées, triées : pour un menu. */
function distinct(values: readonly string[]): string[] {
  return [...new Set(values)].filter((value) => value !== "").sort((a, b) => a.localeCompare(b, "fr"));
}

/** La liste des réglages d'abord, puis les noms du journal qu'elle ignore. */
function mergeOwners(listed: readonly string[], seen: readonly string[]): string[] {
  const out: string[] = [];
  for (const name of listed) if (name !== "" && !out.includes(name)) out.push(name);
  const extra = [...new Set(seen)].filter((name) => name !== "" && !out.includes(name)).sort();
  return [...out, ...extra];
}

/**
 * **Les campagnes des deux outils, dans un seul menu.**
 *
 * Les clés sont celles de `campaignKey` : `crm:<id>` et `lemlist:<id>`. Les
 * préfixer n'est pas une coquetterie — les deux outils ont leur propre espace
 * de noms, et une collision rangerait deux campagnes différentes sous la même
 * entrée. Le libellé d'une campagne lemlist dit son outil, pour que deux
 * campagnes homonymes ne soient pas indiscernables dans la liste déroulante.
 */
function mergeCampaigns(
  crm: readonly { readonly id: string; readonly name: string }[],
  lemlist: readonly {
    readonly extCampaignId: string;
    readonly extCampaignName: string;
    readonly _max: { readonly occurredAt: Date | null };
  }[],
): { readonly id: string; readonly name: string }[] {
  const out = crm.map((campaign) => ({
    id: `crm:${campaign.id}`,
    name: campaign.name === "" ? "Campagne sans nom" : campaign.name,
  }));

  // Un identifiant lemlist renommé apparaît deux fois dans le regroupement :
  // on garde le nom du fait le plus récent, qui est le nom actuel.
  const latest = new Map<string, { name: string; at: number }>();
  for (const row of lemlist) {
    const at = row._max.occurredAt?.getTime() ?? 0;
    const known = latest.get(row.extCampaignId);
    if (known === undefined || at >= known.at) {
      latest.set(row.extCampaignId, { name: row.extCampaignName, at });
    }
  }

  const imported = [...latest.entries()]
    .map(([id, value]) => ({
      id: `lemlist:${id}`,
      name: `${value.name === "" ? "Campagne lemlist sans nom" : value.name} (lemlist)`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return [...out, ...imported];
}
