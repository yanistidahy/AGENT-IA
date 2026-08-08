import { daysSince, startOfDay } from "./dates";
import type { PilotageSettings } from "./types";

/**
 * Statut de relance d'un contact.
 *
 * Entièrement dérivé des données déjà saisies — aucun champ manuel à tenir à
 * jour, donc rien qui puisse mentir parce que quelqu'un a oublié de le changer.
 *
 * Le seuil « sans nouvelles » est `coldDays`, la même valeur que celle qui
 * pilote la chaleur des affaires et les alertes : la régler dans Réglages
 * déplace les trois d'un coup.
 */
export const FOLLOW_UP_STATUSES = [
  "never",
  "due",
  "planned",
  "waiting",
  "silent",
] as const;
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number];

export interface FollowUpLike {
  readonly lastContact: Date | null;
  readonly nextReminder: Date | null;
  /** Interactions consignées. Un import peut donner `lastContact` sans aucune. */
  readonly activityCount: number;
}

/**
 * L'ordre des tests est celui du tableau de spécification, et il compte.
 *
 * « Jamais contacté » est évalué en premier : un contact qu'on n'a jamais
 * touché reste « jamais contacté » même si une relance est programmée pour
 * aujourd'hui. C'est l'écriture littérale de la règle demandée ; si l'usage
 * montre qu'une relance due doit primer, il suffit d'intervertir les deux
 * premières branches.
 */
export function followUpStatus(
  contact: FollowUpLike,
  settings: PilotageSettings,
  now: Date,
): FollowUpStatus {
  if (contact.lastContact === null && contact.activityCount === 0) return "never";

  if (contact.nextReminder !== null) {
    // Comparaison au jour, pas à l'heure : une relance datée d'aujourd'hui est
    // due dès le matin, pas seulement passé l'heure exacte de sa création.
    return daysSince(startOfDay(contact.nextReminder), startOfDay(now)) >= 0
      ? "due"
      : "planned";
  }

  if (contact.lastContact === null) return "waiting";
  return daysSince(contact.lastContact, now) >= settings.coldDays ? "silent" : "waiting";
}

/** Jours écoulés depuis la dernière touche, `null` si elle n'a jamais eu lieu. */
export function idleDays(contact: FollowUpLike, now: Date): number | null {
  return contact.lastContact === null ? null : daysSince(contact.lastContact, now);
}

/**
 * Ordre de tri : du plus urgent au moins urgent. C'est l'ordre dans lequel on
 * veut voir sa liste d'appels, pas l'ordre alphabétique des libellés.
 */
const RANK: Record<FollowUpStatus, number> = {
  due: 0,
  silent: 1,
  never: 2,
  waiting: 3,
  planned: 4,
};

export function followUpRank(status: FollowUpStatus): number {
  return RANK[status];
}

export const FOLLOW_UP_LABELS: Record<FollowUpStatus, string> = {
  never: "Jamais contacté",
  due: "À relancer",
  planned: "Relance prévue",
  waiting: "En attente",
  silent: "Sans nouvelles",
};

/** Filtres proposés au-dessus du tableau des contacts. */
export const FOLLOW_UP_FILTERS = ["due", "silent", "never"] as const;
export type FollowUpFilter = (typeof FOLLOW_UP_FILTERS)[number];

export function isFollowUpFilter(value: string): value is FollowUpFilter {
  return FOLLOW_UP_FILTERS.some((candidate) => candidate === value);
}
