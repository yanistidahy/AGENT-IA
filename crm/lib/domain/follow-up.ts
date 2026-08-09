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

/**
 * Ce contact réclame-t-il une action ?
 *
 * **Source unique de la couleur d'alerte** dans toutes les vues : liste des
 * contacts, « dernière touche » du centre de pilotage, portefeuille clients.
 * Avant, chacune recalculait `joursÉcoulés >= coldDays` de son côté — et une
 * fiche silencieuse depuis trente jours mais dont la relance est déjà programmée
 * s'affichait « Relance prévue » en bleu dans une colonne et en rouge dans la
 * suivante, sur la même ligne. Une relance planifiée n'est pas un problème :
 * seuls `due` et `silent` en sont.
 */
export function needsAttention(status: FollowUpStatus): boolean {
  return status === "due" || status === "silent";
}

/**
 * Formulation de la règle de chaque filtre, pour les états vides.
 *
 * Une liste vide doit dire *pourquoi* elle est vide, sinon on ne sait pas si la
 * donnée manque ou si le filtre ne correspond à rien.
 */
export function emptyFilterMessage(filter: ContactFilter, settings: PilotageSettings): string {
  switch (filter) {
    case "reminder":
      return "Aucun contact n'a de relance programmée — ni en retard, ni aujourd'hui, ni à venir. Renseignez « Prochaine relance » sur une fiche, ou consignez une interaction avec une prochaine action.";
    case "silent":
      return `Aucun contact sans nouvelles : tous ont été touchés il y a moins de ${settings.coldDays} jours, ou portent déjà une relance programmée. Le seuil se règle dans Réglages.`;
    case "never":
      return "Aucun contact « jamais contacté » : tous ont au moins une interaction consignée ou une date de dernier contact.";
    case "stale-status":
      return "Aucun statut figé : partout où un statut a été saisi, il est postérieur à la dernière interaction. C'est le signe que le statut est bien rafraîchi en consignant les échanges.";
    case "contacted":
      return "Aucun contact n'a d'interaction consignée. C'est le haut de l'entonnoir : tout le portefeuille reste à approcher.";
    case "recent":
      return "Aucun contact touché depuis sept jours. La semaine n'a pas encore commencé côté prospection.";
    case "answered":
      return "Aucun échange n'a d'issue renseignée. Consignez le résultat de vos appels — c'est ce qui rend le taux de réponse calculable.";
  }
}

export const FOLLOW_UP_LABELS: Record<FollowUpStatus, string> = {
  never: "Jamais contacté",
  due: "À relancer",
  planned: "Relance prévue",
  waiting: "En attente",
  silent: "Sans nouvelles",
};

/**
 * Filtres proposés au-dessus du tableau des contacts.
 *
 * **Un filtre n'est pas un statut**, et `reminder` est précisément le cas où les
 * deux divergent : la puce « À relancer » retient *tout contact ayant une
 * relance programmée* — en retard, aujourd'hui ou à venir — là où le statut
 * `due` ne désigne que les échéances atteintes. C'est voulu : la puce sert à
 * voir tout son pipeline de relances d'un coup, la colonne Statut à situer une
 * ligne. Les deux noms sont donc distincts dans le code, pour qu'aucun des deux
 * ne mente sur ce qu'il fait.
 */
export const CONTACT_FILTERS = [
  "reminder",
  "silent",
  "never",
  "stale-status",
  /**
   * Les trois bandes de l'entonnoir de l'accueil. Elles ne décrivent pas un
   * statut de relance mais un fait d'historique — a-t-on parlé à cette
   * personne, récemment, et a-t-elle répondu — et se calculent donc en SQL, sur
   * les interactions, plutôt qu'en mémoire sur des dates dérivées. Elles
   * existent pour que chaque bande du dessin mène quelque part : une bande qui
   * ne s'ouvre pas est une décoration.
   */
  "contacted",
  "recent",
  "answered",
] as const;
export type ContactFilter = (typeof CONTACT_FILTERS)[number];

export function isContactFilter(value: string): value is ContactFilter {
  return CONTACT_FILTERS.some((candidate) => candidate === value);
}

export const CONTACT_FILTER_LABELS: Record<ContactFilter, string> = {
  reminder: "À relancer",
  silent: FOLLOW_UP_LABELS.silent,
  never: FOLLOW_UP_LABELS.never,
  "stale-status": "Statut figé",
  contacted: "Déjà contactés",
  recent: "Contactés cette semaine",
  answered: "Ont répondu",
};

/**
 * Filtres qui ne se décident pas sur une fiche isolée.
 *
 * Ils portent sur les interactions liées, que `FollowUpLike` ne contient pas :
 * les appliquer ici demanderait de charger l'historique de chaque contact pour
 * répondre à une question que SQL répond en une clause. Ils sont donc traités
 * par l'appelant — voir `contactsWhere` dans lib/api/contacts.ts.
 */
const SQL_ONLY_FILTERS: readonly ContactFilter[] = [
  "stale-status",
  "contacted",
  "recent",
  "answered",
];

export function appliedInSql(filter: ContactFilter): boolean {
  return SQL_ONLY_FILTERS.includes(filter);
}

/** Un contact passe-t-il le filtre ? Le statut n'intervient que pour deux d'entre eux. */
export function matchesContactFilter(
  contact: FollowUpLike,
  filter: ContactFilter,
  settings: PilotageSettings,
  now: Date,
): boolean {
  if (filter === "reminder") return contact.nextReminder !== null;
  // Déjà tranché ailleurs : répondre « faux » ici viderait la liste.
  if (appliedInSql(filter)) return true;
  return followUpStatus(contact, settings, now) === filter;
}

/**
 * Lecture d'une échéance de relance, pour la hiérarchie visuelle de la liste.
 *
 * `days` est positif quand l'échéance est passée — même convention que
 * `daysSince` dans tout le projet. La comparaison se fait au jour, pas à
 * l'heure : une relance datée d'aujourd'hui est « aujourd'hui » dès le matin.
 */
export type ReminderUrgency = "late" | "today" | "future";

export interface ReminderView {
  readonly urgency: ReminderUrgency;
  readonly days: number;
  readonly label: string;
}

export function describeReminder(reminder: Date, now: Date): ReminderView {
  const days = daysSince(startOfDay(reminder), startOfDay(now));

  if (days > 0) return { urgency: "late", days, label: `${days} j de retard` };
  if (days === 0) return { urgency: "today", days: 0, label: "aujourd'hui" };
  return { urgency: "future", days, label: `dans ${-days} j` };
}
