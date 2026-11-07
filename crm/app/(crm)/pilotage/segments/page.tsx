import Link from "next/link";
import { BoardTabs } from "@/components/pilotage/board-tabs";
import { BoardHeader } from "@/components/pilotage/board-header";
import { FilterBar } from "@/components/pilotage/filter-bar";
import { SizeCards, SizeChips } from "@/components/pilotage/size-cards";
import { RateEvolution, type RateSeriesView } from "@/components/pilotage/rate-evolution";
import { ContactedBars, type BarGroup } from "@/components/pilotage/contacted-bars";
import { NicheTable } from "@/components/pilotage/niche-table";
import { pilotageView } from "@/lib/api/pilotage-view";
import { listHref, one, sameHere } from "@/lib/domain/board-links";
import { rateLabel, type Metric } from "@/lib/domain/pilotage";
import {
  compareCards,
  contactedBars,
  nicheLines,
  restrictToSize,
  rateSeries,
  segmentBuckets,
  sizeCard,
  sizesWithData,
  toNicheSort,
  toRateMode,
  visitorCoverage,
  RATE_MODE_LABELS,
} from "@/lib/domain/segments";
import { SIZE_SHORT, isSizeBucket, type SizeBucket } from "@/lib/domain/size-buckets";
import { toGranularity, GRANULARITY_LABELS } from "@/lib/domain/timeline";

export const dynamic = "force-dynamic";

/** Les deux tranches comparées, et celles qui restent en puces. */
const COMPARED: readonly SizeBucket[] = ["small", "large"];
const ASIDE: readonly SizeBucket[] = ["mid", "unknown", "micro"];

/**
 * **Onglet 3 — Segments : les petites marques répondent-elles mieux ?**
 *
 * Un onglet, une question, et un bandeau qui conditionne sa lecture : deux
 * cartes qui comparent petites et grosses sur un tiers des fiches ne décrivent
 * pas la prospection, elles décrivent le tiers qu'on a pris la peine de
 * renseigner. Le dire d'abord est la seule façon honnête d'afficher la suite.
 *
 * Tous les chiffres viennent de `lib/domain/segments.ts`, qui les tire lui-même
 * de `replyRate` et `funnel` — les fonctions des pastilles. Il n'y a donc pas un
 * taux « pour le graphique » et un autre « pour la carte », et c'est exactement
 * là qu'un tel écart se réinstalle.
 */
export default async function SegmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = await pilotageView(params);
  const { data, period, rows, all, now } = view;

  const granularity = toGranularity(one(params, "pas"));
  const mode = toRateMode(one(params, "mode"));
  const sort = toNicheSort(one(params, "tri"));
  const nicheScope = isSizeBucket(one(params, "tranche")) ? (one(params, "tranche") as SizeBucket) : null;

  const coverage = visitorCoverage(rows);
  const cards = COMPARED.map((bucket) => sizeCard(all, rows, period, bucket));
  const comparison = cards.length === 2 ? compareCards(cards[0]!, cards[1]!) : null;
  const aside = sizesWithData(rows, ASIDE).map((bucket) => sizeCard(all, rows, period, bucket));

  const buckets = segmentBuckets(all, granularity, now);
  const sizeHref = (bucket: string, metric: Metric) => listHref(params, metric, { taille: bucket }, "/pilotage/segments");

  const BANDS: Record<string, { color: string; dash: string; marker: "circle" | "square" }> = {
    small: { color: "var(--color-brand)", dash: "", marker: "circle" },
    large: { color: "var(--color-accent-2)", dash: "6 4", marker: "square" },
  };

  const series: readonly RateSeriesView[] = COMPARED.map((bucket) => {
    const line = rateSeries(all, buckets, bucket, mode);
    const band = BANDS[bucket] ?? BANDS.small!;
    return {
      bucket,
      label: SIZE_SHORT[bucket],
      color: band.color,
      dash: band.dash,
      marker: band.marker,
      points: line.points.map((point) => ({
        key: point.bucket.key,
        short: point.bucket.short,
        exact: point.bucket.exact,
        rate: point.rate,
        n: point.n,
        replied: point.replied,
        weak: point.reliability === "unusable",
        href: listHref(params, "contacted", {
          taille: bucket,
          periode: "libre",
          du: point.bucket.fromKey,
          au: point.bucket.toKey,
        }, "/pilotage/segments"),
      })),
    };
  });

  const groups: readonly BarGroup[] = contactedBars(all, buckets, COMPARED).map((bar) => ({
    key: bar.bucket.key,
    short: bar.bucket.short,
    exact: bar.bucket.exact,
    values: bar.values.map((value) => ({
      bucket: value.bucket,
      label: SIZE_SHORT[value.bucket],
      count: value.count,
      // Les grosses sont hachurées : la couleur seule ne distingue rien en noir
      // et blanc, ni pour un daltonien.
      hatched: value.bucket === "large",
      color: BANDS[value.bucket]?.color ?? "var(--color-brand)",
      href: listHref(params, "contacted", {
        taille: value.bucket,
        periode: "libre",
        du: bar.bucket.fromKey,
        au: bar.bucket.toKey,
      }, "/pilotage/segments"),
    })),
  }));

  /*
    **Le tableau par niche se restreint à une tranche sans toucher au filtre de
    page.** `tranche=` est un réglage local à cet onglet : poser le filtre
    `taille=` restreindrait aussi les deux cartes du dessus, et on comparerait
    alors les petites… aux petites.
  */
  const nicheRows = restrictToSize(rows, nicheScope);
  const lines = nicheLines(all, nicheRows, period, buckets, sort);

  const sizeTabs = [
    { label: "Toutes tailles", href: sameHere("/pilotage/segments", params, { tranche: "" }), active: nicheScope === null },
    ...COMPARED.map((bucket) => ({
      label: SIZE_SHORT[bucket],
      href: sameHere("/pilotage/segments", params, { tranche: bucket }),
      active: nicheScope === bucket,
    })),
  ];

  const weakWeeks = series.some((line) => line.points.some((point) => point.weak));

  return (
    <div className="min-h-full bg-board px-6 py-5">
      <BoardHeader period={period.label} />
      <BoardTabs params={params} active="/pilotage/segments" />
      <FilterBar
        campaigns={data.campaigns}
        owners={data.owners}
        niches={data.niches}
        groups={data.groups}
        sources={data.sources}
      />

      {/*
        **Le bandeau de couverture ouvre l'onglet, et il est un lien.**

        Nommer le trou sans donner le geste qui le comble serait un reproche. Le
        lien ouvre les personnes dont la marque n'a pas de trafic renseigné —
        c'est-à-dire la liste des fiches à compléter.
      */}
      <p
        data-coverage
        className="mb-4 rounded-board border border-line bg-surface px-4 py-3 text-[12.5px] leading-relaxed text-closed"
      >
        <strong className="text-ink">
          Trafic renseigné pour {coverage.known.length} personne
          {coverage.known.length > 1 ? "s" : ""} sur {coverage.total.length}
        </strong>{" "}
        ({rateLabel(coverage.share)}). Les marques sans trafic tombent dans « Non renseigné » et ne
        comptent dans aucune des deux cartes ci-dessous.{" "}
        <Link
          href={listHref(params, "contacted", { taille: "unknown" }, "/pilotage/segments")}
          data-coverage-link
          className="font-semibold text-brand-d hover:underline"
        >
          Voir les {coverage.total.length - coverage.known.length} à compléter
        </Link>
        {data.companiesWithoutVisitors > 0 ? (
          <span className="text-muted">
            {" "}
            · {data.companiesWithoutVisitors} société
            {data.companiesWithoutVisitors > 1 ? "s" : ""} sans trafic en base, le nombre se saisit sur
            sa fiche.
          </span>
        ) : null}
      </p>

      <section className="mb-4">
        <SizeCards cards={cards} comparison={comparison} href={sizeHref} />
      </section>

      <section className="mb-4">
        <SizeChips cards={aside} href={sizeHref} />
      </section>

      <section className="mb-4 grid gap-3 xl:grid-cols-2">
        <RateEvolution
          series={series}
          modeHref={sameHere("/pilotage/segments", params, {
            mode: mode === "cumule" ? "periode" : "cumule",
          })}
          modeLabel={RATE_MODE_LABELS[mode]}
          subtitle={
            mode === "cumule"
              ? `Taux cumulé depuis le premier message, par ${GRANULARITY_LABELS[granularity].toLowerCase()}. Les points creux portent moins de dix personnes.`
              : weakWeeks
                ? `Taux de la ${GRANULARITY_LABELS[granularity].toLowerCase()} seule : les échantillons par période sont trop petits pour être interprétés, d'où les points creux. Le cumulé est plus lisible.`
                : `Taux de la ${GRANULARITY_LABELS[granularity].toLowerCase()} seule.`
          }
        />
        <ContactedBars groups={groups} />
      </section>

      <NicheTable
        lines={lines}
        sort={sort}
        sortHref={(key) => sameHere("/pilotage/segments", params, { tri: key })}
        sizeTabs={sizeTabs}
        cellHref={(line, column) => {
          const metric: Partial<Record<string, Metric>> = {
            contactees: "contacted",
            reponses: "replies",
            demos: "demos_sent",
            qualifiees: "qualified",
          };
          const key = metric[column];
          if (key === undefined) return null;
          return listHref(
            params,
            key,
            { niche: line.key, ...(nicheScope === null ? {} : { taille: nicheScope }) },
            "/pilotage/segments",
          );
        }}
      />
    </div>
  );
}
