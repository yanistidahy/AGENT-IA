import { EmptyChart } from "@/components/charts/empty-chart";
import { Eyebrow } from "@/components/ui/primitives";
import type { SalesFlowReport } from "@/lib/api/prospecting";

/**
 * Le parcours de vente : conversion et temps passé, étape par étape.
 *
 * C'est ce qui manquait pour répondre à « où mes affaires stagnent-elles ? ».
 * Le taux de gain dit qu'on perd ; il ne dit pas où.
 *
 * **Chaque nombre annonce sur combien il repose.** Une médiane calculée sur
 * deux passages n'est pas une mesure, et l'afficher comme les autres la ferait
 * lire comme telle. Les passages antérieurs à la table des visites n'ont jamais
 * été enregistrés : la colonne « mesurés » est donc faible au début, et le
 * restera jusqu'à ce que de nouveaux passages s'accumulent.
 */
export function SalesFlowBlock({ data }: { data: SalesFlowReport }) {
  if (data.deals === 0) {
    return (
      <section className="mb-7">
        <h2 className="mb-3 font-display text-[17px] font-semibold">Vente</h2>
        <EmptyChart
          title="Parcours de vente"
          reason="Aucune affaire n'existe : il n'y a ni conversion ni durée à mesurer."
          action="Qualifiez un contact — l'affaire est créée automatiquement."
          href="/contacts"
        />
      </section>
    );
  }

  return (
    <section className="mb-7">
      <h2 className="mb-3 font-display text-[17px] font-semibold">Vente</h2>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-4 shadow-card">
          <Eyebrow>Taux de lapin</Eyebrow>
          <p className="mt-0.5 mb-1.5 text-[11.5px] text-muted">
            démos planifiées qui n'ont pas eu lieu
          </p>
          {data.noShow === null ? (
            <p className="text-[12.5px] text-muted">
              Les étapes « Démo planifiée » et « Démo réalisée » n'existent pas dans ce pipeline.
            </p>
          ) : data.noShow.rate === null ? (
            <p className="text-[12.5px] text-muted">
              Aucune démo planifiée pour l'instant : rien à comparer.
            </p>
          ) : (
            <>
              <div className="font-display text-[24px] font-semibold tabular-nums">
                {data.noShow.rate} %
              </div>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {data.noShow.held} tenue(s) sur {data.noShow.planned} planifiée(s)
              </p>
            </>
          )}
        </div>

        <div className="rounded-card border border-line bg-surface p-4 shadow-card">
          <Eyebrow>Vélocité</Eyebrow>
          <p className="mt-0.5 mb-1.5 text-[11.5px] text-muted">
            jours entre l'ouverture de l'affaire et la signature
          </p>
          {data.velocity.medianDays === null ? (
            <p className="text-[12.5px] text-muted">
              Aucune affaire gagnée : la vélocité se mesurera à la première signature.
            </p>
          ) : (
            <>
              <div className="font-display text-[24px] font-semibold tabular-nums">
                {data.velocity.medianDays} j
              </div>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                médiane sur {data.velocity.measured} affaire(s) gagnée(s). Depuis que la
                qualification crée l'affaire, l'ouverture **est** la qualification ; les affaires
                antérieures portent leur date de saisie.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="text-left font-mono text-[9.5px] tracking-[0.12em] text-muted uppercase">
              <th className="border-b border-line px-3 py-2">Étape</th>
              <th className="border-b border-line px-3 py-2 text-right">Entrées</th>
              <th className="border-b border-line px-3 py-2 text-right">Avancées</th>
              <th className="border-b border-line px-3 py-2 text-right">Conversion</th>
              <th className="border-b border-line px-3 py-2 text-right">Durée médiane</th>
              <th className="border-b border-line px-3 py-2 text-right">Passages mesurés</th>
            </tr>
          </thead>
          <tbody>
            {data.stages.map((stage) => (
              <tr key={stage.stageId}>
                <td className="border-b border-line-2 px-3 py-2 font-semibold">{stage.name}</td>
                <td className="border-b border-line-2 px-3 py-2 text-right font-mono tabular-nums">
                  {stage.entered}
                </td>
                <td className="border-b border-line-2 px-3 py-2 text-right font-mono tabular-nums">
                  {stage.advanced}
                </td>
                <td className="border-b border-line-2 px-3 py-2 text-right font-mono font-semibold tabular-nums">
                  {stage.conversion === null ? (
                    <span className="font-normal text-muted">—</span>
                  ) : (
                    `${stage.conversion} %`
                  )}
                </td>
                <td className="border-b border-line-2 px-3 py-2 text-right font-mono tabular-nums">
                  {stage.medianDays === null ? (
                    <span className="text-muted">—</span>
                  ) : (
                    `${stage.medianDays} j`
                  )}
                </td>
                <td className="border-b border-line-2 px-3 py-2 text-right font-mono text-muted tabular-nums">
                  {stage.measured}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
        Les durées ne comptent que les passages **terminés** — le passage en cours mesurerait
        « depuis quand » et non « combien de temps ». {data.visits} passage(s) enregistré(s) au
        total ; les affaires antérieures à cette mesure n'en portent qu'un, reconstitué.
      </p>
    </section>
  );
}
