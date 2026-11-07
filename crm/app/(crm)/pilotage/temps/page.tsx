import { BoardTabs } from "@/components/pilotage/board-tabs";
import { BoardHeader } from "@/components/pilotage/board-header";
import { FilterBar } from "@/components/pilotage/filter-bar";
import { TimelineToolbar } from "@/components/pilotage/timeline-toolbar";
import { TimelineChart } from "@/components/pilotage/timeline-chart";
import { WeekPaceStrip } from "@/components/pilotage/week-pace";
import { pilotageView } from "@/lib/api/pilotage-view";
import { listHref, one } from "@/lib/domain/board-links";
import {
  GRANULARITY_LABELS,
  bucketsBetween,
  buildSeries,
  channelsWithData,
  peakOf,
  rangeNote,
  timelineMetricLabel,
  timelineRange,
  toGranularity,
  toTimelineMetric,
  toTimelineView,
  trimLeadingEmpty,
  weekPace,
  weeklyTargetFor,
} from "@/lib/domain/timeline";

export const dynamic = "force-dynamic";

/**
 * **Onglet 2 — Dans le temps.**
 *
 * Le graphique du jalon 113, déplacé dans son propre onglet et complété de ce
 * que le prototype validé demande : le panneau de détail **sous** le tracé
 * plutôt qu'une infobulle flottante, la cible en pointillés rouges, et les
 * barres en gris neutre tant que la cible n'est pas atteinte.
 *
 * La valeur d'un point sort de `metricResult` — la même fonction que la liste
 * qu'il ouvre —, et c'est ce qui rend l'égalité « valeur du point = longueur de
 * sa liste » vraie par construction plutôt que par vigilance. Vérifiée sur 913
 * points au jalon 113.
 */
export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = await pilotageView(params);
  const { data, period, query, all, now } = view;

  const granularity = toGranularity(one(params, "pas"));
  const chartView = toTimelineView(one(params, "vue"));
  const metric = toTimelineMetric(one(params, "metric"));
  const weeklyTarget = weeklyTargetFor(metric, data.targets);

  const range = timelineRange(all, period, query.periodKey === "libre", now);
  const series = trimLeadingEmpty(
    buildSeries(
      all,
      bucketsBetween(range.from, range.to, granularity),
      metric,
      granularity,
      weeklyTarget,
    ),
  );
  const channels = channelsWithData(series);
  const points = series.map((point) => ({
    key: point.bucket.key,
    short: point.bucket.short,
    exact: point.bucket.exact,
    total: point.total,
    target: point.target,
    previous: point.previous,
    byChannel: point.byChannel,
    bySource: point.bySource,
    href: listHref(params, metric, {
      periode: "libre",
      du: point.bucket.fromKey,
      au: point.bucket.toKey,
    }, "/pilotage/temps"),
    channelHref: Object.fromEntries(
      channels.map((channel) => [
        channel,
        listHref(params, metric, {
          periode: "libre",
          du: point.bucket.fromKey,
          au: point.bucket.toKey,
          canal: channel,
        }, "/pilotage/temps"),
      ]),
    ),
  }));

  return (
    <div className="min-h-full bg-board px-6 py-5">
      <BoardHeader period={period.label} />
      <BoardTabs params={params} active="/pilotage/temps" />
      <FilterBar
        campaigns={data.campaigns}
        owners={data.owners}
        niches={data.niches}
        groups={data.groups}
        sources={data.sources}
      />

      <section className="space-y-3">
        <TimelineToolbar />
        <TimelineChart
          points={points}
          view={chartView}
          channels={channels}
          peak={peakOf(series, chartView, channels)}
          metricLabel={timelineMetricLabel(metric)}
          granularityLabel={GRANULARITY_LABELS[granularity]}
          rangeNote={rangeNote(series, range.note)}
        />
        <WeekPaceStrip pace={weekPace(all, now, data.targets.messages)} />
      </section>
    </div>
  );
}
