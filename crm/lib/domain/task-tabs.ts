import { daysSince } from "./dates";
import { TASK_KIND_LABELS, type TaskKind } from "./task-kind";
import type { TaskPriority } from "./types";

/**
 * **Quatre onglets, et une seule fonction qui rend la pastille *et* la liste.**
 *
 * L'écran Tâches mélangeait trois choses dans six onglets : des tâches, des
 * départs en attente et des signaux d'intérêt. Trois natures différentes dans
 * une même rangée demandent de se rappeler, onglet par onglet, ce qu'on peut
 * faire de ce qu'on y lit — cocher ? envoyer ? rappeler ? — et un écran dont
 * chaque onglet appelle un geste différent n'a plus d'ordre de lecture.
 *
 * **Ne restent donc que des tâches.** Ce qui n'en est pas devient un bandeau ou
 * un lien, en tête d'écran, et mène là où le travail se fait : la file des
 * départs, les réponses, le vivier. Le reste tient en quatre questions sur une
 * seule nature d'objet.
 *
 * La règle qui rend ces onglets dignes de confiance n'a pas changé, et elle est
 * **renforcée** : la pastille et la liste ne partagent plus seulement un
 * prédicat, elles sortent du **même appel** — `tabView()` rend les deux, sur un
 * tableau filtré une fois. Il n'existe donc plus d'ordre d'appel dans lequel
 * elles pourraient diverger, là où deux fonctions séparées laissaient toujours
 * la possibilité d'en appeler une sur un tableau et l'autre sur un autre (c'est
 * l'écart que le jalon 49 a payé entre une puce et sa liste, et le jalon 78 entre
 * une carte et son tableau).
 *
 * Module pur : l'horloge est injectée, rien ne touche Prisma.
 */

export type TaskTabId = "aujourdhui" | "appels" | "avenir" | "terminees";

export interface TaskTabDefinition {
  readonly id: TaskTabId;
  readonly label: string;
  /** Ce que l'onglet retient, dit à l'utilisateur dans son état vide. */
  readonly rule: string;
}

export const TASK_TABS: readonly TaskTabDefinition[] = [
  {
    id: "aujourdhui",
    label: "Aujourd'hui",
    rule: "les tâches à faire aujourd'hui ou en retard, tous types confondus",
  },
  { id: "appels", label: "Appels", rule: "les tâches d'appel qui restent à passer" },
  { id: "avenir", label: "À venir", rule: "les tâches dont l'échéance est après aujourd'hui" },
  {
    id: "terminees",
    label: "Terminées",
    rule: "les tâches terminées, la plus récente d'abord",
  },
];

export const DEFAULT_TAB: TaskTabId = "aujourdhui";

export function isTaskTabId(value: string): value is TaskTabId {
  return TASK_TABS.some((tab) => tab.id === value);
}

export function tabLabel(id: TaskTabId): string {
  return TASK_TABS.find((tab) => tab.id === id)?.label ?? id;
}

export function tabRule(id: TaskTabId): string {
  return TASK_TABS.find((tab) => tab.id === id)?.rule ?? "";
}

/**
 * Une ligne de l'écran : **une tâche, et rien d'autre**.
 *
 * Les champs dérivés sont calculés à la lecture par la couche de service ; les
 * prédicats ne font que les lire. C'est ce qui permet de les tester sans base, et
 * ce qui empêche un onglet de recomposer sa propre règle à partir de bribes.
 */
export interface TaskRow {
  readonly id: string;
  readonly title: string;
  readonly kind: TaskKind;
  readonly due: Date;
  readonly done: boolean;
  readonly doneAt: Date | null;
  readonly priority: TaskPriority;
  /**
   * **À qui la tâche est assignée.**
   *
   * C'est `Task.owner`, le champ qui porte cette information depuis le jalon 4 :
   * aucune seconde colonne n'a été ajoutée. Un second champ d'assignation aurait
   * eu à rester cohérent avec celui-ci, et un jour il l'aurait contredit —
   * l'écran l'appelle « Assigné à », la base l'appelle `owner`, et il n'y a
   * qu'une valeur.
   */
  readonly assignee: string;
  readonly contactId: string | null;
  readonly contactName: string;
  /** Le numéro saisi sur la fiche, tel quel — jamais réécrit (jalon 10). */
  readonly contactPhone: string;
  /** Ce qui rattache la tâche, quand ce n'est pas un contact. */
  readonly detail: string;
  readonly href: string | null;
  /** Ce sur quoi la recherche porte, déjà plié (accents, casse). */
  readonly searchText: string;
}

/**
 * Les quatre prédicats, et rien d'autre ne décide de ce qu'un onglet contient.
 *
 * `« Aujourd'hui »` remplace `« Vos tâches »`, et le changement de nom répare un
 * mensonge : l'espace de travail a **un seul mot de passe partagé** (jalon 9),
 * donc le produit ne sait pas qui est « vous » — l'onglet listait en réalité
 * *toutes* les tâches dues, celles de Mohamed comprises. Il dit maintenant ce
 * qu'il fait, et le choix de la personne est un contrôle à part, explicite.
 */
const TAB_PREDICATES: Record<TaskTabId, (row: TaskRow, now: Date) => boolean> = {
  // `daysSince >= 0` : l'échéance est aujourd'hui ou passée.
  aujourdhui: (row, now) => !row.done && daysSince(row.due, now) >= 0,
  appels: (row) => !row.done && row.kind === "appel",
  avenir: (row, now) => !row.done && daysSince(row.due, now) < 0,
  terminees: (row) => row.done,
};

/* ------------------------------------------------------- filtre par personne */

/** « Tous » — la chaîne vide, pour qu'un paramètre absent vaille « tous ». */
export const ALL_PEOPLE = "";

/**
 * Le filtre par personne, appliqué **avant** tout comptage comme avant toute
 * liste.
 *
 * C'est la seule façon que la pastille décrive ce que la liste montrera : un
 * comptage fait sur toutes les tâches au-dessus d'une liste filtrée par personne
 * annoncerait le travail de quelqu'un d'autre.
 */
export function keptForPerson(row: TaskRow, person: string): boolean {
  return person === ALL_PEOPLE || row.assignee === person;
}

/* ----------------------------------------------------------------- recherche */

/** Plie ce qui ne veut rien dire pour une recherche : accents, casse, bords. */
export function foldSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export interface TaskFilters {
  readonly priority?: TaskPriority;
  readonly kind?: TaskKind;
}

export function activeFilterCount(filters: TaskFilters, search: string): number {
  return (
    [filters.priority, filters.kind].filter((value) => value !== undefined).length +
    (search.trim() === "" ? 0 : 1)
  );
}

function matchesFilters(row: TaskRow, filters: TaskFilters, needle: string): boolean {
  if (filters.priority !== undefined && row.priority !== filters.priority) return false;
  if (filters.kind !== undefined && row.kind !== filters.kind) return false;
  if (needle !== "" && !row.searchText.includes(needle)) return false;
  return true;
}

/* -------------------------------------------------------------------- ordre */

/**
 * L'ordre d'affichage, et il dépend de l'onglet.
 *
 * Les onglets de travail trient par échéance croissante — le plus en retard
 * d'abord, parce que c'est l'ordre dans lequel on traite une file. « Terminées »
 * trie par date d'achèvement décroissante : on y vient pour vérifier ce qu'on
 * vient de faire, pas pour relire le mois dernier. À défaut de `doneAt` — une
 * tâche cochée avant que la colonne existe — l'échéance tient lieu de date.
 */
function compareInTab(a: TaskRow, b: TaskRow, tab: TaskTabId): number {
  if (tab === "terminees") {
    const left = (a.doneAt ?? a.due).getTime();
    const right = (b.doneAt ?? b.due).getTime();
    return right - left;
  }
  return a.due.getTime() - b.due.getTime();
}

/* ----------------------------------------------------------------- la vue */

export interface TabView {
  /** La pastille de chaque onglet, pour la personne choisie. */
  readonly counts: Record<TaskTabId, number>;
  /** Les lignes de l'onglet courant, triées, avant filtres et recherche. */
  readonly inTab: readonly TaskRow[];
  /** Les lignes réellement affichées, filtres et recherche appliqués. */
  readonly shown: readonly TaskRow[];
}

/**
 * **La pastille et la liste, en un seul appel.**
 *
 * Le filtre par personne est appliqué une fois, et les deux sorties en
 * descendent. L'écran n'a donc aucun moyen de compter sur un tableau et de
 * lister sur un autre — c'est une propriété de la fonction, pas une discipline
 * d'appelant, et c'est ce que la garde statique vérifie.
 *
 * Filtres et recherche s'appliquent **après** le comptage, volontairement : une
 * pastille qui suivrait la recherche en cours de frappe ne dirait plus ce que
 * l'onglet contient, et on ne saurait plus si l'onglet est vide ou si c'est le
 * filtre qui le vide (règle des puces du jalon 6, et état vide du jalon 92).
 */
export function tabView(
  rows: readonly TaskRow[],
  tab: TaskTabId,
  person: string,
  now: Date,
  filters: TaskFilters = {},
  search = "",
): TabView {
  const scoped = rows.filter((row) => keptForPerson(row, person));

  const counts = {} as Record<TaskTabId, number>;
  for (const definition of TASK_TABS) {
    counts[definition.id] = scoped.reduce(
      (total, row) => (TAB_PREDICATES[definition.id](row, now) ? total + 1 : total),
      0,
    );
  }

  const inTab = scoped
    .filter((row) => TAB_PREDICATES[tab](row, now))
    .sort((a, b) => compareInTab(a, b, tab));

  const needle = foldSearch(search);
  const shown = inTab.filter((row) => matchesFilters(row, filters, needle));

  return { counts, inTab, shown };
}

/* --------------------------------------------------------------- état vide */

export interface EmptyState {
  readonly kind: "empty" | "filtered";
  readonly message: string;
}

/**
 * **Un écran vide qui ne dit pas pourquoi est un écran qui ment.**
 *
 * Trois situations produisent zéro ligne et appellent trois gestes différents :
 * l'onglet est réellement vide — rien à faire, bonne nouvelle ; des filtres
 * masquent du travail, il faut les retirer ; ou la personne choisie n'a rien,
 * et c'est elle qu'il faut changer.
 */
export function emptyState(
  tab: TaskTabId,
  person: string,
  total: number,
  shown: number,
  filters: TaskFilters,
  search: string,
): EmptyState | null {
  if (shown > 0) return null;

  const active = activeFilterCount(filters, search);
  if (total > 0 && active > 0) {
    const plural = active > 1 ? "filtres actifs masquent" : "filtre actif masque";
    const tasks = total > 1 ? "tâches" : "tâche";
    return { kind: "filtered", message: `${active} ${plural} ${total} ${tasks}` };
  }
  if (person !== ALL_PEOPLE) {
    return {
      kind: "empty",
      message: `Rien pour ${person} dans cet onglet — il retient ${tabRule(tab)}.`,
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

/* ------------------------------------------------------------------ bandeaux */

/**
 * Ce qui n'est pas une tâche, et qui cesse d'être un onglet.
 *
 * Les trois comptes viennent des mêmes lectures qu'avant : ce sont les onglets
 * retirés, rendus en une ligne chacun, au-dessus de la file. Un bandeau à zéro
 * **ne s'affiche pas** — une ligne « 0 mail prêt à partir » permanente est du
 * bruit, et l'on cesse alors de lire celle qui compte (jalon 62).
 */
export interface TaskBanners {
  /** Départs composés qui attendent une validation humaine. */
  readonly pendingSends: number;
  /** Réponses relevées auxquelles personne n'a encore donné suite. */
  readonly unhandledReplies: number;
  /** Prospects portant un signal d'intérêt fiable, dans la fenêtre. */
  readonly hotProspects: number;
}

export function bannerText(banners: TaskBanners): {
  readonly sends: string | null;
  readonly replies: string | null;
  readonly hot: string | null;
} {
  return {
    sends:
      banners.pendingSends === 0
        ? null
        : `${banners.pendingSends} mail${banners.pendingSends > 1 ? "s" : ""} prêt${
            banners.pendingSends > 1 ? "s" : ""
          } à partir`,
    replies:
      banners.unhandledReplies === 0
        ? null
        : `${banners.unhandledReplies} réponse${banners.unhandledReplies > 1 ? "s" : ""} à traiter`,
    hot:
      banners.hotProspects === 0
        ? null
        : `${banners.hotProspects} prospect${banners.hotProspects > 1 ? "s" : ""} chaud${
            banners.hotProspects > 1 ? "s" : ""
          }`,
  };
}

/** Le libellé d'un type, réexporté pour que l'écran n'ait qu'un import. */
export { TASK_KIND_LABELS };
