import { FilterBar } from "@/components/pilotage/filter-bar";
import { ManualCounter } from "@/components/pilotage/manual-counter";
import { KpiTiles, type Tile } from "@/components/pilotage/kpi-tiles";
import { TimelineToolbar } from "@/components/pilotage/timeline-toolbar";
import { TimelineChart } from "@/components/pilotage/timeline-chart";
import { WeekPaceStrip } from "@/components/pilotage/week-pace";
import { FunnelView } from "@/components/pilotage/funnel-view";
import {
  BREAKDOWN_COLUMNS,
  BreakdownTable,
  type BreakdownSort,
} from "@/components/pilotage/breakdown-table";
import { parsePilotageQuery, periodOf, readPilotage } from "@/lib/api/pilotage";
import {
  NO_DATA,
  SEGMENT_LABELS,
  applyFilters,
  breakdown,
  funnel,
  metricResult,
  rateLabel,
  replyRate,
  slice,
  uncategorisedReplies,
  type Breakdown,
  type Metric,
  campaignKey,
  campaignLabel,
} from "@/lib/domain/pilotage";
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

/** Douze semaines : un trimestre, assez pour voir une tendance sans la noyer. */

/**
 * **Pilotage — un seul tableau de bord, sur un seul journal.**
 *
 * Aucun chiffre n'est calculé ici : chacun sort de `lib/domain/pilotage.ts`, et
 * `tests/pilotage-source.test.ts` échoue si cette page se met à compter. Ce
 * n'est pas une règle d'élégance — c'est ce qui garantit qu'une pastille et la
 * liste qu'elle ouvre sortent du **même** appel (jalons 49, 78, 105).
 *
 * Les lignes sont filtrées **une fois** (`applyFilters`) et ce même tableau sert
 * les pastilles, le graphique, l'entonnoir et les deux tableaux : deux
 * filtrages, même écrits avec le même prédicat, laissent la possibilité d'en
 * appeler un sur un tableau et l'autre sur un autre.
 */
export default async function PilotagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = parsePilotageQuery(params);
  /** Un paramètre d'URL, en une valeur. Les trois réglages du graphique y vivent. */
  const readOne = (key: string): string => {
    const value = params[key];
    return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  };
  const now = new Date();
  const period = periodOf(query, now);

  const data = await readPilotage();
  const all = applyFilters(data.rows, query.filters);
  const rows = slice(all, period);

  const metric = (key: Metric) => metricResult(all, rows, period, key);
  const week = metric("messages");
  /*
    **La cible ne s'affiche que sur la semaine en cours.**

    Elle est hebdomadaire : la comparer au mois écoulé ou à une plage libre de
    trois jours donnerait un pourcentage qui ne veut rien dire — « 310 % de la
    cible » sur un mois, « 12 % » sur deux jours. Hors de la semaine courante,
    la pastille garde son chiffre et perd sa barre, ce qui est le fait.
  */
  const weekly = query.periodKey === "semaine";
  const targetOf = (value: number) => (weekly ? value : null);
  const sort = sortOf(params);
  const dir = dirOf(params);

  const tiles: readonly Tile[] = [
    {
      metric: "messages",
      label: "Messages envoyés",
      value: String(week.count),
      actual: week.count,
      target: targetOf(data.targets.messages),
    },
    {
      metric: "new_contacted",
      label: "Nouvelles personnes",
      value: String(metric("new_contacted").count),
      actual: metric("new_contacted").count,
      target: null,
      hint: "Premier message dans la période",
    },
    {
      metric: "replies",
      label: "Réponses",
      value: String(metric("replies").count),
      actual: metric("replies").count,
      target: null,
    },
    {
      metric: null,
      label: "Taux de réponse",
      value: rateLabel(replyRate(rows)),
      actual: null,
      target: null,
      hint: "Personnes qui ont répondu sur personnes contactées",
    },
    {
      metric: "demos_sent",
      label: "Démos envoyées",
      value: String(metric("demos_sent").count),
      actual: metric("demos_sent").count,
      target: targetOf(data.targets.demos),
    },
    {
      metric: "qualified",
      label: "Démos qualifiées",
      value: String(metric("qualified").count),
      actual: metric("qualified").count,
      target: targetOf(data.targets.qualified),
    },
  ];

  const steps = funnel(all, rows, period);
  const byCampaign = sortLines(
    breakdown(all, rows, period, (row) => ({
      key: campaignKey(row),
      label: campaignLabel(row),
    })),
    sort,
    dir,
  );
  const bySegment = sortLines(
    breakdown(all, rows, period, (row) => ({
      key: row.segment,
      label: SEGMENT_LABELS[row.segment],
    })),
    sort,
    dir,
  );
  const byGroup = sortLines(
    breakdown(all, rows, period, (row) => ({ key: row.group, label: row.group })),
    sort,
    dir,
  );

  const base = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const single = Array.isArray(value) ? value[0] : value;
    if (single !== undefined && single !== "") base.set(key, single);
  }

  const listHref = (key: Metric, extra: Record<string, string> = {}) => {
    const next = new URLSearchParams(base.toString());
    next.set("metric", key);
    for (const [name, value] of Object.entries(extra)) next.set(name, value);
    next.delete("tri");
    next.delete("sens");
    return `/pilotage/liste?${next.toString()}`;
  };

  const sortHref = (key: BreakdownSort) => {
    const next = new URLSearchParams(base.toString());
    next.set("tri", key);
    next.set("sens", sort === key && dir === "desc" ? "asc" : "desc");
    return `/pilotage?${next.toString()}`;
  };

  const toggleHref = () => {
    const next = new URLSearchParams(base.toString());
    if (query.asShare) next.delete("part");
    else next.set("part", "1");
    return `/pilotage?${next.toString()}`;
  };

  /*
    **Le graphique « Dans le temps », refondu au jalon 113.**

    Tout est calculé ici, côté serveur, par les fonctions de
    `lib/domain/timeline.ts` : la vue ne reçoit que des coordonnées et des
    liens. La valeur d'un point sort de `metricResult`, la même fonction que la
    liste qu'il ouvre — c'est ce qui rend l'item 3 du test d'acceptation vrai
    par construction plutôt que par vigilance.
  */
  const granularity = toGranularity(readOne("pas"));
  const view = toTimelineView(readOne("vue"));
  const timelineMetric = toTimelineMetric(readOne("metric"));
  const weeklyTarget = weeklyTargetFor(timelineMetric, data.targets);

  const range = timelineRange(all, period, query.periodKey === "libre", now);
  const series = trimLeadingEmpty(
    buildSeries(
      all,
      bucketsBetween(range.from, range.to, granularity),
      timelineMetric,
      granularity,
      weeklyTarget,
    ),
  );
  const timelineChannels = channelsWithData(series);
  const timelinePoints = series.map((point) => ({
    key: point.bucket.key,
    short: point.bucket.short,
    exact: point.bucket.exact,
    total: point.total,
    target: point.target,
    previous: point.previous,
    byChannel: point.byChannel,
    bySource: point.bySource,
    href: listHref(timelineMetric, {
      periode: "libre",
      du: point.bucket.fromKey,
      au: point.bucket.toKey,
    }),
    channelHref: Object.fromEntries(
      timelineChannels.map((channel) => [
        channel,
        listHref(timelineMetric, {
          periode: "libre",
          du: point.bucket.fromKey,
          au: point.bucket.toKey,
          canal: channel,
        }),
      ]),
    ),
  }));

  const uncategorised = uncategorisedReplies(rows).length;

  return (
    <div className="px-6 py-5">
      <header className="mb-3">
        <h1 className="font-display text-xl font-semibold tracking-tight">Pilotage</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {period.label} · tout vient du journal des événements de prospection, une ligne par fait.
        </p>
      </header>

      {/*
        **Le compteur est au-dessus de la barre de filtres, et avant l'état
        vide.**

        Deux raisons, dans cet ordre. D'abord l'usage : on vient d'envoyer trois
        DM depuis son téléphone, on ouvre l'écran pour *compter*, pas pour lire
        — le geste doit être le premier chose atteignable, sans défilement et
        sans réglage préalable. Ensuite, c'est l'erreur du jalon 19 à ne pas
        refaire : le bandeau de sauvegarde vivait **après** les retours
        anticipés « base vide », donc il disparaissait exactement quand il
        comptait. Un compteur rendu après `rows.length === 0` serait invisible
        sur une base neuve, c'est-à-dire le jour où l'on en a le plus besoin.
      */}
      <section className="mb-3">
        <ManualCounter
          owners={data.owners}
          contacts={data.contactOptions}
          initialToday={data.manual.today}
          initialHistory={data.manual.history.map((entry) => ({
            ...entry,
            at: entry.at.toISOString(),
          }))}
        />
      </section>

      <FilterBar campaigns={data.campaigns} owners={data.owners} />

      {rows.length === 0 ? (
        <p className="rounded-card border border-line bg-surface px-4 py-6 text-[13px] text-muted">
          {NO_DATA} Changez la période ou retirez un filtre.
        </p>
      ) : (
        <>
          <section className="mb-4">
            <KpiTiles tiles={tiles} href={(key) => listHref(key)} />
          </section>

          <section className="mb-4 space-y-3">
            <TimelineToolbar />
            <TimelineChart
              points={timelinePoints}
              view={view}
              channels={timelineChannels}
              peak={peakOf(series, view, timelineChannels)}
              metricLabel={timelineMetricLabel(timelineMetric)}
              granularityLabel={GRANULARITY_LABELS[granularity]}
              rangeNote={rangeNote(series, range.note)}
            />
            <WeekPaceStrip pace={weekPace(all, now, data.targets.messages)} />
          </section>

          <section className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <FunnelView
              steps={steps}
              asShare={query.asShare}
              toggleHref={toggleHref()}
              href={(key) => listHref(key)}
            />
            <div className="space-y-3">
              {uncategorised > 0 && (
                <p className="rounded-card border border-line bg-surface px-4 py-3 text-[12.5px] leading-relaxed text-muted">
                  <strong className="text-ink">
                    {uncategorised} réponse{uncategorised > 1 ? "s" : ""} sans catégorie.
                  </strong>{" "}
                  Elles comptent dans les réponses, et dans aucune catégorie — rien n'est deviné.
                  Classez-les depuis la fiche du contact pour qu'elles entrent dans « réponse
                  positive ».
                </p>
              )}
              {data.companiesWithoutVisitors > 0 && (
                <p className="rounded-card border border-line bg-surface px-4 py-3 text-[12.5px] leading-relaxed text-muted">
                  <strong className="text-ink">
                    {data.companiesWithoutVisitors} société
                    {data.companiesWithoutVisitors > 1 ? "s" : ""} sans visiteurs mensuels.
                  </strong>{" "}
                  Leurs fiches comptent dans « non renseigné » du tableau par segment. Le nombre se
                  saisit sur la fiche de la société.
                </p>
              )}
            </div>
          </section>

          <section className="mb-4 space-y-3">
            <BreakdownTable
              title="Campagnes côte à côte"
              lines={byCampaign}
              sort={sort}
              dir={dir}
              sortHref={sortHref}
              cellHref={(line, column) => cellHref(line, column, listHref, "campagne")}
            />
            <BreakdownTable
              title="Par segment"
              hint="Taille de marque, d'après les visiteurs mensuels"
              lines={bySegment}
              sort={sort}
              dir={dir}
              sortHref={sortHref}
              cellHref={(line, column) => cellHref(line, column, listHref, "segment")}
            />
            <BreakdownTable
              title="Par groupe de fonction"
              lines={byGroup}
              sort={sort}
              dir={dir}
              sortHref={sortHref}
              cellHref={() => null}
            />
          </section>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ le tri ------ */

function sortOf(params: Record<string, string | string[] | undefined>): BreakdownSort {
  const raw = Array.isArray(params.tri) ? params.tri[0] : params.tri;
  const found = BREAKDOWN_COLUMNS.find((column) => column.key === raw);
  return found?.key ?? "messages";
}

function dirOf(params: Record<string, string | string[] | undefined>): "asc" | "desc" {
  const raw = Array.isArray(params.sens) ? params.sens[0] : params.sens;
  return raw === "asc" ? "asc" : "desc";
}

/**
 * Le tri des lignes de regroupement.
 *
 * Les valeurs absentes sortent en fin **dans les deux sens** : inverser un tri
 * ne doit pas ramener les lignes vides en tête (la règle du jalon 30). Aucun
 * `localeCompare` : il suit la locale du conteneur, donc l'ordre changerait d'un
 * environnement à l'autre (jalon 72).
 */
function sortLines(lines: readonly Breakdown[], sort: BreakdownSort, dir: "asc" | "desc"): Breakdown[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...lines].sort((a, b) => {
    if (sort === "label") return a.label < b.label ? -sign : a.label > b.label ? sign : 0;
    if (sort === "replyRate") {
      if (a.replyRate === null && b.replyRate === null) return 0;
      if (a.replyRate === null) return 1;
      if (b.replyRate === null) return -1;
      return (a.replyRate - b.replyRate) * sign;
    }
    const left = a[sort];
    const right = b[sort];
    return (Number(left) - Number(right)) * sign;
  });
}

/** La cellule d'un tableau ouvre la même liste que la pastille, bornée à sa ligne. */
function cellHref(
  line: Breakdown,
  column: BreakdownSort,
  listHref: (key: Metric, extra?: Record<string, string>) => string,
  axis: "campagne" | "segment",
): string | null {
  const metric: Partial<Record<BreakdownSort, Metric>> = {
    contacted: "contacted",
    messages: "messages",
    replies: "replies",
    demos: "demos_sent",
    qualified: "qualified",
  };
  const key = metric[column];
  if (key === undefined) return null;
  if (axis === "campagne" && line.key === "hors-campagne") return null;
  return listHref(key, { [axis]: line.key });
}
