import type { FilterState } from "../domain/column-filters";
import { facetsFor, matchesAll, type FacetValue } from "../domain/column-match";
import { CLIENT_FACET_COLUMNS } from "./client-columns";
import { prisma } from "../db";
import { REAL_ACTIVITY } from "./real-activity";
import {
  followUpRank,
  followUpStatus,
  idleDays as computeIdleDays,
  type FollowUpStatus,
} from "../domain/follow-up";
import { toDealStatus, toLifecycle } from "../domain/guards";
import { DEFAULT_PILOTAGE, type Lifecycle, type PilotageSettings } from "../domain/types";

/**
 * Portefeuille clients.
 *
 * Répond à trois questions : qui me paie, combien, et à quand remonte la
 * dernière conversation. Seuls les contacts au cycle de vie « Client » y
 * figurent — les anciens clients relèvent de la rétention, pas du portefeuille.
 *
 * Le chiffre d'affaires est celui des affaires **gagnées** rattachées au
 * contact. Une affaire rattachée à la seule société, sans contact, n'y est donc
 * pas comptée : le portefeuille dit ce que cette personne a signé, pas ce que sa
 * société pèse. La fiche société porte l'autre lecture.
 */
export interface ClientRow {
  /** Statut saisi, pour que la pastille résolve comme sur /contacts. */
  readonly status: string;
  /**
   * Le cycle de vie voyage jusqu'à la ligne, sans quoi la règle terminale ne
   * peut pas s'y appliquer. La vue ne lit aujourd'hui que des « Client », mais
   * une pastille qui dépend du périmètre de la requête est une pastille juste
   * par accident : le jour où le portefeuille inclurait les anciens clients,
   * elle recommencerait à mentir sans que rien ne bouge dans le composant.
   */
  readonly lifecycle: Lifecycle;
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly companyName: string | null;
  readonly owner: string;
  readonly wonValue: number;
  readonly openValue: number;
  readonly wonCount: number;
  /** Date de la première affaire gagnée — l'entrée au portefeuille. */
  readonly signedAt: Date | null;
  readonly lastContact: Date | null;
  readonly idleDays: number | null;
  readonly nextReminder: Date | null;
  readonly followUp: FollowUpStatus;
}

export const CLIENT_SORT_KEYS = [
  "revenue",
  "name",
  "lastContact",
  "signedAt",
  "followUp",
] as const;
export type ClientSort = (typeof CLIENT_SORT_KEYS)[number];

export function toClientSort(value: string | undefined): ClientSort {
  return CLIENT_SORT_KEYS.find((candidate) => candidate === value) ?? "revenue";
}

export interface ClientPortfolio {
  readonly clients: readonly ClientRow[];
  /** Nombre de clients avant filtres de colonne, pour le « 3 sur 12 ». */
  readonly total: number;
  readonly facets: Readonly<Record<string, readonly FacetValue[]>>;
  readonly totalRevenue: number;
  readonly averageRevenue: number;
}

export async function readClients(
  sort: ClientSort = "revenue",
  settings: PilotageSettings = DEFAULT_PILOTAGE,
  now: Date = new Date(),
  filters: FilterState = {},
): Promise<ClientPortfolio> {
  const rows = await prisma.contact.findMany({
    where: { lifecycle: "Client" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      owner: true,
      lastContact: true,
      nextReminder: true,
      company: { select: { name: true } },
      deals: { select: { amount: true, status: true, closedAt: true } },
      status: true,
      lifecycle: true,
      _count: { select: { activities: { where: REAL_ACTIVITY } } },
    },
  });

  const clients: ClientRow[] = rows.map((row) => {
    const deals = row.deals.map((deal) => ({ ...deal, status: toDealStatus(deal.status) }));
    const won = deals.filter((deal) => deal.status === "won");
    const closedDates = won
      .map((deal) => deal.closedAt)
      .filter((date): date is Date => date !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    const followUpInput = {
      lastContact: row.lastContact,
      nextReminder: row.nextReminder,
      activityCount: row._count.activities,
    };

    return {
      status: row.status,
      lifecycle: toLifecycle(row.lifecycle),
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      companyName: row.company?.name ?? null,
      owner: row.owner,
      wonValue: won.reduce((total, deal) => total + deal.amount, 0),
      openValue: deals
        .filter((deal) => deal.status === "open")
        .reduce((total, deal) => total + deal.amount, 0),
      wonCount: won.length,
      signedAt: closedDates[0] ?? null,
      lastContact: row.lastContact,
      idleDays: computeIdleDays(followUpInput, now),
      nextReminder: row.nextReminder,
      followUp: followUpStatus(followUpInput, settings, now),
    };
  });

  // Les filtres de colonne s'appliquent avant les totaux : « 3 sur 12 » doit
  // s'accompagner du chiffre d'affaires de ces trois-là, pas des douze.
  const kept =
    Object.keys(filters).length === 0
      ? clients
      : clients.filter((client) => matchesAll(client, CLIENT_FACET_COLUMNS, filters, now));

  const sorted = sortClients(kept, sort);
  const totalRevenue = kept.reduce((total, client) => total + client.wonValue, 0);

  return {
    clients: sorted,
    total: clients.length,
    facets: facetsFor(clients, CLIENT_FACET_COLUMNS, filters, now),
    totalRevenue,
    // Moyenne sur le nombre de clients, pas sur ceux qui ont signé : un client
    // à zéro euro pèse dans la moyenne, c'est précisément ce qu'elle doit dire.
    averageRevenue: kept.length === 0 ? 0 : Math.round(totalRevenue / kept.length),
  };
}

/** Les plus gros clients d'abord : c'est la lecture par défaut d'un portefeuille. */
function sortClients(clients: readonly ClientRow[], sort: ClientSort): ClientRow[] {
  const copy = [...clients];

  switch (sort) {
    case "name":
      return copy.sort((a, b) => a.lastName.localeCompare(b.lastName));
    case "lastContact":
      // Le plus ancien contact en tête : c'est celui qu'on risque de perdre.
      return copy.sort(
        (a, b) =>
          (b.idleDays ?? Number.MAX_SAFE_INTEGER) - (a.idleDays ?? Number.MAX_SAFE_INTEGER),
      );
    case "signedAt":
      return copy.sort(
        (a, b) => (b.signedAt?.getTime() ?? 0) - (a.signedAt?.getTime() ?? 0),
      );
    case "followUp":
      return copy.sort(
        (a, b) => followUpRank(a.followUp) - followUpRank(b.followUp) || b.wonValue - a.wonValue,
      );
    default:
      return copy.sort((a, b) => b.wonValue - a.wonValue);
  }
}
