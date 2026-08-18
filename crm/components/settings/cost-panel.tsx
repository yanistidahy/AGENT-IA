import { formatCost, PURPOSE_LABELS, type Purpose } from "@/lib/domain/model-pricing";
import type { UsageBucket, UsageReport } from "@/lib/api/usage";

/**
 * Ce qu'a coûté le mois, par jour, par agent et par usage.
 *
 * **Composant serveur** : c'est un tableau de chiffres déjà agrégés, il n'a
 * besoin d'aucun JavaScript côté navigateur — même règle que les graphiques
 * SVG du jalon 5.
 *
 * Un état vide n'est pas un tableau à zéro : tant qu'aucun appel n'a été passé
 * ce mois-ci, la facture n'est pas « nulle », elle est **inconnue**, et la
 * distinction compte le premier jour du mois.
 */

function purposeLabel(key: string): string {
  return key in PURPOSE_LABELS ? PURPOSE_LABELS[key as Purpose] : key;
}

function Table({
  title,
  rows,
  rename,
}: {
  readonly title: string;
  readonly rows: readonly UsageBucket[];
  readonly rename?: (key: string) => string;
}) {
  return (
    <div className="min-w-0">
      <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted">Aucun appel.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="py-1 pr-3 font-medium">Ligne</th>
                <th className="py-1 pr-3 text-right font-medium">Appels</th>
                <th className="py-1 pr-3 text-right font-medium">Entrée</th>
                <th className="py-1 pr-3 text-right font-medium">Sortie</th>
                <th className="py-1 text-right font-medium">Coût</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-line-2 last:border-0">
                  <td className="py-1 pr-3">{rename === undefined ? row.label : rename(row.key)}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{row.calls}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {row.inputTokens.toLocaleString("fr-FR")}
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {row.outputTokens.toLocaleString("fr-FR")}
                  </td>
                  <td className="py-1 text-right tabular-nums">{formatCost(row.costMicros)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CostPanel({ report }: { readonly report: UsageReport }) {
  const { budget } = report;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className="text-[13px]">
          <span className="text-muted">Total du mois {report.month} : </span>
          <strong className="tabular-nums">{formatCost(report.monthMicros)}</strong>
        </p>
        {budget === null ? (
          <p className="text-[13px] text-muted">Aucun plafond mensuel réglé.</p>
        ) : (
          <p className="text-[13px]">
            <span className="text-muted">Plafond : </span>
            <strong className="tabular-nums">{formatCost(budget.ceilingMicros)}</strong>
            <span className={budget.level === "ok" ? "text-muted" : "ml-1 font-semibold text-[#9A6410]"}>
              {" "}
              ({Math.round(budget.ratio * 100)} %)
            </span>
          </p>
        )}
        {report.anomalies > 0 && (
          <p className="text-[13px] font-semibold text-[#B2311F]">
            {report.anomalies} appel{report.anomalies > 1 ? "s" : ""} hors norme —
            voir le journal du serveur.
          </p>
        )}
      </div>

      {report.lastDraft === null ? (
        <p className="text-[13px] text-muted">
          Aucun brouillon d'email consigné : la ventilation d'une rédaction s'affichera ici
          après le premier envoyé depuis ce CRM.
        </p>
      ) : (
        <p className="rounded-md bg-paper px-3 py-2 text-[13px]">
          <span className="text-muted">Dernier brouillon d'email — </span>
          <strong>{report.lastDraft.model}</strong>
          <span className="text-muted"> · </span>
          {report.lastDraft.inputTokens.toLocaleString("fr-FR")} jetons d'entrée
          <span className="text-muted"> · </span>
          {report.lastDraft.outputTokens.toLocaleString("fr-FR")} de sortie
          {report.lastDraft.thinkingTokens === null ? (
            <span className="text-muted"> (réflexion comprise, non ventilée par l'API)</span>
          ) : (
            <span>
              {" "}
              dont {report.lastDraft.thinkingTokens.toLocaleString("fr-FR")} de réflexion
            </span>
          )}
          <span className="text-muted"> · </span>
          <strong>{formatCost(report.lastDraft.costMicros)}</strong>
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Table title="Par usage" rows={report.byPurpose} rename={purposeLabel} />
        <Table title="Par agent" rows={report.byAgent} />
        <Table title="Par jour" rows={report.byDay} />
      </div>
    </div>
  );
}
