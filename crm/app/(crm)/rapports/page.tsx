import Link from "next/link";
import { BarChart, DonutChart, LineChart } from "@/components/charts/primitives";
import { Funnel } from "@/components/charts/funnel";
import { Eyebrow } from "@/components/ui/primitives";
import { parsePeriod, readReports } from "@/lib/api/reports";
import { money, moneyShort, percent } from "@/lib/format";

export const dynamic = "force-dynamic";

const PERIOD_LABELS: Array<{ value: string; label: string }> = [
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
  { value: "365", label: "1 an" },
  { value: "all", label: "Tout" },
];

/**
 * Rapports.
 *
 * La période est dans l'URL, comme tous les filtres du produit : un rapport est
 * partageable tel qu'on l'a lu. Les graphiques sont des composants serveur —
 * cette page n'envoie aucun JavaScript au navigateur.
 */
export default async function RapportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const rawPeriod = raw.periode;
  const period = parsePeriod(Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod);
  const current = period === null ? "all" : String(period);

  const data = await readReports(period);

  return (
    <div className="px-6 py-6">
      <header className="mb-5 flex flex-wrap items-end gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Rapports</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {data.wonCount} gagnées · {data.lostCount} perdues sur la période
          </p>
        </div>
        <div className="ml-auto flex overflow-hidden rounded-control border border-line bg-surface">
          {PERIOD_LABELS.map((option) => (
            <Link
              key={option.value}
              href={`/rapports?periode=${option.value}`}
              className={`border-r border-line px-3 py-1.5 text-[12.5px] font-semibold transition-colors last:border-r-0 ${
                current === option.value ? "bg-ink text-white" : "text-muted hover:bg-surface-2"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </header>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="CA signé" value={moneyShort(data.revenue)} />
        <Kpi label="Taux de closing" value={percent(data.winRate)} />
        <Kpi label="Cycle moyen" value={`${data.cycle} j`} />
        <Kpi label="Panier moyen" value={moneyShort(data.averageDeal)} />
        <Kpi label="Rétention" value={percent(data.retention)} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="CA signé par mois">
          <BarChart
            points={data.revenueByMonth.map((p) => ({ label: p.month, value: p.value }))}
          />
        </Card>

        <Card title="Prévision pondérée" hint="par mois de clôture prévue, affaires en cours">
          <BarChart points={data.forecast.map((p) => ({ label: p.month, value: p.value }))} />
        </Card>
      </div>

      <Card title="Entonnoir de conversion" className="mt-5">
        <Funnel rows={data.funnel} />
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="Nouveaux contacts par mois">
          <LineChart
            points={data.leadsByMonth.map((p) => ({ label: p.label, value: p.value }))}
            format={(value) => String(value)}
          />
        </Card>

        <Card title="Contacts par source" hint="sur la période">
          <DonutChart points={data.leadsBySource} />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card title="CA par offre">
          <DonutChart points={data.revenueByOffer} />
        </Card>

        <Card title="Performance par propriétaire">
          {data.owners.length === 0 ? (
            <p className="rounded-card border border-dashed border-line px-3.5 py-6 text-center text-[12.5px] text-muted">
              Aucun propriétaire d'affaire renseigné.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    {["Propriétaire", "CA", "Gagnées", "Appels", "Emails", "Démos"].map(
                      (label, index) => (
                        <th
                          key={label}
                          scope="col"
                          className={`border-b border-line px-2.5 py-2 font-mono text-[9.5px] font-medium tracking-[0.12em] text-muted uppercase ${
                            index === 0 ? "text-left" : "text-right"
                          }`}
                        >
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.owners.map((row) => (
                    <tr key={row.owner}>
                      <td className="border-b border-line-2 px-2.5 py-2 text-[13px] font-semibold">
                        {row.owner}
                      </td>
                      <td className="border-b border-line-2 px-2.5 py-2 text-right font-mono text-[12.5px] tabular-nums">
                        {money(row.revenue)}
                      </td>
                      {[row.won, row.calls, row.emails, row.demos].map((value, index) => (
                        <td
                          key={index}
                          className="border-b border-line-2 px-2.5 py-2 text-right font-mono text-[12.5px] text-muted tabular-nums"
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3 shadow-card">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Card({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-card border border-line bg-surface p-4 shadow-card ${className ?? ""}`}
    >
      <h2 className="mb-3 flex flex-wrap items-baseline gap-2 font-display text-sm font-semibold">
        {title}
        {hint !== undefined && (
          <span className="text-[12px] font-normal text-muted">{hint}</span>
        )}
      </h2>
      {children}
    </section>
  );
}
