import { moneyShort } from "@/lib/format";

/**
 * Graphiques écrits à la main, aucune librairie.
 *
 * Tous sont des composants serveur : ce sont des `<svg>` statiques, ils
 * n'envoient pas une ligne de JavaScript au navigateur. `viewBox` plus
 * `width="100%"` les rend fluides sans code de redimensionnement.
 *
 * Règle commune : un jeu de données vide affiche un message, jamais un cadre
 * vide qu'on pourrait prendre pour un graphique cassé.
 */

export interface Point {
  readonly label: string;
  readonly value: number;
}

function Empty({ message }: { message: string }) {
  return (
    <p className="rounded-card border border-dashed border-line px-3.5 py-6 text-center text-[12.5px] text-muted">
      {message}
    </p>
  );
}

/** Barres verticales. Format monétaire par défaut. */
export function BarChart({
  points,
  height = 160,
  format = moneyShort,
  empty = "Aucune donnée sur la période.",
}: {
  points: readonly Point[];
  height?: number;
  format?: (value: number) => string;
  empty?: string;
}) {
  if (points.length === 0) return <Empty message={empty} />;

  const max = Math.max(...points.map((point) => point.value), 1);
  const width = Math.max(320, points.length * 56);
  const slot = width / points.length;
  const barWidth = Math.min(30, slot * 0.55);

  return (
    <svg
      viewBox={`0 0 ${width} ${height + 34}`}
      width="100%"
      height={height + 34}
      role="img"
      aria-label={points.map((p) => `${p.label} : ${format(p.value)}`).join(", ")}
    >
      {points.map((point, index) => {
        const barHeight = Math.round((point.value / max) * height);
        const x = index * slot + (slot - barWidth) / 2;
        return (
          <g key={point.label}>
            <rect
              x={x}
              y={height - barHeight}
              width={barWidth}
              height={Math.max(barHeight, point.value > 0 ? 2 : 0)}
              rx={4}
              fill="#0FA88F"
            />
            <text
              x={x + barWidth / 2}
              y={height - barHeight - 5}
              textAnchor="middle"
              fontSize="10"
              fill="#6E8B86"
              fontFamily="ui-monospace, monospace"
            >
              {point.value === 0 ? "" : format(point.value)}
            </text>
            <text
              x={x + barWidth / 2}
              y={height + 16}
              textAnchor="middle"
              fontSize="10"
              fill="#6E8B86"
            >
              {point.label}
            </text>
          </g>
        );
      })}
      <line x1="0" y1={height} x2={width} y2={height} stroke="#E3EBE9" strokeWidth="1" />
    </svg>
  );
}

/** Courbe simple, pour une série temporelle. */
export function LineChart({
  points,
  height = 160,
  format = moneyShort,
}: {
  points: readonly Point[];
  height?: number;
  format?: (value: number) => string;
}) {
  if (points.length < 2) return <Empty message="Pas assez de points pour tracer une courbe." />;

  const max = Math.max(...points.map((point) => point.value), 1);
  const width = Math.max(320, points.length * 56);
  const step = width / (points.length - 1);

  const coords = points.map((point, index) => ({
    x: index * step,
    y: height - (point.value / max) * height,
    point,
  }));

  const path = coords
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${path} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height + 26}`}
      width="100%"
      height={height + 26}
      role="img"
      aria-label={points.map((p) => `${p.label} : ${format(p.value)}`).join(", ")}
    >
      <path d={area} fill="#0FA88F" fillOpacity="0.12" />
      <path d={path} fill="none" stroke="#0FA88F" strokeWidth="2" strokeLinejoin="round" />
      {coords.map(({ x, y, point }) => (
        <g key={point.label}>
          <circle cx={x} cy={y} r="3" fill="#0FA88F" />
          <text x={x} y={height + 18} textAnchor="middle" fontSize="10" fill="#6E8B86">
            {point.label}
          </text>
        </g>
      ))}
      <line x1="0" y1={height} x2={width} y2={height} stroke="#E3EBE9" strokeWidth="1" />
    </svg>
  );
}

const DONUT_COLORS = [
  "#0FA88F",
  "#6D5AE6",
  "#D99323",
  "#2C7BE5",
  "#C8452F",
  "#4E9F7A",
  "#8E7CC3",
  "#A8763E",
];

/**
 * Anneau. Les parts sont tracées en coordonnées polaires ; un jeu à une seule
 * valeur non nulle devient un cercle complet, cas qu'un `arc` SVG ne sait pas
 * exprimer et qui produirait un anneau invisible.
 */
export function DonutChart({ points, size = 168 }: { points: readonly Point[]; size?: number }) {
  const total = points.reduce((sum, point) => sum + point.value, 0);
  if (total === 0) return <Empty message="Aucune donnée à répartir." />;

  const radius = size / 2;
  const inner = radius * 0.58;
  const nonZero = points.filter((point) => point.value > 0);

  let angle = -Math.PI / 2;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={nonZero
          .map((p) => `${p.label} : ${Math.round((p.value / total) * 100)} %`)
          .join(", ")}
      >
        {nonZero.length === 1 ? (
          <circle
            cx={radius}
            cy={radius}
            r={(radius + inner) / 2}
            fill="none"
            stroke={DONUT_COLORS[0]}
            strokeWidth={radius - inner}
          />
        ) : (
          nonZero.map((point, index) => {
            const sweep = (point.value / total) * Math.PI * 2;
            const start = angle;
            const end = angle + sweep;
            angle = end;

            const large = sweep > Math.PI ? 1 : 0;
            const path = [
              `M${radius + radius * Math.cos(start)},${radius + radius * Math.sin(start)}`,
              `A${radius},${radius} 0 ${large} 1 ${radius + radius * Math.cos(end)},${radius + radius * Math.sin(end)}`,
              `L${radius + inner * Math.cos(end)},${radius + inner * Math.sin(end)}`,
              `A${inner},${inner} 0 ${large} 0 ${radius + inner * Math.cos(start)},${radius + inner * Math.sin(start)}`,
              "Z",
            ].join(" ");

            return (
              <path key={point.label} d={path} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
            );
          })
        )}
      </svg>

      <ul className="grid gap-1 text-[12.5px]">
        {nonZero.map((point, index) => (
          <li key={point.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
            />
            <span>{point.label}</span>
            <span className="ml-auto font-mono text-muted tabular-nums">
              {Math.round((point.value / total) * 100)} %
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
