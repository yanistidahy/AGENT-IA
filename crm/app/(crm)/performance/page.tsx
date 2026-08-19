import { readPerformance } from "@/lib/api/performance";
import { PERIOD_LABELS, PERIODS, type PeriodKind } from "@/lib/domain/performance";
import { ACTIVITY_LABELS } from "@/lib/domain/types";
import { FunnelRow } from "@/components/emails/funnel-row";
import { StackedBars } from "@/components/performance/stacked-bars";
import { PerfFilters } from "@/components/performance/perf-filters";
import { OwnerTable } from "@/components/performance/owner-table";
import { ConsistencyBlock } from "@/components/performance/consistency-block";
import {
  CallOutcomes,
  ChannelRates,
  StatCard,
} from "@/components/performance/perf-cards";

export const dynamic = "force-dynamic";

/**
 * « Ma performance » — l'activité de la personne, pas des fiches.
 *
 * L'ordre de la page suit la question : combien j'ai travaillé (volume par
 * canal, par jour, comparé), ce que ça a produit (premiers contacts, réponses
 * par canal, RDV, qualifiés), qui fait quoi (Yanis et Mohamed côte à côte), et
 * la régularité — qui compte plus que les totaux.
 *
 * **La ligne d'honnêteté est en tête, pas en pied de page** : cet écran mesure
 * ce qui est consigné. Une baisse de saisie s'y lirait comme une baisse de
 * travail, et il faut l'avoir lu avant les chiffres, pas après.
 */

const VS: Record<PeriodKind, string> = {
  jour: "vs hier",
  semaine: "vs la semaine dernière (complète)",
  mois: "vs le mois dernier (complet)",
  "90j": "vs les 90 jours précédents",
  libre: "vs la période précédente de même longueur",
};

function toPeriod(raw: string | string[] | undefined): PeriodKind {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return PERIODS.find((candidate) => candidate === value) ?? "semaine";
}

function toDate(raw: string | string[] | undefined): Date | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined) return undefined;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const kind = toPeriod(raw.periode);
  const who = Array.isArray(raw.qui) ? raw.qui[0] : raw.qui;

  const perf = await readPerformance({
    period: kind,
    owner: who,
    from: toDate(raw.du),
    to: toDate(raw.au),
  });

  const vs = VS[kind];
  const calls = perf.channels.find((channel) => channel.channel === "call");
  const emails = perf.channels.find((channel) => channel.channel === "email");
  const meetings = perf.channels.filter(
    (channel) => channel.channel === "meeting" || channel.channel === "demo",
  );
  const linkedin = perf.channels.find((channel) => channel.channel === "linkedin");

  return (
    <div className="px-6 py-5">
      <header className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-xl font-semibold tracking-tight">Ma performance</h1>
        <p className="text-[12.5px] text-muted">
          {PERIOD_LABELS[kind]}
          {perf.owner !== null && ` · ${perf.owner}`} — cet écran mesure ce qui est{" "}
          <strong>consigné</strong>, pas ce qui est fait : un appel jamais consigné n'existe
          pas ici.
        </p>
      </header>

      <PerfFilters perf={perf} kind={kind} />

      {/* — le volume — */}
      <section className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <StatCard
            label="Appels consignés"
            value={String(calls?.count.current ?? 0)}
            delta={calls?.count}
            vs={vs}
          />
          <CallOutcomes outcomes={perf.callOutcomes} />
        </div>
        <StatCard
          label="Emails envoyés"
          value={String(emails?.count.current ?? 0)}
          delta={emails?.count}
          vs={vs}
        />
        <StatCard
          label="Réunions et démos"
          value={String(meetings.reduce((sum, channel) => sum + channel.count.current, 0))}
          hint={meetings
            .filter((channel) => channel.count.current > 0)
            .map((channel) => `${ACTIVITY_LABELS[channel.channel]} : ${channel.count.current}`)
            .join(" · ")}
        />
        <StatCard
          label="LinkedIn"
          value={String(linkedin?.count.current ?? 0)}
          delta={linkedin?.count}
          vs={vs}
        />
      </section>

      <section className="mb-4 rounded-card border border-line bg-surface px-3.5 py-3 shadow-card">
        <h2 className="mb-2 font-display text-[13px] font-semibold">
          Par jour — {perf.total.current} interaction{perf.total.current > 1 ? "s" : ""}{" "}
          <span className="font-sans text-[11px] font-normal text-muted">
            {perf.total.diff === 0
              ? `= ${vs}`
              : `${perf.total.diff > 0 ? "+" : "−"}${Math.abs(perf.total.diff)} ${vs}`}
          </span>
        </h2>
        {perf.total.current === 0 ? (
          <p className="py-4 text-center text-[12.5px] text-muted">
            Rien de consigné sur la période — et c'est exactement ce que ce graphique doit
            montrer.
          </p>
        ) : (
          <StackedBars stacks={perf.perDay} />
        )}
      </section>

      {/* — ce que ça a produit — */}
      <section className="mb-4">
        <h2 className="mb-2 font-display text-[13px] font-semibold">Ce que ça a produit</h2>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="grid gap-2 content-start">
            <StatCard
              label="Contacts atteints pour la 1re fois"
              value={String(perf.firstReached.current)}
              delta={perf.firstReached}
              vs={vs}
              hint="Le débit de prospection : des fiches jamais touchées avant."
            />
            <StatCard
              label="RDV obtenus"
              value={String(perf.booked.current)}
              delta={perf.booked}
              vs={vs}
            />
            <StatCard
              label="Qualifiés"
              value={String(perf.qualified.current)}
              delta={perf.qualified}
              vs={vs}
              hint={
                perf.dealsWon > 0
                  ? `Affaires ouvertes sur la période · ${perf.dealsWon} gagnée${perf.dealsWon > 1 ? "s" : ""}`
                  : "Affaires ouvertes sur la période."
              }
            />
          </div>
          <div className="rounded-card border border-line bg-surface px-3.5 py-3 shadow-card">
            <h3 className="mb-1.5 text-[11px] font-medium tracking-wide text-muted uppercase">
              Réponses par canal — sur les issues connues
            </h3>
            <ChannelRates channels={perf.channels} />
          </div>
        </div>
      </section>

      <section className="mb-4">
        <FunnelRow steps={perf.funnel} />
      </section>

      {/* — par personne — */}
      <section className="mb-4">
        <OwnerTable lines={perf.perOwner} />
      </section>

      <section className="mb-4 lg:max-w-[560px]">
        <ConsistencyBlock perf={perf} />
      </section>
    </div>
  );
}
