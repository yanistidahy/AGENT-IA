import Link from "next/link";
import { rateLabel, type FunnelStep, type Metric } from "@/lib/domain/pilotage";
import { ReliabilityChip } from "./reliability-chip";
import type { SizeCard } from "@/lib/domain/segments";

/**
 * **Les deux cartes qui portent la question de l'onglet.**
 *
 * Petites contre Grosses, côte à côte, même gabarit. C'est la comparaison pour
 * laquelle cet onglet existe, et c'est aussi la façon la plus facile de mentir
 * avec deux chiffres justes — d'où trois garde-fous **dans la carte** et non
 * dans la tête du lecteur :
 *
 * 1. **le grand taux porte sa phrase** — « 4 sur 37 personnes ». Un taux sans
 *    dénominateur invite à conclure de trois personnes ;
 * 2. **la puce de fiabilité** dit ce que le taux vaut, en mots et avec des
 *    hachures sous dix personnes — jamais par la couleur seule ;
 * 3. **la puce de comparaison n'apparaît que sur la plus faible des deux, et
 *    seulement quand les deux échantillons atteignent trente.** La décision est
 *    prise par `compareCards` : la vue ne compare rien elle-même.
 *
 * Le mini-entonnoir est cliquable marche par marche, et chaque lien emporte la
 * tranche : le nombre affiché et la liste qu'il ouvre sortent du même tableau
 * filtré.
 */

const DRILL: Partial<Record<FunnelStep["stage"], Metric>> = {
  contacted: "contacted",
  replied: "replies",
  positive: "positive",
  demo_sent: "demos_sent",
  demo_tested: "demos_tested",
  qualified: "qualified",
};

export function SizeCards({
  cards,
  comparison,
  href,
}: {
  readonly cards: readonly SizeCard[];
  /** La tranche la plus faible et sa phrase, ou `null` si la comparaison n'est pas permise. */
  readonly comparison: { readonly bucket: string; readonly label: string } | null;
  readonly href: (bucket: string, metric: Metric) => string;
}) {
  return (
    <ul data-size-cards className="grid gap-3 lg:grid-cols-2">
      {cards.map((card) => (
        <li
          key={card.bucket}
          data-size-card={card.bucket}
          className="rounded-board border border-line bg-surface px-4 py-3.5"
        >
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-[15px] font-semibold tracking-tight">{card.label}</h3>
            <span className="text-[12px] text-muted" data-size-brands={card.brands.length}>
              {card.brands.length} marque{card.brands.length > 1 ? "s" : ""}
            </span>
          </header>

          <p className="mt-2 flex items-baseline gap-2">
            <span
              data-size-rate
              className={`font-display text-[34px] leading-none font-semibold tracking-tight ${
                card.reliability === "unusable" ? "text-closed" : "text-ink"
              }`}
            >
              {rateLabel(card.rate)}
            </span>
            <span className="text-[12.5px] text-muted">de réponse</span>
          </p>
          <p className="mt-1 text-[12px] text-muted" data-size-sample>
            {card.replied.length} sur {card.contacted.length} personne
            {card.contacted.length > 1 ? "s" : ""}
          </p>

          <p className="mt-2 flex flex-wrap items-center gap-2">
            <ReliabilityChip n={card.contacted.length} reliability={card.reliability} />
            {comparison !== null && comparison.bucket === card.bucket ? (
              <span
                data-size-comparison
                className="inline-flex items-center rounded-full border border-accent-2/40 bg-accent-2-l px-2 py-0.5 text-[11px] font-medium text-accent-2"
              >
                {comparison.label}
              </span>
            ) : null}
          </p>

          <ol className="mt-3 space-y-1 border-t border-line-2 pt-2.5">
            {card.steps.map((step) => {
              const metric = DRILL[step.stage];
              const count = step.contactIds.length;
              return (
                <li
                  key={step.stage}
                  data-size-step={step.stage}
                  data-count={count}
                  className="flex items-baseline justify-between gap-2 text-[12.5px]"
                >
                  <span className="truncate text-muted">{step.label}</span>
                  {metric === undefined || count === 0 ? (
                    <span className="tabular-nums text-closed">{count}</span>
                  ) : (
                    <Link
                      href={href(card.bucket, metric)}
                      className="font-medium tabular-nums text-brand-d hover:underline"
                    >
                      {count}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </li>
      ))}
    </ul>
  );
}

/**
 * Les tranches qui ne sont pas des cartes : Intermédiaires, Non renseigné, et
 * « Moins de 2 000 » **quand elle n'est pas vide**.
 *
 * En puces et non en cartes, parce qu'elles ne portent pas la question de
 * l'onglet : les afficher aussi grandes que les deux populations comparées
 * ferait un écran à cinq réponses et aucune question. Elles restent cliquables
 * — une tranche qu'on ne peut pas ouvrir est une tranche qu'on soupçonne.
 */
export function SizeChips({
  cards,
  href,
}: {
  readonly cards: readonly SizeCard[];
  readonly href: (bucket: string, metric: Metric) => string;
}) {
  if (cards.length === 0) return null;
  return (
    <ul data-size-chips className="flex flex-wrap gap-2">
      {cards.map((card) => (
        <li key={card.bucket}>
          <Link
            href={href(card.bucket, "contacted")}
            data-size-chip={card.bucket}
            className="inline-flex items-baseline gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] hover:border-brand hover:text-brand-d"
          >
            <span className="font-medium text-ink">{card.label}</span>
            <span className="text-muted">
              {card.contacted.length} personne{card.contacted.length > 1 ? "s" : ""}
            </span>
            <span className="text-muted">· {rateLabel(card.rate)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
