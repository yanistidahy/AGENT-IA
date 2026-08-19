import { BarChart } from "@/components/charts/primitives";
import type { EmailStats } from "@/lib/api/email-stats";

/**
 * Les graphiques, en dernier et sous condition.
 *
 * **Un cadre vide se lit comme une panne ; une phrase se lit comme une
 * promesse.** Là où l'écran affichait douze barres dont onze à zéro, il dit
 * maintenant ce qui manque et quand cela reviendra — et il le fait revenir tout
 * seul, sans réglage, dès que l'histoire est assez longue.
 *
 * Ce composant ne décide rien : `historyDepth()` a tranché en amont, et il n'y a
 * qu'un endroit où la règle est écrite.
 */
export function EmailCharts({ stats }: { readonly stats: EmailStats }) {
  const { depth } = stats;

  return (
    <section className="grid gap-3 lg:grid-cols-2">
      {depth.daily ? (
        <Panel title={`Par jour, sur ${depth.dailyDays} jours`}>
          <BarChart
            points={stats.perDay.map((bucket) => ({ label: bucket.label, value: bucket.count }))}
            format={(value) => String(value)}
            empty="Aucun envoi sur la période."
          />
        </Panel>
      ) : (
        <Pending notice={noticeFor(stats, "daily")} />
      )}

      {depth.weekly ? (
        <Panel title={`Par semaine, sur ${depth.weeklyWeeks} semaines`}>
          <BarChart
            points={stats.perWeek.map((bucket) => ({ label: bucket.label, value: bucket.count }))}
            format={(value) => String(value)}
            empty="Aucun envoi sur la période."
          />
        </Panel>
      ) : (
        <Pending notice={noticeFor(stats, "weekly")} />
      )}

      {/* Les séquences n'ont pas de seuil d'histoire : une seule séquence
          partie est déjà une information — laquelle tourne, et jusqu'où. */}
      {stats.perSequence.length > 0 && (
        <Panel title="Par séquence et étape">
          <BarChart
            points={stats.perSequence.map((bucket) => ({
              label: bucket.label,
              value: bucket.count,
            }))}
            format={(value) => String(value)}
            empty="Aucun email de séquence sur la période."
          />
        </Panel>
      )}
    </section>
  );
}

function noticeFor(stats: EmailStats, chart: "daily" | "weekly"): string {
  return stats.depth.missing.find((entry) => entry.chart === chart)?.notice ?? "";
}

function Panel({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface px-3.5 py-3 shadow-card">
      <h2 className="mb-2 font-display text-[13px] font-semibold">{title}</h2>
      {children}
    </div>
  );
}

/** Ce qui remplace un graphique absent : sa condition de retour, et rien d'autre. */
function Pending({ notice }: { readonly notice: string }) {
  if (notice === "") return null;
  return (
    <p className="rounded-card border border-dashed border-line bg-surface-2 px-3.5 py-3 text-[12px] leading-relaxed text-muted">
      {notice}
    </p>
  );
}
