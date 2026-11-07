"use client";

import { CHANNEL_LABELS, type OutreachChannel } from "@/lib/domain/outreach";
import type { PointView } from "./timeline-chart";

/**
 * **Le tracé : des barres, ou une ligne par canal.**
 *
 * SVG écrit à la main, aucune librairie — la convention du jalon 5. Ce qui
 * change ici, c'est que le tracé est un composant **client** et non serveur :
 * le survol, le focus clavier et la légende cliquable que le jalon 113 demande
 * ne se font pas sans JavaScript. Le calcul, lui, reste entièrement dans
 * `lib/domain/timeline.ts` : ce fichier ne fait que placer des coordonnées, et
 * `tests/pilotage-source.test.ts` échoue s'il se met à compter.
 *
 * ## Les canaux ne sont pas distingués par la couleur seule
 *
 * Chaque canal porte **une couleur, un motif de tiret et une forme de
 * marqueur**. Un daltonien ne distingue pas un vert d'un rouge ; six lignes qui
 * ne diffèrent que par la teinte sont six lignes illisibles. Le motif et la
 * forme restent lisibles en noir et blanc, et à l'impression.
 */

export interface Band {
  readonly channel: OutreachChannel;
  readonly color: string;
  readonly dash: string;
  readonly marker: "circle" | "square" | "diamond" | "triangle" | "cross" | "plus";
}

/**
 * Les six canaux, chacun avec sa couleur, son tiret et sa forme.
 *
 * Les couleurs viennent des jetons de marque (`app/globals.css`) et non de
 * valeurs écrites ici : on change la couleur à la source, jamais vue par vue.
 */
export const BANDS: readonly Band[] = [
  { channel: "email", color: "var(--color-brand)", dash: "", marker: "circle" },
  { channel: "linkedin_invite", color: "var(--color-win-d)", dash: "6 3", marker: "square" },
  { channel: "linkedin_message", color: "var(--color-violet, #7C5CF6)", dash: "2 3", marker: "diamond" },
  { channel: "whatsapp", color: "var(--color-win)", dash: "8 3 2 3", marker: "triangle" },
  { channel: "call", color: "var(--color-ambre, #D99323)", dash: "4 4", marker: "cross" },
  { channel: "other", color: "var(--color-muted)", dash: "1 3", marker: "plus" },
];

export function bandOf(channel: OutreachChannel): Band {
  return BANDS.find((band) => band.channel === channel) ?? BANDS[BANDS.length - 1]!;
}

const HEIGHT = 190;
const PAD = { top: 14, right: 10, bottom: 26, left: 34 } as const;

interface Props {
  readonly points: readonly PointView[];
  readonly view: "total" | "canal";
  readonly channels: readonly OutreachChannel[];
  readonly visible: readonly OutreachChannel[];
  readonly peak: number;
  readonly width: number;
  readonly onEnter: (key: string, channel: OutreachChannel | null) => void;
  readonly onLeave: () => void;
}

/** Un marqueur, par forme : lisible sans la couleur. */
function Marker({ shape, x, y, color }: { shape: Band["marker"]; x: number; y: number; color: string }) {
  const r = 3.2;
  if (shape === "circle") return <circle cx={x} cy={y} r={r} fill={color} />;
  if (shape === "square") return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} fill={color} />;
  if (shape === "diamond") {
    return <polygon points={`${x},${y - r - 0.6} ${x + r + 0.6},${y} ${x},${y + r + 0.6} ${x - r - 0.6},${y}`} fill={color} />;
  }
  if (shape === "triangle") {
    return <polygon points={`${x},${y - r - 0.8} ${x + r + 0.8},${y + r} ${x - r - 0.8},${y + r}`} fill={color} />;
  }
  if (shape === "cross") {
    return (
      <g stroke={color} strokeWidth="1.8">
        <line x1={x - r} y1={y - r} x2={x + r} y2={y + r} />
        <line x1={x - r} y1={y + r} x2={x + r} y2={y - r} />
      </g>
    );
  }
  return (
    <g stroke={color} strokeWidth="1.8">
      <line x1={x - r - 0.6} y1={y} x2={x + r + 0.6} y2={y} />
      <line x1={x} y1={y - r - 0.6} x2={x} y2={y + r + 0.6} />
    </g>
  );
}

export function TimelinePlot({
  points,
  view,
  channels,
  visible,
  peak,
  width,
  onEnter,
  onLeave,
}: Props) {
  const inner = width - PAD.left - PAD.right;
  const slot = points.length === 0 ? inner : inner / points.length;
  const y = (value: number) =>
    HEIGHT - PAD.bottom - (value / peak) * (HEIGHT - PAD.top - PAD.bottom);
  const centre = (index: number) => PAD.left + index * slot + slot / 2;

  /*
    **La cible se trace par période, pas en une seule ligne horizontale.**

    Mon premier jet dessinait un trait unique, et ne le dessinait que si toutes
    les périodes partageaient la même cible. Conséquence mesurée à la recette :
    en granularité « jour », la cible n'apparaissait **jamais** — un samedi n'en
    a pas, donc la série n'était jamais uniforme — et en « mois » elle
    disparaissait dès que deux mois n'avaient pas le même nombre de jours
    ouvrés. C'est-à-dire précisément dans les deux cas où elle a le plus de
    valeur.

    Chaque période porte donc son propre segment. En semaine, les segments
    s'alignent et se lisent comme une ligne ; en jour, ils sautent le week-end ;
    en mois, ils montent et descendent avec la longueur du mois. Le nombre est
    écrit une fois, sur le dernier segment, pour ne pas répéter « 20 » vingt
    fois.
  */
  const withTarget = points.filter((point) => point.target !== null);
  // Une boucle, pas un `reduce` : la garde du jalon 109 refuse `reduce` dans un
  // fichier de pilotage, et elle a raison de le refuser sans nuance — c'est la
  // forme qu'une addition prend quand elle se glisse dans une vue.
  let lastTargetIndex = -1;
  for (let index = 0; index < points.length; index += 1) {
    if (points[index]?.target !== null) lastTargetIndex = index;
  }

  const shown = channels.filter((channel) => visible.includes(channel));

  return (
    <svg
      viewBox={`0 0 ${width} ${HEIGHT}`}
      width={width}
      height={HEIGHT}
      role="img"
      aria-label={
        view === "total"
          ? "Évolution du total par période"
          : "Évolution par canal, une ligne par canal"
      }
      onMouseLeave={onLeave}
      data-timeline-plot={view}
    >
      {/* Trois repères horizontaux, assez pour lire une hauteur sans encombrer. */}
      {[0, 0.5, 1].map((fraction) => (
        <g key={fraction}>
          <line
            x1={PAD.left}
            y1={y(peak * fraction)}
            x2={width - PAD.right}
            y2={y(peak * fraction)}
            stroke="var(--color-line-2)"
            strokeWidth="1"
          />
          <text
            x={PAD.left - 5}
            y={y(peak * fraction) + 3}
            textAnchor="end"
            fontSize="9"
            fill="var(--color-muted)"
          >
            {Math.round(peak * fraction)}
          </text>
        </g>
      ))}

      {/*
        La cible, nommée. Le hameçon garde le nom qu'il avait sur l'ancien
        graphique (`data-target-line`) : les deux tests de navigateur du jalon
        109 qui vérifient que la ligne suit le réglage de /reglages testent un
        invariant qui vaut toujours. La valeur portée est la cible **du seau** :
        100 en granularité « semaine », 20 en « jour », davantage en « mois ».
      */}
      {view === "total" && withTarget.length > 0
        ? points.map((point, index) =>
            point.target === null ? null : (
              <g key={`t-${point.key}`} data-target-line={point.target}>
                <line
                  x1={centre(index) - slot / 2 + 1}
                  y1={y(point.target)}
                  x2={centre(index) + slot / 2 - 1}
                  y2={y(point.target)}
                  stroke="var(--color-brand-d)"
                  strokeWidth="1.4"
                  strokeDasharray="5 4"
                />
                {index === lastTargetIndex ? (
                  <text
                    x={centre(index) + slot / 2 - 2}
                    y={y(point.target) - 4}
                    textAnchor="end"
                    fontSize="9.5"
                    fontWeight="600"
                    fill="var(--color-brand-d)"
                  >
                    cible {point.target}
                  </text>
                ) : null}
              </g>
            ),
          )
        : null}

      {view === "total"
        ? points.map((point, index) => {
            const barW = Math.max(6, Math.min(34, slot * 0.62));
            const x = centre(index) - barW / 2;
            const top = y(point.total);
            /*
              **Vert au-dessus de la cible, neutre en dessous.** Jamais rouge :
              un retard de cadence n'est pas une faute, et peindre en rouge la
              moitié d'une série ferait fermer l'écran. `win` porte la réussite,
              `brand` porte l'action — l'un ne remplace jamais l'autre (jalon 23).
            */
            const reached = point.target !== null && point.total >= point.target;
            return (
              <g
                key={point.key}
                data-timeline-bar={point.key}
                data-total={point.total}
                onMouseEnter={() => onEnter(point.key, null)}
              >
                <a
                  href={point.href}
                  aria-label={`${point.exact} : ${point.total}`}
                  onFocus={() => onEnter(point.key, null)}
                >
                  {/* Une zone de capture pleine hauteur : viser une barre de
                      trois pixels de haut au survol est impossible. */}
                  <rect
                    x={centre(index) - slot / 2}
                    y={PAD.top}
                    width={slot}
                    height={HEIGHT - PAD.top - PAD.bottom}
                    fill="transparent"
                  />
                  <rect
                    x={x}
                    y={top}
                    width={barW}
                    height={Math.max(0, HEIGHT - PAD.bottom - top)}
                    rx="2"
                    fill={reached ? "var(--color-win)" : "var(--color-brand-l)"}
                    stroke={reached ? "var(--color-win-d)" : "var(--color-brand)"}
                    strokeWidth="1"
                  />
                </a>
                {point.total > 0 ? (
                  <text
                    x={centre(index)}
                    y={top - 3}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="600"
                    fill="var(--color-ink-2)"
                  >
                    {point.total}
                  </text>
                ) : null}
              </g>
            );
          })
        : shown.map((channel) => {
            const band = bandOf(channel);
            const path = points
              .map(
                (point, index) =>
                  `${index === 0 ? "M" : "L"}${centre(index)},${y(point.byChannel[channel] ?? 0)}`,
              )
              .join(" ");
            return (
              <g key={channel} data-timeline-line={channel}>
                <path
                  d={path}
                  fill="none"
                  stroke={band.color}
                  strokeWidth="1.8"
                  strokeDasharray={band.dash}
                  strokeLinejoin="round"
                />
                {points.map((point, index) => (
                  <a
                    key={point.key}
                    href={point.channelHref[channel] ?? point.href}
                    aria-label={`${CHANNEL_LABELS[channel]}, ${point.exact} : ${point.byChannel[channel] ?? 0}`}
                    onFocus={() => onEnter(point.key, channel)}
                  >
                    <g
                      data-timeline-point={`${channel}:${point.key}`}
                      data-value={point.byChannel[channel] ?? 0}
                      onMouseEnter={() => onEnter(point.key, channel)}
                    >
                      <circle
                        cx={centre(index)}
                        cy={y(point.byChannel[channel] ?? 0)}
                        r="9"
                        fill="transparent"
                      />
                      <Marker
                        shape={band.marker}
                        x={centre(index)}
                        y={y(point.byChannel[channel] ?? 0)}
                        color={band.color}
                      />
                    </g>
                  </a>
                ))}
              </g>
            );
          })}

      {/* L'axe du temps. Un libellé sur deux quand ils se touchent. */}
      {points.map((point, index) =>
        slot >= 30 || index % 2 === 0 ? (
          <text
            key={point.key}
            x={centre(index)}
            y={HEIGHT - 8}
            textAnchor="middle"
            fontSize="9"
            fill="var(--color-muted)"
          >
            {point.short}
          </text>
        ) : null,
      )}
    </svg>
  );
}
