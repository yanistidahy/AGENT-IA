import "server-only";
import { z } from "zod";
import { prisma } from "../db";
import { readEventRows } from "./outreach-events";
import {
  DEFAULT_TARGETS,
  customPeriod,
  parisMonth,
  parisWeek,
  type EventRow,
  type Period,
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

export const PERIOD_KEYS = ["semaine", "semaine-1", "mois", "libre"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  semaine: "Cette semaine",
  "semaine-1": "La semaine dernière",
  mois: "Ce mois",
  libre: "Période choisie",
};

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
  readonly campaigns: readonly { readonly id: string; readonly name: string }[];
  readonly owners: readonly string[];
  /** Combien de sociétés n'ont pas de visiteurs mensuels, pour le dire à l'écran. */
  readonly companiesWithoutVisitors: number;
}

export async function readPilotage(): Promise<PilotageData> {
  const [rows, settings, campaigns, owners, withoutVisitors] = await Promise.all([
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
    campaigns,
    owners: owners.map((owner) => owner.value),
    companiesWithoutVisitors: withoutVisitors,
  };
}
