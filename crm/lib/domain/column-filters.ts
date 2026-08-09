import { startOfDay } from "./dates";

/**
 * Filtres de colonne, façon tableur.
 *
 * Un seul modèle pour les quatre tableaux. Chaque colonne déclare son type
 * (`text`, `date`, `number`) et le reste — lecture de l'URL, écriture de l'URL,
 * traduction en requête Prisma, calcul des valeurs distinctes — est générique.
 * Quatre tableaux ne coûtent donc pas quatre implémentations, et un
 * comportement corrigé l'est partout à la fois.
 *
 * **Tout l'état vit dans l'URL.** Une vue filtrée se met en favori, se partage,
 * et survit à un rechargement. C'est aussi ce qui permet au filtrage de rester
 * côté serveur : la page est un composant serveur qui lit l'URL et interroge la
 * base, sans jamais charger la table entière dans le navigateur.
 */

export const FILTER_PREFIX = "f.";

export type ColumnKind = "text" | "date" | "number";

/**
 * Sélection de valeurs discrètes. `VOID` désigne les lignes dont la colonne est
 * vide — une valeur à part entière dans un tableur, et la seule façon de
 * demander « montre-moi ce qui manque ».
 */
export const VOID = "(vide)";

export interface TextFilter {
  readonly kind: "text";
  readonly values: readonly string[];
}

/**
 * Raccourcis de date. `any` (« renseignée ») n'a pas d'équivalent tableur mais
 * porte la puce « À relancer » : *toute* échéance, en retard, du jour ou à venir.
 */
export const DATE_PRESETS = ["late", "today", "week", "month", "empty", "any"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  late: "En retard",
  today: "Aujourd'hui",
  week: "Cette semaine",
  month: "Ce mois",
  empty: "Vide",
  any: "Renseignée",
};

export interface DateFilter {
  readonly kind: "date";
  readonly preset: DatePreset | null;
  /** Bornes ISO `AAAA-MM-JJ`, exclusives d'un preset. */
  readonly from: string | null;
  readonly to: string | null;
}

export interface NumberFilter {
  readonly kind: "number";
  readonly min: number | null;
  readonly max: number | null;
}

export type ColumnFilter = TextFilter | DateFilter | NumberFilter;
export type FilterState = Readonly<Record<string, ColumnFilter>>;

/** Déclaration d'une colonne filtrable. */
export interface ColumnSpec {
  readonly key: string;
  readonly label: string;
  readonly kind: ColumnKind;
}

export function isDatePreset(value: string): value is DatePreset {
  return DATE_PRESETS.some((preset) => preset === value);
}

function toList(value: string | readonly string[] | undefined): string[] {
  if (value === undefined) return [];
  const raw = Array.isArray(value) ? value : [value];
  return raw.filter((item): item is string => typeof item === "string" && item !== "");
}

/**
 * Lit l'état de filtrage depuis les paramètres d'URL.
 *
 * Les valeurs multiples passent par un paramètre **répété**
 * (`f.lifecycle=Lead&f.lifecycle=Prospect`) plutôt que par une liste séparée par
 * des virgules : un nom de société contient parfois une virgule, et une
 * séparation qui coupe au milieu d'une valeur produit un filtre qui ne
 * correspond à rien sans dire pourquoi.
 *
 * Une valeur illisible est ignorée, pas rejetée : une URL partagée dont un
 * paramètre a été tronqué doit afficher quelque chose, pas une erreur.
 */
export function parseFilters(
  params: Record<string, string | string[] | undefined>,
  columns: readonly ColumnSpec[],
): FilterState {
  const state: Record<string, ColumnFilter> = {};

  for (const column of columns) {
    const raw = toList(params[`${FILTER_PREFIX}${column.key}`]);
    if (raw.length === 0) continue;

    if (column.kind === "text") {
      state[column.key] = { kind: "text", values: [...new Set(raw)] };
      continue;
    }

    const first = raw[0];
    if (first === undefined) continue;

    if (column.kind === "date") {
      if (isDatePreset(first)) {
        state[column.key] = { kind: "date", preset: first, from: null, to: null };
        continue;
      }
      const [from = "", to = ""] = first.split("..");
      if (from === "" && to === "") continue;
      state[column.key] = {
        kind: "date",
        preset: null,
        from: from === "" ? null : from,
        to: to === "" ? null : to,
      };
      continue;
    }

    const [min = "", max = ""] = first.split("..");
    const minValue = min === "" ? null : Number(min);
    const maxValue = max === "" ? null : Number(max);
    if (minValue !== null && !Number.isFinite(minValue)) continue;
    if (maxValue !== null && !Number.isFinite(maxValue)) continue;
    if (minValue === null && maxValue === null) continue;
    state[column.key] = { kind: "number", min: minValue, max: maxValue };
  }

  return state;
}

/** Écrit un filtre dans des paramètres d'URL. `null` retire la colonne. */
export function applyFilterToParams(
  params: URLSearchParams,
  key: string,
  filter: ColumnFilter | null,
): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  const name = `${FILTER_PREFIX}${key}`;
  next.delete(name);

  if (filter === null) return next;

  if (filter.kind === "text") {
    for (const value of filter.values) next.append(name, value);
    return next;
  }

  if (filter.kind === "date") {
    if (filter.preset !== null) next.set(name, filter.preset);
    else if (filter.from !== null || filter.to !== null) {
      next.set(name, `${filter.from ?? ""}..${filter.to ?? ""}`);
    }
    return next;
  }

  if (filter.min !== null || filter.max !== null) {
    next.set(name, `${filter.min ?? ""}..${filter.max ?? ""}`);
  }
  return next;
}

/** Retire tous les filtres de colonne, en gardant le reste de l'URL. */
export function clearFilters(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params.toString());
  for (const key of [...next.keys()]) {
    if (key.startsWith(FILTER_PREFIX)) next.delete(key);
  }
  return next;
}

export function activeCount(state: FilterState): number {
  return Object.keys(state).length;
}

/**
 * Intervalle concret d'un raccourci de date.
 *
 * `null` pour `empty` et `any`, qui portent sur la présence de la valeur et non
 * sur un intervalle. Les bornes sont `[from, to)` — borne haute exclue, pour que
 * « ce mois » et « le mois suivant » ne se recouvrent pas d'une journée.
 */
export interface DateRange {
  readonly from: Date | null;
  readonly to: Date | null;
}

export function presetRange(preset: DatePreset, now: Date): DateRange | null {
  const today = startOfDay(now);

  switch (preset) {
    case "late":
      return { from: null, to: today };
    case "today":
      return { from: today, to: addDays(today, 1) };
    case "week": {
      // Semaine ISO : lundi comme premier jour. `getDay()` rend 0 le dimanche.
      const weekday = (today.getDay() + 6) % 7;
      const monday = addDays(today, -weekday);
      return { from: monday, to: addDays(monday, 7) };
    }
    case "month": {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: first, to: new Date(today.getFullYear(), today.getMonth() + 1, 1) };
    }
    case "empty":
    case "any":
      return null;
  }
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Bornes explicites d'un filtre de date, presets résolus. */
export function dateBounds(filter: DateFilter, now: Date): DateRange {
  if (filter.preset !== null) return presetRange(filter.preset, now) ?? { from: null, to: null };

  return {
    from: filter.from === null ? null : startOfDay(new Date(`${filter.from}T00:00:00`)),
    // Borne haute inclusive côté utilisateur : « jusqu'au 31 » comprend le 31.
    to: filter.to === null ? null : addDays(startOfDay(new Date(`${filter.to}T00:00:00`)), 1),
  };
}

/** Résumé lisible d'un filtre, pour l'infobulle de l'icône. */
export function describeFilter(filter: ColumnFilter): string {
  if (filter.kind === "text") {
    return filter.values.length === 1
      ? (filter.values[0] ?? "")
      : `${filter.values.length} valeurs`;
  }
  if (filter.kind === "date") {
    if (filter.preset !== null) return DATE_PRESET_LABELS[filter.preset];
    return `${filter.from ?? "…"} → ${filter.to ?? "…"}`;
  }
  if (filter.min !== null && filter.max !== null) return `${filter.min} – ${filter.max}`;
  if (filter.min !== null) return `≥ ${filter.min}`;
  return `≤ ${filter.max}`;
}
