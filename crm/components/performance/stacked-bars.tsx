import type { DayStack } from "@/lib/domain/performance";
import { ACTIVITY_LABELS, ACTIVITY_TYPES, type ActivityType } from "@/lib/domain/types";

/**
 * L'activité par jour, canaux empilés.
 *
 * **Les jours à zéro restent dessinés** — ce sont eux qu'on veut voir : le
 * graphique répond à « quel est mon rythme réel », et un rythme se lit à ses
 * trous. Composant serveur, SVG écrit à la main, comme tous les graphiques du
 * produit.
 *
 * Les couleurs viennent des jetons sémantiques déjà utilisés par la
 * chronologie des fiches (`timeline.tsx`) : le même canal porte la même
 * couleur partout, sinon l'œil réapprend la légende à chaque écran.
 */
const CHANNEL_COLORS: Record<ActivityType, string> = {
  call: "var(--color-brand)",
  email: "var(--color-sky)",
  meeting: "var(--color-violet)",
  demo: "var(--color-gold)",
  linkedin: "var(--color-win)",
  instagram: "var(--color-pulse)",
  note: "var(--color-line)",
};

export function StackedBars({ stacks }: { readonly stacks: readonly DayStack[] }) {
  if (stacks.length === 0) return null;

  const height = 150;
  const max = Math.max(...stacks.map((stack) => stack.total), 1);
  // Sur 90 jours les barres se serrent ; sous dix jours elles respirent.
  const slot = stacks.length > 45 ? 10 : stacks.length > 20 ? 18 : 52;
  const width = Math.max(320, stacks.length * slot);
  const barWidth = Math.max(4, Math.min(30, slot * 0.62));
  // Au-delà de trois semaines, une étiquette par ligne deviendrait un mur de
  // chiffres : on n'étiquette qu'un jour sur n.
  const labelEvery = stacks.length > 45 ? 7 : stacks.length > 14 ? 3 : 1;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height + 30}`}
        width="100%"
        height={height + 30}
        role="img"
        aria-label={stacks
          .filter((stack) => stack.total > 0)
          .map((stack) => `${stack.label} : ${stack.total}`)
          .join(", ")}
      >
        {stacks.map((stack, index) => {
          const x = index * slot + (slot - barWidth) / 2;
          let y = height;
          return (
            <g key={stack.key}>
              {ACTIVITY_TYPES.map((channel) => {
                const value = stack.counts[channel];
                if (value === 0) return null;
                const segment = Math.max(2, Math.round((value / max) * height));
                y -= segment;
                return (
                  <rect
                    key={channel}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={segment}
                    fill={CHANNEL_COLORS[channel]}
                  >
                    <title>{`${stack.label} — ${ACTIVITY_LABELS[channel]} : ${value}`}</title>
                  </rect>
                );
              })}
              {stack.total > 0 && (
                <text
                  x={x + barWidth / 2}
                  y={y - 4}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="var(--color-muted)"
                  fontFamily="ui-monospace, monospace"
                >
                  {stack.total}
                </text>
              )}
              {index % labelEvery === 0 && (
                <text
                  x={x + barWidth / 2}
                  y={height + 14}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--color-muted)"
                >
                  {stack.label}
                </text>
              )}
            </g>
          );
        })}
        <line
          x1="0"
          y1={height}
          x2={width}
          y2={height}
          stroke="var(--color-line)"
          strokeWidth="1"
        />
      </svg>

      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
        {ACTIVITY_TYPES.map((channel) => (
          <span key={channel} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block size-2.5 rounded-[3px]"
              style={{ background: CHANNEL_COLORS[channel] }}
            />
            {ACTIVITY_LABELS[channel]}
          </span>
        ))}
      </p>
    </div>
  );
}
