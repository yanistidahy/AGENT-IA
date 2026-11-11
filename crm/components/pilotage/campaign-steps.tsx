import { rateLabel } from "@/lib/domain/pilotage";
import type { BoardLine } from "@/lib/domain/campaigns-board";
import { ReliabilityChip } from "./reliability-chip";

/**
 * **Le panneau d'étapes d'une campagne, et sa phrase de pause.**
 *
 * Replié dans un `<details>` : trois campagnes à cinq étapes font quinze lignes
 * qui noient les trois lignes qu'on venait comparer. Ouvert par son `<summary>`,
 * sans JavaScript.
 *
 * **La phrase de pause est au-dessus des étapes, pas en dessous.** « Campagne
 * en pause : 3 prospects attendent d'être lancés » explique pourquoi les étapes
 * qui suivent ne montrent rien ; la lire après les avoir lues, c'est avoir
 * cherché la cause pour rien.
 *
 * Le taux d'une étape a **son propre dénominateur** — les personnes que *cette*
 * étape a touchées. Diviser les réponses de l'étape 3 par les inscrits de la
 * campagne donnerait un taux qui baisse mécaniquement à chaque relance, et on
 * conclurait que les relances ne marchent pas.
 */
export function CampaignSteps({ line }: { readonly line: BoardLine }) {
  return (
    <>
      {line.notice !== null && (
        <p
          data-board-paused={line.key}
          data-waiting={line.waiting ?? ""}
          className="mb-2 rounded-control border border-gold/40 bg-gold-l px-3 py-2 text-[12px] font-medium text-gold-d"
        >
          {line.notice}
        </p>
      )}

      {line.steps.length > 1 ? (
        <details data-board-steps={line.key}>
          <summary className="cursor-pointer text-[12px] font-semibold text-brand-d">
            Résultat par étape ({line.steps.length})
          </summary>
          <table className="mt-2 w-full text-[12px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-wide text-muted uppercase">
                <th scope="col" className="py-1.5 pr-3 font-semibold">
                  Étape
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">
                  Messages
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">
                  Réponses
                </th>
                <th scope="col" className="px-3 py-1.5 text-right font-semibold">
                  Taux
                </th>
                <th scope="col" className="py-1.5 pl-3 text-right font-semibold">
                  Fiabilité
                </th>
              </tr>
            </thead>
            <tbody>
              {line.steps.map((step) => (
                <tr
                  key={step.label}
                  data-board-step={step.index === null ? "hors" : String(step.index)}
                  className="border-b border-line-2"
                >
                  <th scope="row" className="py-1.5 pr-3 text-left font-medium text-ink">
                    {step.label}
                  </th>
                  <td className="px-3 py-1.5 text-right tabular-nums">{step.messages}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{step.replies}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{rateLabel(step.rate)}</td>
                  <td className="py-1.5 pl-3 text-right">
                    <ReliabilityChip n={step.contacted} reliability={step.reliability} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : (
        <p className="text-[11.5px] text-muted" data-board-nosteps={line.key}>
          Aucune étape de séquence sur ces faits. Les événements lemlist déjà importés reçoivent
          leur étape à la prochaine synchronisation ; le CRM et le compteur manuel n'en portent pas.
        </p>
      )}
    </>
  );
}
