import { daysSince } from "./dates";
import type { TaskPriority } from "./types";

/**
 * **Un prédicat par onglet, et c'est lui qui compte la pastille.**
 *
 * L'écran Tâches range le travail du jour en onglets. La seule règle qui les
 * rende dignes de confiance est celle-ci : **la pastille et la liste sortent du
 * même prédicat**, appliqué au même tableau de lignes. Une pastille qui
 * annoncerait 7 au-dessus d'une liste de 5 ferait perdre la confiance dans les
 * deux — c'est l'écart que le jalon 49 a payé une fois entre une puce et sa
 * liste, et le jalon 78 une seconde fois entre une carte et son tableau.
 *
 * **Rien n'est écrit en base pour alimenter un onglet.** Il n'y a ni colonne
 * d'onglet, ni statut « traité », ni ligne de tâche dupliquée : les lignes sont
 * assemblées à la lecture depuis ce qui existe déjà (tâches, départs en
 * attente, réponses relevées, signaux d'intérêt), et l'appartenance à un onglet
 * est une **question posée aux données**, jamais un état qu'il faudrait tenir à
 * jour. Un état à tenir finit toujours par contredire ce qu'il décrit.
 *
 * Module pur : aucune dépendance à Prisma, l'horloge est injectée. Les tests
 * couvrent les six onglets sans base.
 */

export type TaskTabId = "vos" | "appels" | "envoyer" | "chauds" | "reponses" | "toutes";

export interface TaskTabDefinition {
  readonly id: TaskTabId;
  readonly label: string;
  /** Ce que l'onglet retient, dit à l'utilisateur dans son état vide. */
  readonly rule: string;
}

export const TASK_TABS: readonly TaskTabDefinition[] = [
  {
    id: "vos",
    label: "Vos tâches",
    rule: "les tâches à faire aujourd'hui ou en retard",
  },
  { id: "appels", label: "Appels", rule: "les tâches d'appel à faire" },
  {
    id: "envoyer",
    label: "À envoyer",
    rule: "les départs composés qui attendent votre clic",
  },
  {
    id: "chauds",
    label: "Prospects chauds",
    rule: "une réponse, un clic sur un de nos liens ou un passage en Qualifié, depuis moins de 14 jours",
  },
  {
    id: "reponses",
    label: "Réponses des prospects",
    rule: "les réponses relevées dans la boîte et pas encore traitées",
  },
  { id: "toutes", label: "Toutes les tâches", rule: "tout ce qui n'est pas terminé" },
];

export const DEFAULT_TAB: TaskTabId = "vos";

export function isTaskTabId(value: string): value is TaskTabId {
  return TASK_TABS.some((tab) => tab.id === value);
}

export function tabLabel(id: TaskTabId): string {
  return TASK_TABS.find((tab) => tab.id === id)?.label ?? id;
}

export function tabRule(id: TaskTabId): string {
  return TASK_TABS.find((tab) => tab.id === id)?.rule ?? "";
}

/** La nature d'une ligne, qui décide de ce qu'on peut en faire. */
export type FeedKind = "task" | "departure" | "reply" | "hot";

export const FEED_KINDS: readonly FeedKind[] = ["task", "departure", "reply", "hot"];

export function isFeedKind(value: string): value is FeedKind {
  return FEED_KINDS.includes(value as FeedKind);
}

export function kindLabel(kind: FeedKind): string {
  switch (kind) {
    case "task":
      return "Tâche";
    case "departure":
      return "Départ à envoyer";
    case "reply":
      return "Réponse relevée";
    case "hot":
      return "Signal d'intérêt";
  }
}

/**
 * Le seul signal qui rende un prospect « chaud ».
 *
 * **L'ouverture du pixel n'en fait pas partie, et ce n'est pas un oubli.** Notre
 * suivi d'ouverture surestime par construction : Apple Mail charge les images à
 * la réception, que quiconque ait lu ou non, et Gmail les met en cache (jalons
 * 37 et 43). Une file de prospects chauds alimentée par des ouvertures ferait
 * appeler des gens qui n'ont rien fait, et elle ferait perdre confiance au seul
 * écran dont la valeur est de ne contenir que du vrai.
 */
export type HotSignalKind = "reply" | "click" | "qualified";

export const HOT_WINDOW_DAYS = 14;

export function describeHotSignal(kind: HotSignalKind): string {
  switch (kind) {
    case "reply":
      return "a répondu";
    case "click":
      return "a cliqué sur un de nos liens";
    case "qualified":
      return "passé en Qualifié";
  }
}

/**
 * Une ligne de l'écran, quelle que soit son origine.
 *
 * Les champs booléens sont **calculés à la lecture** par la couche de service,
 * depuis les données réelles ; les prédicats ne font que les lire. C'est ce qui
 * permet de les tester sans base, et ce qui empêche un onglet de recomposer sa
 * propre règle à partir de bribes.
 */
export interface FeedRow {
  /** Unique toutes origines confondues : `tache:<id>`, `depart:<id>`… */
  readonly id: string;
  readonly kind: FeedKind;
  readonly title: string;
  readonly detail: string;
  /** Échéance, quand la ligne en a une. Un départ ou une réponse n'en a pas. */
  readonly due: Date | null;
  readonly done: boolean;
  readonly priority: TaskPriority | null;
  readonly owner: string;
  readonly contactId: string | null;
  readonly contactName: string;
  /** Où mener au clic — la fiche, la file des départs. */
  readonly href: string | null;
  /** Une tâche d'appel, reconnue à son intitulé (voir `isCallTitle`). */
  readonly isCall: boolean;
  /** Un départ composé qui attend une validation humaine. */
  readonly pendingSend: boolean;
  /** Une réponse relevée à laquelle personne n'a encore donné suite. */
  readonly unhandledReply: boolean;
  /** Le signal d'intérêt, s'il y en a un de fiable. */
  readonly hotSignal: HotSignalKind | null;
  /**
   * Cycle de vie terminal (`Perdu`, `Ancien Client`).
   *
   * Porté sur la ligne plutôt que laissé à la requête : un prospect chaud qui a
   * dit non n'existe pas, et la règle doit tenir même si une lecture future
   * oubliait de l'exclure en SQL (leçon du jalon 29, où un champ facultatif
   * portant une règle d'affichage était une règle qu'on pouvait oublier).
   */
  readonly terminal: boolean;
  /** L'instant qui date la ligne : échéance, composition, réponse, signal. */
  readonly at: Date;
  /** Ce sur quoi la recherche porte, déjà plié (accents, casse). */
  readonly searchText: string;
}

/**
 * Une tâche d'appel, reconnue à son intitulé.
 *
 * **Il n'existe aucune colonne de canal sur `Task`**, et ce jalon n'en ajoute
 * pas : la consigne était de calculer les onglets à la lecture, pas d'écrire un
 * état pour les alimenter. On reconnaît donc des formes — celles que le produit
 * écrit lui-même (« Relancer X » vient d'une relance, « Appeler X » d'une
 * prochaine action) et celles qu'un humain tape. La liste est **étroite** : un
 * mot trop vague ferait entrer dans l'onglet des tâches qui n'ont rien à voir,
 * et un onglet qui ne tient pas sa promesse ne se rouvre pas.
 */
export function isCallTitle(title: string): boolean {
  return /\b(appel|appeler|rappeler|t[ée]l[ée]phon)/i.test(title);
}

/**
 * Les six prédicats, et rien d'autre ne décide de ce qu'un onglet contient.
 *
 * `« Vos tâches »` ne filtre par personne : l'espace de travail a **un seul mot
 * de passe partagé** (jalon 9), donc le produit ne sait pas qui est « vous » et
 * inventer des comptes utilisateurs serait une autre décision. Ce qu'il sait,
 * c'est ce qui est dû — aujourd'hui ou en retard. Le propriétaire reste un
 * filtre de la barre d'outils, appuyé sur `Task.owner`, qui existe déjà.
 */
export const TAB_PREDICATES: Record<TaskTabId, (row: FeedRow, now: Date) => boolean> = {
  vos: (row, now) =>
    row.kind === "task" && !row.done && row.due !== null && daysSince(row.due, now) >= 0,
  appels: (row) => row.kind === "task" && !row.done && row.isCall,
  envoyer: (row) => row.kind === "departure" && row.pendingSend,
  chauds: (row, now) =>
    row.kind === "hot" &&
    row.hotSignal !== null &&
    !row.terminal &&
    daysSince(row.at, now) <= HOT_WINDOW_DAYS,
  reponses: (row) => row.kind === "reply" && row.unhandledReply,
  toutes: (row) => !row.done,
};

/** La pastille d'un onglet : le prédicat, sur toutes les lignes. */
export function countTab(rows: readonly FeedRow[], tab: TaskTabId, now: Date): number {
  return rows.reduce((total, row) => (TAB_PREDICATES[tab](row, now) ? total + 1 : total), 0);
}

export function tabCounts(rows: readonly FeedRow[], now: Date): Record<TaskTabId, number> {
  const counts = {} as Record<TaskTabId, number>;
  for (const tab of TASK_TABS) counts[tab.id] = countTab(rows, tab.id, now);
  return counts;
}

/** La liste d'un onglet : **le même prédicat**, sur les mêmes lignes. */
export function rowsForTab(rows: readonly FeedRow[], tab: TaskTabId, now: Date): FeedRow[] {
  return rows.filter((row) => TAB_PREDICATES[tab](row, now));
}

/* ------------------------------------------------------------------ filtres */

export interface TaskFilters {
  readonly owner?: string;
  readonly priority?: TaskPriority;
  readonly kind?: FeedKind;
}

export function activeFilterCount(filters: TaskFilters): number {
  return [filters.owner, filters.priority, filters.kind].filter(
    (value) => value !== undefined && value !== "",
  ).length;
}

export function describeFilters(filters: TaskFilters): string[] {
  const parts: string[] = [];
  if (filters.owner !== undefined && filters.owner !== "") parts.push(`propriétaire ${filters.owner}`);
  if (filters.priority !== undefined) parts.push(`priorité ${filters.priority}`);
  if (filters.kind !== undefined) parts.push(`type ${kindLabel(filters.kind)}`);
  return parts;
}

/** Plie ce qui ne veut rien dire pour une recherche : accents, casse, bords. */
export function foldSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function applyTaskFilters(
  rows: readonly FeedRow[],
  filters: TaskFilters,
  search: string,
): FeedRow[] {
  const needle = foldSearch(search);
  return rows.filter((row) => {
    if (filters.owner !== undefined && filters.owner !== "" && row.owner !== filters.owner) {
      return false;
    }
    if (filters.priority !== undefined && row.priority !== filters.priority) return false;
    if (filters.kind !== undefined && row.kind !== filters.kind) return false;
    if (needle !== "" && !row.searchText.includes(needle)) return false;
    return true;
  });
}

/* --------------------------------------------------------------- état vide */

export interface EmptyState {
  readonly kind: "empty" | "filtered";
  readonly message: string;
}

/**
 * **Un écran vide qui ne dit pas pourquoi est un écran qui ment.**
 *
 * Deux situations produisent zéro ligne et appellent deux gestes opposés :
 * l'onglet est réellement vide — rien à faire, et c'est une bonne nouvelle — ou
 * bien des filtres masquent du travail, et il faut les retirer. L'écran les
 * distingue, compte ce qui est masqué, et propose le geste.
 */
export function emptyState(
  tab: TaskTabId,
  total: number,
  shown: number,
  filters: TaskFilters,
  search: string,
): EmptyState | null {
  if (shown > 0) return null;

  const active = activeFilterCount(filters) + (search.trim() === "" ? 0 : 1);
  if (total > 0 && active > 0) {
    const plural = active > 1 ? "filtres actifs masquent" : "filtre actif masque";
    const tasks = total > 1 ? "tâches" : "tâche";
    return {
      kind: "filtered",
      message: `${active} ${plural} ${total} ${tasks}`,
    };
  }
  return {
    kind: "empty",
    message: `Aucune tâche dans cet onglet — il retient ${tabRule(tab)}.`,
  };
}

/* --------------------------------------------------------------- pagination */

export const PAGE_SIZE = 20;

export interface Page<T> {
  readonly rows: readonly T[];
  readonly page: number;
  readonly pages: number;
  readonly total: number;
  /** « 1 - 20 de 47 », ou une phrase vide quand il n'y a rien. */
  readonly range: string;
}

export function paginate<T>(rows: readonly T[], page: number, size = PAGE_SIZE): Page<T> {
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(Math.max(1, Math.trunc(page)), pages);
  const start = (current - 1) * size;
  const slice = rows.slice(start, start + size);
  return {
    rows: slice,
    page: current,
    pages,
    total: rows.length,
    range: rows.length === 0 ? "" : `${start + 1} - ${start + slice.length} de ${rows.length}`,
  };
}

/* ------------------------------------------------------------------ ordre */

/**
 * L'ordre d'affichage : le plus urgent d'abord.
 *
 * Une échéance dépassée passe devant un signal frais, et à égalité c'est la
 * date qui tranche. Les lignes sans échéance — départs, réponses, signaux —
 * sont classées par leur instant, le plus récent d'abord : une réponse d'hier
 * compte plus qu'une réponse de la semaine dernière.
 */
export function compareRows(a: FeedRow, b: FeedRow): number {
  if (a.due !== null && b.due !== null) return a.due.getTime() - b.due.getTime();
  if (a.due !== null) return -1;
  if (b.due !== null) return 1;
  return b.at.getTime() - a.at.getTime();
}
