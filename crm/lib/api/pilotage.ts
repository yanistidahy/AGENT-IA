import "server-only";
import { z } from "zod";
import { prisma } from "../db";
import { readEventRows } from "./outreach-events";
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
  segment: z.string().optional(),
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
    segment: read("segment"),
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
      segment: data.segment ?? "",
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
  /** Combien de sociétés n'ont pas de visiteurs mensuels, pour le dire à l'écran. */
  readonly companiesWithoutVisitors: number;
}

export async function readPilotage(): Promise<PilotageData> {
  const [rows, settings, crmCampaigns, lemlistCampaigns, owners, withoutVisitors] = await Promise.all([
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
    companiesWithoutVisitors: withoutVisitors,
  };
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
