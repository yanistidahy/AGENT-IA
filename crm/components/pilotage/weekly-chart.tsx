import { CHANNEL_LABELS, OUTREACH_CHANNELS, type OutreachChannel } from "@/lib/domain/outreach";
import { NO_DATA, type WeekPoint } from "@/lib/domain/pilotage";

/**
 * Les messages par semaine et par canal, avec la ligne de cible.
 *
 * SVG écrit à la main, composant **serveur** : aucune librairie, aucun
 * JavaScript envoyé au navigateur — la règle des graphiques de ce projet depuis
 * le jalon 0.
 *
 * Les semaines vides restent dessinées : c'est elles qu'on veut voir sur un
 * graphique de régularité, et une série qui saute les creux ferait d'une
 * interruption un trait continu (jalon 59).
 */

const COLORS: Record<OutreachChannel, string> = {
  email: "var(--color-brand)",
  linkedin_invite: "var(--color-brand-lift)",
  linkedin_message: "var(--color-sky)",
  whatsapp: "var(--color-win)",
  call: "var(--color-gold)",
  other: "var(--color-closed)",
};

const WIDTH = 760;
const HEIGHT = 190;
const PAD = { top: 14, right: 12, bottom: 26, left: 34 };

export function WeeklyChart({
  points,
  target,
}: {
  readonly points: readonly WeekPoint[];
  readonly target: number;
}) {
  const peak = Math.max(target, ...points.map((point) => point.total), 1);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const plotW = WIDTH - PAD.left - PAD.right;
  const slot = plotW / Math.max(1, points.length);
  const barW = Math.min(46, slot * 0.6);
  const y = (value: number) => PAD.top + plotH - (value / peak) * plotH;
  const used = OUTREACH_CHANNELS.filter((channel) =>
    points.some((point) => point.byChannel[channel] > 0),
  );

  if (points.every((point) => point.total === 0)) {
    return (
      <div className="rounded-card border border-line bg-surface px-4 py-6">
        <Title />
        <p className="mt-2 text-[13px] text-muted">{NO_DATA}</p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3.5">
      <Title />
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        role="img"
        aria-label="Messages envoyés par semaine et par canal"
        className="mt-2 block"
      >
        {[0, 0.5, 1].map((part) => (
          <line
            key={part}
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={y(peak * part)}
            y2={y(peak * part)}
            stroke="var(--color-line-2)"
            strokeWidth="1"
          />
        ))}
        {[0, 0.5, 1].map((part) => (
          <text
            key={`label-${part}`}
            x={PAD.left - 6}
            y={y(peak * part) + 4}
            textAnchor="end"
            fontSize="10"
            fill="var(--color-muted)"
          >
            {Math.round(peak * part)}
          </text>
        ))}

        {points.map((point, index) => {
          let stacked = 0;
          const x = PAD.left + index * slot + (slot - barW) / 2;
          return (
            /*
              **Le total de la barre est lisible, pas seulement dessiné**
              (jalon 112). Un nombre peint dans un `<text>` SVG ne se compare à
              rien : vérifier que la pastille de la semaine et la dernière barre
              disent la même chose demandait de lire la barre, et une mesure
              qu'on ne peut pas lire est une mesure qu'on croit sur parole.
              Même rôle que `data-kpi` / `data-count` sur les pastilles.
            */
            <g key={point.label} data-week={point.label} data-week-total={point.total}>
              {OUTREACH_CHANNELS.map((channel) => {
                const value = point.byChannel[channel];
                if (value === 0) return null;
                const height = (value / peak) * plotH;
                stacked += value;
                return (
                  <rect
                    key={channel}
                    x={x}
                    y={y(stacked)}
                    width={barW}
                    height={Math.max(1, height)}
                    fill={COLORS[channel]}
                    rx="2"
                  />
                );
              })}
              <text
                x={x + barW / 2}
                y={HEIGHT - 9}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-muted)"
              >
                {point.label}
              </text>
              {point.total > 0 && (
                <text
                  x={x + barW / 2}
                  y={y(point.total) - 4}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="var(--color-ink-2)"
                >
                  {point.total}
                </text>
              )}
            </g>
          );
        })}

        {/* La cible hebdomadaire : un trait, pas une barre — on la franchit, on
            ne la compare pas à un volume. */}
        {target > 0 && (
          <g data-target-line={target}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(target)}
              y2={y(target)}
              stroke="var(--color-pulse)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            <text
              x={WIDTH - PAD.right}
              y={y(target) - 5}
              textAnchor="end"
              fontSize="10"
              fontWeight="600"
              fill="var(--color-pulse)"
            >
              cible {target}
            </text>
          </g>
        )}
      </svg>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {used.map((channel) => (
          <li key={channel} className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-[3px]"
              style={{ background: COLORS[channel] }}
            />
            {CHANNEL_LABELS[channel]}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Title() {
  return (
    <h2 className="font-display text-[15px] font-semibold tracking-tight">
      Dans le temps
      <span className="ml-2 text-[12px] font-normal text-muted">
        messages envoyés par semaine, par canal
      </span>
    </h2>
  );
}
