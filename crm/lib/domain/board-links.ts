import type { Metric } from "./pilotage";

/**
 * **Les liens du tableau de bord, construits une fois.**
 *
 * Quatre onglets qui partagent leurs filtres, et chaque chiffre de chaque onglet
 * qui doit ouvrir sa liste : si chaque page recompose ses URL, il suffit qu'une
 * oublie de recopier un paramètre pour qu'un clic ouvre la liste d'un **autre**
 * filtrage que celui affiché. Le nombre resterait juste et la liste parlerait
 * d'autre chose — l'écart précis que le jalon 109 a payé.
 *
 * Pur : ni React, ni Prisma, ni `window`. Un test unitaire suffit à prouver que
 * changer d'onglet garde les sept filtres.
 */

export const TABS = [
  { href: "/pilotage", label: "Vue d'ensemble" },
  { href: "/pilotage/temps", label: "Dans le temps" },
  { href: "/pilotage/segments", label: "Segments" },
  { href: "/pilotage/campagnes", label: "Campagnes" },
] as const;

export type TabHref = (typeof TABS)[number]["href"];

/**
 * **Ce qui voyage d'un onglet à l'autre, et ce qui reste sur place.**
 *
 * Les filtres suivent — c'est la demande du brief et c'est aussi le seul
 * comportement défendable : on vient de restreindre à une campagne, on change
 * d'onglet pour la regarder autrement, et retrouver « toutes campagnes » ferait
 * recommencer.
 *
 * Les réglages **locaux** à un onglet ne suivent pas : la granularité du
 * graphique, le tri d'un tableau, le mode d'un entonnoir. Les emporter
 * remplirait l'URL de paramètres qu'aucun autre onglet ne lit, et pire : un
 * `tri=taux` posé sur « Segments » déciderait silencieusement du tri d'un
 * tableau de « Campagnes » qui n'a pas les mêmes colonnes.
 */
export const SHARED_PARAMS: readonly string[] = [
  "periode",
  "du",
  "au",
  "campagne",
  "canal",
  "proprietaire",
  "taille",
  "niche",
  "fonction",
  "origine",
];

/** Les paramètres propres à un onglet, retirés quand on en change. */
export const LOCAL_PARAMS: readonly string[] = [
  "pas",
  "vue",
  "metric",
  "tri",
  "sens",
  "part",
  "mode",
  "retour",
  "tranche",
  "etapes",
];

export type Params = Record<string, string | string[] | undefined>;

/** La première valeur d'un paramètre, vide à défaut. */
export function one(params: Params, key: string): string {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

/** Tous les paramètres non vides, à plat : la base de tous les liens. */
export function baseOf(params: Params): URLSearchParams {
  const out = new URLSearchParams();
  for (const key of Object.keys(params)) {
    const value = one(params, key);
    if (value !== "") out.set(key, value);
  }
  return out;
}

function render(path: string, search: URLSearchParams): string {
  const query = search.toString();
  return query === "" ? path : `${path}?${query}`;
}

/** L'URL d'un onglet : les filtres partagés, et rien des réglages locaux. */
export function tabHref(params: Params, tab: TabHref): string {
  const next = new URLSearchParams();
  for (const key of SHARED_PARAMS) {
    const value = one(params, key);
    if (value !== "") next.set(key, value);
  }
  return render(tab, next);
}

/**
 * **La liste derrière un chiffre.**
 *
 * `extra` resserre le filtrage sur la ligne cliquée — une tranche, une
 * campagne, une période plus courte. Les tris sont retirés : ils appartiennent
 * à l'écran qu'on quitte, et `/pilotage/liste` a les siens.
 */
export function listHref(
  params: Params,
  metric: Metric,
  extra: Record<string, string> = {},
  from?: TabHref,
): string {
  const next = baseOf(params);
  next.set("metric", metric);
  /*
    **D'où l'on vient, pour pouvoir y revenir.**

    Sans ce paramètre, le bouton « Retour » de la liste ramenait toujours à la
    vue d'ensemble : on cliquait un chiffre depuis « Segments », on lisait la
    liste, et on se retrouvait sur un autre onglet. Le chemin voyage donc dans
    l'URL plutôt que dans l'historique du navigateur, qui n'existe pas quand le
    lien est partagé ou rouvert.
  */
  if (from !== undefined) next.set("retour", from);
  for (const [key, value] of Object.entries(extra)) {
    if (value === "") next.delete(key);
    else next.set(key, value);
  }
  next.delete("tri");
  next.delete("sens");
  return render("/pilotage/liste", next);
}

/** L'onglet d'où vient une liste, ou la vue d'ensemble à défaut. */
export function backTab(params: Params): TabHref {
  const asked = one(params, "retour");
  const found = TABS.find((tab) => tab.href === asked);
  return found?.href ?? "/pilotage";
}

/** La même page, avec un paramètre changé : une bascule, un tri, un mode. */
export function sameHere(path: string, params: Params, patch: Record<string, string>): string {
  const next = baseOf(params);
  for (const [key, value] of Object.entries(patch)) {
    if (value === "") next.delete(key);
    else next.set(key, value);
  }
  return render(path, next);
}
