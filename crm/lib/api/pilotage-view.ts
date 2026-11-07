import "server-only";
import { parsePilotageQuery, periodOf, readPilotage, type PilotageData, type PilotageQuery } from "./pilotage";
import {
  applyFilters,
  metricResult,
  slice,
  type EventRow,
  type Metric,
  type MetricResult,
  type Period,
} from "../domain/pilotage";
import { isMetric } from "../domain/pilotage";

/**
 * **Le passage obligé des quatre onglets.**
 *
 * Le jalon 109 avait un seul écran, et la garde statique exigeait de **la**
 * page qu'elle appelle `periodOf`, `applyFilters`, `slice` et `metricResult`.
 * Quatre onglets changent la nature du risque : la même suite recopiée quatre
 * fois, et il suffit qu'un onglet attribue les campagnes avant de filtrer
 * quand un autre fait l'inverse pour que deux onglets affichent deux nombres
 * sur les mêmes gens — le défaut du jalon 54, reproduit à l'intérieur d'un seul
 * écran.
 *
 * Il n'y a donc **qu'un** endroit qui lit l'URL, borne la période, attribue les
 * campagnes et filtre. Les onglets reçoivent le résultat et ne peuvent pas en
 * produire un autre : `tests/pilotage-source.test.ts` échoue si une page
 * importe `applyFilters` ou `slice` elle-même.
 *
 * Et `metric()` reste la seule porte vers un chiffre : la pastille affiche
 * `count`, le lien ouvre `rows`, les deux sortant du même appel.
 */

export interface PilotageView {
  readonly query: PilotageQuery;
  readonly period: Period;
  readonly data: PilotageData;
  /**
   * L'histoire entière, **filtrée et campagnes attribuées**, mais non bornée à
   * la période : « nouvelle personne contactée » et la qualification d'une démo
   * ont besoin de ce qui précède la période.
   */
  readonly all: readonly EventRow[];
  /** Les lignes de la période. */
  readonly rows: readonly EventRow[];
  /** Le chiffre et sa liste, du même appel. */
  readonly metric: (name: Metric) => MetricResult;
  /**
   * Le même chiffre sur une **autre** période — celle d'avant, un seau du
   * graphique.
   *
   * Même fonction, mêmes filtres, autre bornage : c'est ce qui fait qu'un
   * « +12 contre 25 » compare deux fois la même définition. Une seconde
   * définition pour la comparaison rendrait l'évolution fausse sans que le
   * chiffre courant bouge d'un pouce — donc sans que personne s'en aperçoive.
   */
  readonly metricOn: (period: Period, rows: readonly EventRow[], name: Metric) => MetricResult;
  /** La même chose sur la période précédente, pour un « +12 % cette semaine ». */
  readonly previous: { readonly period: Period; readonly rows: readonly EventRow[] };
  readonly now: Date;
}

export async function pilotageView(
  params: Record<string, string | string[] | undefined> | URLSearchParams,
  now = new Date(),
): Promise<PilotageView> {
  const query = parsePilotageQuery(params);
  const data = await readPilotage();
  const period = periodOf(query, now);
  const all = applyFilters(data.rows, query.filters);
  const rows = slice(all, period);

  /*
    **La période précédente est la même durée, juste avant.**

    Pas « la semaine dernière » calculée à part : la comparaison doit valoir
    pour n'importe quelle période choisie, mois comme plage libre, et une
    seconde règle par type de période finirait par comparer une semaine à un
    mois. Décaler les deux bornes de la durée écoulée est la seule définition
    qui marche pour les quatre.
  */
  const span = period.end.getTime() - period.start.getTime();
  const before: Period = {
    start: new Date(period.start.getTime() - span),
    end: period.start,
    label: "Période précédente",
  };

  return {
    query,
    period,
    data,
    all,
    rows,
    metric: (name) => metricResult(all, rows, period, name),
    metricOn: (scope, scoped, name) => metricResult(all, scoped, scope, name),
    previous: { period: before, rows: slice(all, before) },
    now,
  };
}

/** Le chiffre lu dans l'URL, ou le défaut : la frontière string → union. */
export function readMetric(value: string, fallback: Metric): Metric {
  return isMetric(value) ? value : fallback;
}
