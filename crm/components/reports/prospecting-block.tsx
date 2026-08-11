import Link from "next/link";
import { BarChart } from "@/components/charts/primitives";
import { EmptyChart } from "@/components/charts/empty-chart";
import { Eyebrow } from "@/components/ui/primitives";
import type { ProspectingReport } from "@/lib/api/prospecting";
import { ACTIVITY_LABELS } from "@/lib/domain/types";

/**
 * Le bloc Prospection.
 *
 * Il passe **avant** la vente, et il est le seul affiché tant qu'aucune affaire
 * n'existe. La raison est simple : l'activité du jour est d'appeler des gens, et
 * un écran qui ne sait mesurer que le closing affiche zéro partout à quelqu'un
 * qui travaille beaucoup.
 *
 * Chaque graphique vide dit pourquoi il l'est. C'est ce qui distingue « rien à
 * mesurer » de « quelque chose est cassé », et les deux se ressemblent
 * exactement quand on ne dit rien.
 */
export function ProspectingBlock({ data }: { data: ProspectingReport }) {
  const rhythm = data.rhythm.map((week) => ({ label: week.label, value: week.total }));
  const noActivity = data.totals.activities === 0;

  return (
    <section className="mb-7">
      <h2 className="mb-3 font-display text-[17px] font-semibold">Prospection</h2>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Rythme" hint="interactions consignées par semaine, sur 12 semaines">
          {noActivity ? (
            <EmptyChart
              title="Rythme"
              reason="Aucune interaction consignée sur les douze dernières semaines."
              action="Consignez un appel depuis une fiche contact."
              href="/contacts"
            />
          ) : (
            <>
              <BarChart points={rhythm} format={(value) => String(value)} height={140} />
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted">
                {byTypeTotals(data).map((row) => (
                  <li key={row.label}>
                    <b className="font-mono font-semibold text-ink tabular-nums">{row.value}</b>{" "}
                    {row.label}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        <Panel
          title="Taux de réponse par canal"
          hint="sur les échanges dont l'issue est renseignée"
        >
          {data.channels.length === 0 ? (
            <EmptyChart
              title="Taux de réponse par canal"
              reason="Aucun échange consigné : il n'y a pas encore de canal à comparer."
            />
          ) : (
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left font-mono text-[9.5px] tracking-[0.12em] text-muted uppercase">
                  <th className="pb-1">Canal</th>
                  <th className="pb-1 text-right">Échanges</th>
                  <th className="pb-1 text-right">Issue connue</th>
                  <th className="pb-1 text-right">Réponse</th>
                </tr>
              </thead>
              <tbody>
                {data.channels.map((row) => (
                  <tr key={row.channel} className="border-t border-line-2">
                    <td className="py-1.5">{ACTIVITY_LABELS[row.channel]}</td>
                    <td className="py-1.5 text-right font-mono tabular-nums">{row.total}</td>
                    <td className="py-1.5 text-right font-mono text-muted tabular-nums">
                      {row.known}
                    </td>
                    <td className="py-1.5 text-right font-mono font-semibold tabular-nums">
                      {/* `null` et non « 0 % » : sans issue renseignée, il n'y a
                          pas d'échec à constater, il y a une saisie à faire. */}
                      {row.rate === null ? (
                        <span className="font-normal text-muted">issue non renseignée</span>
                      ) : (
                        `${row.rate} %`
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title="Délai avant premier contact" hint="médiane, et l'arriéré qui attend">
          <div className="grid grid-cols-2 gap-3">
            <Figure
              label="Médiane"
              value={
                data.firstTouch.medianDays === null ? "—" : `${data.firstTouch.medianDays} j`
              }
              hint={
                data.firstTouch.medianDays === null
                  ? "aucune fiche n'a encore été approchée"
                  : `sur ${data.firstTouch.touched} fiche(s) touchée(s)`
              }
            />
            <Figure
              label="Jamais approchés"
              value={String(data.firstTouch.untouched)}
              hint={
                data.firstTouch.untouchedMedianAgeDays === null
                  ? "aucun"
                  : `en attente depuis ${data.firstTouch.untouchedMedianAgeDays} j en médiane`
              }
              href="/contacts?lifecycle=all&followUp=never"
            />
          </div>
        </Panel>

        <Panel title="Discipline de relance" hint="tenues à l'échéance contre manquées">
          {data.discipline.every((week) => week.honoured + week.missed === 0) ? (
            <EmptyChart
              title="Discipline de relance"
              reason="Aucune relance programmée n'est arrivée à échéance sur la période."
              action="Programmez une relance depuis une fiche."
              href="/contacts"
            />
          ) : (
            <BarChart
              points={data.discipline.map((week) => ({
                label: week.label,
                value: week.honoured,
              }))}
              format={(value) => String(value)}
              height={120}
            />
          )}
          {!data.discipline.every((week) => week.honoured + week.missed === 0) && (
            <p className="mt-1.5 text-[11.5px] text-muted">
              {data.discipline.reduce((sum, week) => sum + week.honoured, 0)} tenue(s) ·{" "}
              <b className="font-semibold text-[#B2311F]">
                {data.discipline.reduce((sum, week) => sum + week.missed, 0)}
              </b>{" "}
              manquée(s) — « tenue » veut dire terminée au plus tard le jour de l'échéance.
            </p>
          )}
        </Panel>

        <Panel title="Vieillissement du vivier" hint="contacts jamais approchés, par ancienneté">
          {data.firstTouch.untouched === 0 ? (
            <EmptyChart
              title="Vieillissement du vivier"
              reason="Aucun contact n'attend d'être approché — le vivier est à jour."
            />
          ) : (
            <BarChart
              points={data.aging.map((bracket) => ({
                label: bracket.label,
                value: bracket.count,
              }))}
              format={(value) => String(value)}
              height={120}
            />
          )}
        </Panel>

        <Panel title="Taux de qualification par source" hint="contacts devenus « Qualifié »">
          {data.totals.qualified === 0 ? (
            <EmptyChart
              title="Taux de qualification par source"
              reason="Aucun contact n'est encore passé en « Qualifié » : il n'y a pas de taux à répartir."
              action="Qualifier un contact depuis sa fiche."
              href="/contacts"
            />
          ) : (
            <ul className="grid gap-1">
              {data.sources.slice(0, 8).map((row) => (
                <li key={row.source} className="flex items-center gap-2 text-[12.5px]">
                  <span className="min-w-0 flex-1 truncate">{row.source}</span>
                  <span className="font-mono text-[11.5px] text-muted tabular-nums">
                    {row.qualified}/{row.contacts}
                  </span>
                  <span className="w-12 text-right font-mono font-semibold tabular-nums">
                    {row.rate === null ? "—" : `${row.rate} %`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </section>
  );
}

/** Totaux par type sur la fenêtre, pour la légende du rythme. */
function byTypeTotals(data: ProspectingReport): ReadonlyArray<{ label: string; value: number }> {
  const totals = new Map<string, number>();
  for (const week of data.rhythm) {
    for (const [type, count] of Object.entries(week.byType)) {
      totals.set(type, (totals.get(type) ?? 0) + count);
    }
  }
  return [...totals.entries()]
    .map(([type, value]) => ({
      label: ACTIVITY_LABELS[type as keyof typeof ACTIVITY_LABELS] ?? type,
      value,
    }))
    .sort((a, b) => b.value - a.value);
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <Eyebrow>{title}</Eyebrow>
      <p className="mt-0.5 mb-2 text-[11.5px] text-muted">{hint}</p>
      {children}
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  href?: string;
}) {
  const body = (
    <div className="rounded-control border border-line bg-surface-2 px-3 py-2.5">
      <span className="font-mono text-[9.5px] tracking-[0.1em] text-muted uppercase">{label}</span>
      <div className="mt-0.5 font-display text-[20px] font-semibold tabular-nums">{value}</div>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{hint}</p>
    </div>
  );
  return href === undefined ? body : <Link href={href}>{body}</Link>;
}
