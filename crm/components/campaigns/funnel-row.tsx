import { OPEN_RATE_SHORT, type FunnelStep } from "@/lib/domain/email-funnel";
import { formatRate, OPEN_RATE_CAVEAT } from "@/lib/domain/email-stats";

/**
 * Les quatre nombres, sur une rangée, lus comme une suite.
 *
 * **Ce qui compte n'est aucun des quatre : c'est la chute entre deux.** Elle est
 * donc dessinée entre les cartes, et non déduite par le lecteur. Sous chaque
 * carte, le taux **nomme son dénominateur** : « 30 % » sans « de quoi » se lit
 * toujours comme le dénominateur le plus flatteur.
 *
 * L'étape estimée garde son cadre pointillé et sa mise en garde — mais **en une
 * ligne**, la version longue au survol. Trois lignes d'avertissement sous un
 * chiffre en gros sont plus de mise en garde que de fait, et finissent par ne
 * plus être lues du tout.
 *
 * Composant serveur : aucune ligne de JavaScript ne part au navigateur.
 */
export function FunnelRow({ steps }: { readonly steps: readonly FunnelStep[] }) {
  return (
    <ol className="flex flex-wrap items-stretch gap-1.5 sm:flex-nowrap">
      {steps.map((step, index) => (
        <li key={step.key} className="flex min-w-0 flex-1 items-stretch gap-1.5">
          {index > 0 && <Drop count={step.drop} />}
          <Card step={step} />
        </li>
      ))}
    </ol>
  );
}

/** La chute : ce qu'on perd en passant à l'étape suivante. */
function Drop({ count }: { readonly count: number | null }) {
  if (count === null) return null;
  return (
    <div
      className="hidden w-8 shrink-0 flex-col items-center justify-center sm:flex"
      aria-hidden="true"
    >
      <span className="font-mono text-[10.5px] leading-none text-muted tabular-nums">
        {count > 0 ? `−${count}` : "="}
      </span>
      <span className="mt-0.5 text-[13px] leading-none text-line">›</span>
    </div>
  );
}

function Card({ step }: { readonly step: FunnelStep }) {
  const estimate = step.kind === "estimate";

  return (
    <div
      className={`min-w-0 flex-1 rounded-card px-3.5 py-2.5 ${
        estimate
          ? "border border-dashed border-line bg-surface-2"
          : "border border-line bg-surface shadow-card"
      }`}
    >
      <p className="truncate text-[11px] font-medium tracking-wide text-muted uppercase">
        {step.label}
      </p>
      <p className="mt-0.5 font-display text-[26px] leading-tight font-semibold tabular-nums">
        {step.count}
      </p>
      <p className="text-[11.5px] leading-snug text-muted">
        {step.rate !== null && (
          <span className="font-medium text-ink-2 tabular-nums">{formatRate(step.rate)} </span>
        )}
        {step.rateOf}
      </p>
      {estimate && (
        // `title` porte l'explication entière : elle n'est pas supprimée, elle
        // est repliée. Le trait pointillé sous la phrase courte est le seul
        // signal qu'il y a quelque chose à survoler.
        <p
          title={OPEN_RATE_CAVEAT}
          className="mt-1 cursor-help text-[10.5px] leading-snug text-muted underline decoration-dotted underline-offset-2"
        >
          {OPEN_RATE_SHORT}
        </p>
      )}
    </div>
  );
}
