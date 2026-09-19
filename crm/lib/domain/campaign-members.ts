/**
 * Le vocabulaire des inscrits d'une campagne : leurs états, ce qui les filtre,
 * et ce qui les trie.
 *
 * **Ici et non dans `lib/api/`** : la liste des inscrits est rendue par un
 * composant client, qui a besoin des libellés et du type. `lib/api/campaigns.ts`
 * porte `import "server-only"` — l'y laisser ferait entrer Prisma dans le
 * paquet du navigateur, et le build le refuse (à raison).
 */

/**
 * Le statut d'une inscription **retirée à la main**.
 *
 * Distinct de `stopped`, qui dit que le produit a arrêté l'envoi — réponse
 * reçue, fiche close. Retirer, c'est un geste de l'utilisateur : la personne
 * quitte la campagne, la liste ne la montre plus, et elle redevient
 * réinscriptible. Le mot vit dans le domaine parce que trois couches le
 * comparent : la liste des inscrits, l'inscription, et le retrait.
 */
export const REMOVED = "removed";

/** L'état d'un inscrit, tel que la liste le filtre. */
export type MemberState = "pending" | "waiting" | "replied" | "stopped";

export interface CampaignMember {
  readonly enrollmentId: string;
  readonly contactId: string;
  readonly name: string;
  readonly company: string;
  readonly role: string;
  /** Étape atteinte : 0 = rien n'est encore parti. */
  readonly step: number;
  readonly steps: number;
  readonly lastSentAt: Date | null;
  /**
   * Au moins un message lui est **réellement parti**.
   *
   * Lu dans les envois, jamais déduit de l'étape ni de `lastSentAt` : c'est
   * exactement ce que compte « Personnes écrites » en haut de page, donc le
   * seul moyen que le filtre et la carte ne puissent pas se contredire.
   */
  readonly written: boolean;
  /**
   * Première ouverture constatée, ou `null`.
   *
   * Une **date** plutôt qu'un booléen : le nombre « 13 sur 52 » ne se vérifie
   * ligne à ligne que si chaque ligne dit *quand*. Estimation, comme partout
   * depuis le jalon 37 — l'image se charge sans qu'on ait lu.
   */
  readonly openedAt: Date | null;
  readonly repliedAt: Date | null;
  readonly state: MemberState;
  /** Pourquoi l'inscription s'est arrêtée, quand elle l'est. */
  readonly stopReason: string;
  /**
   * Sortie de la séquence **par un geste**, depuis la file des départs.
   *
   * Ces lignes ne sont ni écrites ni en attente : elles n'attendent plus rien.
   * Les laisser au milieu du reste avec un tiret à la place d'une date faisait
   * lire un retrait comme un envoi qui tarde.
   */
  readonly handRemoved: boolean;
}

/**
 * L'état d'un inscrit, dérivé — jamais stocké.
 *
 * Quatre états, dans l'ordre où ils comptent pour décider quoi faire :
 * arrêtée (elle ne recevra plus rien, et la raison est écrite), a répondu
 * (c'est gagné, on sort de la mécanique), en attente (écrit, silence), et pas
 * encore écrit. Le dériver plutôt que le stocker garantit qu'il ne peut pas
 * contredire les envois et les réponses — c'est la règle du statut de relance
 * du jalon 6, appliquée ici.
 */
export function memberState(input: {
  readonly status: string;
  readonly lastSentAt: Date | null;
  readonly repliedAt: Date | null;
}): MemberState {
  if (input.repliedAt !== null) return "replied";
  if (input.status !== "active") return "stopped";
  return input.lastSentAt === null ? "pending" : "waiting";
}

export const MEMBER_STATES: ReadonlyArray<{ value: MemberState; label: string }> = [
  { value: "pending", label: "Pas encore écrit" },
  { value: "waiting", label: "Silencieux" },
  { value: "replied", label: "A répondu" },
  { value: "stopped", label: "Arrêtés" },
];

/**
 * Ce qu'un retrait à la main laisse derrière lui, reconnu à sa raison.
 *
 * Deux chemins retirent quelqu'un d'une campagne et n'écrivent pas le même
 * statut : la carte de campagne pose `removed` (la ligne disparaît), la file
 * des départs pose `stopped` avec cette raison (la ligne reste). Le second est
 * celui qui produit les lignes à tiret ; il est donc nommé plutôt que deviné.
 */
export function isHandRemoval(stopReason: string): boolean {
  return /retir[ée]/i.test(stopReason);
}

/**
 * Ce que les puces sélectionnent.
 *
 * `written` n'est pas un état : quelqu'un à qui l'on a écrit peut avoir
 * répondu, s'être tu, ou avoir été arrêté depuis. C'est la question la plus
 * simple qu'on se pose sur une campagne — **qui a été contacté au moins une
 * fois** — et aucune des quatre puces d'état n'y répondait.
 */
export type MemberFilter = "all" | "written" | MemberState;

export const MEMBER_FILTERS: ReadonlyArray<{ value: MemberFilter; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "written", label: "A reçu un premier message" },
  ...MEMBER_STATES,
];

export function matchesMemberFilter(member: CampaignMember, filter: MemberFilter): boolean {
  if (filter === "all") return true;
  if (filter === "written") return member.written;
  return member.state === filter;
}

/** Les colonnes sur lesquelles on peut trier — dérivé, pour qu'aucune ne mente. */
export const MEMBER_SORT_KEYS = [
  "name",
  "company",
  "role",
  "step",
  "lastSentAt",
  "opened",
  "state",
  "reply",
] as const;

export type MemberSortKey = (typeof MEMBER_SORT_KEYS)[number];

export function isMemberSortKey(value: string): value is MemberSortKey {
  return (MEMBER_SORT_KEYS as readonly string[]).includes(value);
}

/**
 * L'ordre des états quand on trie par état.
 *
 * Alphabétique n'apprendrait rien : ce qu'on veut voir, c'est la progression —
 * jamais écrit, écrit et silencieux, a répondu, arrêté.
 */
const STATE_ORDER: Record<MemberState, number> = {
  pending: 0,
  waiting: 1,
  replied: 2,
  stopped: 3,
};

/** Une date absente se range **toujours en fin**, quel que soit le sens. */
function byDate(a: Date | null, b: Date | null, dir: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a.getTime() - b.getTime()) * dir;
}

/**
 * Le tri du tableau des inscrits.
 *
 * L'ordre d'insertion ne répond à aucune question : il dit dans quel ordre on
 * a coché des cases il y a trois semaines. Les valeurs manquantes sortent en
 * fin dans les deux sens — c'est la règle des relances sans date (jalon 30) :
 * inverser un tri ne doit pas ramener les lignes vides en tête.
 */
export function compareMembers(
  a: CampaignMember,
  b: CampaignMember,
  key: MemberSortKey,
  dir: "asc" | "desc",
): number {
  const sign: 1 | -1 = dir === "desc" ? -1 : 1;
  switch (key) {
    case "name":
      return compareText(a.name, b.name, sign);
    case "company":
      return compareText(a.company, b.company, sign);
    case "role":
      return compareText(a.role, b.role, sign);
    case "step":
      return (a.step - b.step) * sign;
    case "lastSentAt":
      return byDate(a.lastSentAt, b.lastSentAt, sign);
    case "opened":
      return byDate(a.openedAt, b.openedAt, sign);
    case "reply":
      return byDate(a.repliedAt, b.repliedAt, sign);
    case "state":
      return (STATE_ORDER[a.state] - STATE_ORDER[b.state]) * sign;
  }
}

/**
 * Comparaison de texte **sans `localeCompare`** : il suit la locale du
 * conteneur, donc l'ordre changerait d'un environnement à l'autre (jalon 72).
 * Les valeurs vides sortent en fin, comme les dates absentes.
 */
function compareText(a: string, b: string, sign: 1 | -1): number {
  if (a === "" && b === "") return 0;
  if (a === "") return 1;
  if (b === "") return -1;
  return (a < b ? -1 : a > b ? 1 : 0) * sign;
}

/**
 * Le tableau tel qu'il se lit : les retraits à la main **en dernier**, quel
 * que soit le tri.
 *
 * Ils ne sont ni écrits ni en attente ; les mêler au reste faisait lire un
 * tiret comme « l'envoi tarde ». Le tri s'applique à l'intérieur de chacun des
 * deux groupes — c'est la partition du tri des fiches closes (jalon 30).
 */
export function sortMembers(
  members: readonly CampaignMember[],
  key: MemberSortKey,
  dir: "asc" | "desc",
): CampaignMember[] {
  return [...members].sort((a, b) => {
    if (a.handRemoved !== b.handRemoved) return a.handRemoved ? 1 : -1;
    return compareMembers(a, b, key, dir);
  });
}
