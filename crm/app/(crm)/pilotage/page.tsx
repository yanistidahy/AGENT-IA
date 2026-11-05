import { FilterBar } from "@/components/pilotage/filter-bar";
import { KpiTiles, type Tile } from "@/components/pilotage/kpi-tiles";
import { WeeklyChart } from "@/components/pilotage/weekly-chart";
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
  weeklySeries,
  type Breakdown,
  type Metric,
} from "@/lib/domain/pilotage";

export const dynamic = "force-dynamic";

/** Douze semaines : un trimestre, assez pour voir une tendance sans la noyer. */
const WEEKS = 12;

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
      key: row.campaignId ?? "hors-campagne",
      label: row.campaignName === "" ? "Hors campagne" : row.campaignName,
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

  const uncategorised = uncategorisedReplies(rows).length;

  return (
    <div className="px-6 py-5">
      <header className="mb-3">
        <h1 className="font-display text-xl font-semibold tracking-tight">Pilotage</h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {period.label} · tout vient du journal des événements de prospection, une ligne par fait.
        </p>
      </header>

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

          <section className="mb-4">
            <WeeklyChart
              points={weeklySeries(all, now, WEEKS)}
              target={data.targets.messages}
            />
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
