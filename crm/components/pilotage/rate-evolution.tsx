"use client";

import { useState } from "react";
import { NO_DATA, rateLabel } from "@/lib/domain/pilotage";

/**
 * **« Évolution du taux de réponse » — deux lignes, et la seconde n'est pas
 * qu'une autre couleur.**
 *
 * Petites : trait plein, marqueurs ronds, indigo. Grosses : trait tireté,
 * marqueurs carrés, orange. Les deux distinctions redondantes sont la règle du
 * jalon 113 : six lignes qui ne diffèrent que par la teinte sont six lignes
 * illisibles pour un daltonien, et illisibles à l'impression.
 *
 * **Les points sous dix personnes sont creux**, et le sous-titre le dit. Un
 * point plein se compare ; un point creux se regarde. Sans cette distinction, le
 * mode « par période » raconterait une histoire de hasard avec l'autorité d'une
 * courbe — un taux hebdomadaire sur huit personnes saute de 0 à 25 % parce
 * qu'une personne a répondu.
 *
 * Client, comme le graphique de l'onglet 2, et pour la même raison : le survol
 * et le focus clavier remplissent la bande de détail sous le tracé. Tout le
 * calcul reste dans `lib/domain/segments.ts`.
 */

export interface RateSeriesView {
  readonly bucket: string;
  readonly label: string;
  readonly color: string;
  readonly dash: string;
  readonly marker: "circle" | "square";
  readonly points: readonly {
    readonly key: string;
    readonly short: string;
    readonly exact: string;
    readonly rate: number | null;
    readonly n: number;
    readonly replied: number;
    readonly weak: boolean;
    /** La liste de cette période pour cette tranche : même tableau filtré. */
    readonly href: string;
  }[];
}

const HEIGHT = 190;
const PAD = { top: 14, right: 12, bottom: 26, left: 38 } as const;

export function RateEvolution({
  series,
  modeHref,
  modeLabel,
  subtitle,
}: {
  readonly series: readonly RateSeriesView[];
  readonly modeHref: string;
  readonly modeLabel: string;
  readonly subtitle: string;
}) {
  const [at, setAt] = useState<string | null>(null);
  const columns = series[0]?.points ?? [];

  if (columns.length === 0) {
    return (
      <section data-rate-evolution className="rounded-board border border-line bg-surface p-3.5">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          Évolution du taux de réponse
        </h3>
        <p className="mt-2 text-[13px] text-muted">{NO_DATA}</p>
      </section>
    );
  }

  /*
    **L'échelle monte au plus haut taux observé, jamais à 100 %.** Un axe fixé à
    100 % écrase deux courbes qui vivent entre 2 et 14 % en deux traits plats :
    la question « laquelle monte ? » devient illisible précisément sur les
    valeurs réelles de ce produit. Le plancher de 10 % évite l'inverse — une
    courbe à 1 % qui remplirait tout le cadre et paraîtrait énorme.
  */
  let highest = 0.1;
  for (const line of series) {
    for (const point of line.points) {
      if (point.rate !== null && point.rate > highest) highest = point.rate;
    }
  }
  const ceiling = Math.min(1, highest * 1.15);

  const width = Math.max(320, 60 + columns.length * 54);
  const inner = width - PAD.left - PAD.right;
  const slot = inner / columns.length;
  const centre = (index: number) => PAD.left + index * slot + slot / 2;
  const y = (rate: number) => HEIGHT - PAD.bottom - (rate / ceiling) * (HEIGHT - PAD.top - PAD.bottom);

  const index = at === null ? columns.length - 1 : columns.findIndex((point) => point.key === at);
  const shown = index < 0 ? columns.length - 1 : index;

  return (
    <section data-rate-evolution className="rounded-board border border-line bg-surface p-3.5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          Évolution du taux de réponse
          <span className="ml-2 text-[12px] font-normal text-muted">{modeLabel}</span>
        </h3>
        <a
          href={modeHref}
          data-rate-mode
          className="rounded-control border border-line px-2.5 py-1 text-[12px] font-semibold hover:bg-surface-2"
        >
          {modeLabel === "Cumulé" ? "Voir par période" : "Voir en cumulé"}
        </a>
      </header>
      <p className="mt-1 text-[11.5px] text-muted" data-rate-subtitle>
        {subtitle}
      </p>

      <div className="mt-2 overflow-x-auto" data-rate-frame>
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Taux de réponse par période et par tranche de taille"
          onMouseLeave={() => setAt(null)}
        >
          {[0, 0.5, 1].map((fraction) => (
            <g key={fraction}>
              <line
                x1={PAD.left}
                y1={y(ceiling * fraction)}
                x2={width - PAD.right}
                y2={y(ceiling * fraction)}
                stroke="var(--color-line-2)"
              />
              <text
                x={PAD.left - 5}
                y={y(ceiling * fraction) + 3}
                textAnchor="end"
                fontSize="9"
                fill="var(--color-muted)"
              >
                {rateLabel(ceiling * fraction)}
              </text>
            </g>
          ))}

          {series.map((line) => (
            <g key={line.bucket} data-rate-line={line.bucket}>
              <path
                d={pathOf(line, centre, y)}
                fill="none"
                stroke={line.color}
                strokeWidth="2"
                strokeDasharray={line.dash}
                strokeLinejoin="round"
              />
              {line.points.map((point, position) =>
                point.rate === null ? null : (
                  /*
                    **Chaque point est un lien**, donc focalisable : tabuler
                    parcourt les périodes et remplit la bande de détail, comme
                    le survol. Un graphique dont l'information n'existe qu'au
                    survol est un graphique que personne ne lit au clavier — le
                    défaut corrigé au jalon 113 sur l'autre tracé.
                  */
                  <a
                    key={point.key}
                    href={point.href}
                    aria-label={`${line.label}, ${point.exact} : ${rateLabel(point.rate)} sur ${point.n} personnes`}
                    onFocus={() => setAt(point.key)}
                  >
                  <g
                    data-rate-point={`${line.bucket}:${point.key}`}
                    data-weak={point.weak ? "1" : "0"}
                    onMouseEnter={() => setAt(point.key)}
                  >
                    <circle cx={centre(position)} cy={y(point.rate)} r="9" fill="transparent" />
                    {/* Creux sous dix personnes : la forme dit le doute, pas la teinte. */}
                    {line.marker === "circle" ? (
                      <circle
                        cx={centre(position)}
                        cy={y(point.rate)}
                        r="3.4"
                        fill={point.weak ? "var(--color-surface)" : line.color}
                        stroke={line.color}
                        strokeWidth="1.6"
                      />
                    ) : (
                      <rect
                        x={centre(position) - 3.2}
                        y={y(point.rate) - 3.2}
                        width="6.4"
                        height="6.4"
                        fill={point.weak ? "var(--color-surface)" : line.color}
                        stroke={line.color}
                        strokeWidth="1.6"
                      />
                    )}
                  </g>
                  </a>
                ),
              )}
            </g>
          ))}

          {columns.map((point, position) =>
            slot >= 34 || position % 2 === 0 ? (
              <text
                key={point.key}
                x={centre(position)}
                y={HEIGHT - 8}
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-muted)"
              >
                {point.short}
              </text>
            ) : null,
          )}

          {/* La colonne lue, soulignée : au survol comme au focus clavier. */}
          <line
            x1={centre(shown)}
            y1={PAD.top}
            x2={centre(shown)}
            y2={HEIGHT - PAD.bottom}
            stroke="var(--color-brand)"
            strokeWidth="1"
            strokeDasharray="2 3"
            opacity="0.5"
          />
        </svg>
      </div>

      <ul
        data-rate-detail
        className="mt-2 flex flex-wrap gap-x-5 gap-y-1 rounded-control bg-surface-2 px-3 py-2 text-[12px]"
      >
        <li className="font-medium text-ink" data-rate-detail-period>
          {columns[shown]?.exact ?? ""}
        </li>
        {series.map((line) => {
          const point = line.points[shown];
          return (
            <li key={line.bucket} data-rate-detail-line={line.bucket} className="text-muted">
              <span style={{ color: line.color }} className="font-medium">
                {line.label}
              </span>{" "}
              {rateLabel(point?.rate ?? null)} · {point?.replied ?? 0} sur {point?.n ?? 0}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Le tracé, **coupé sur les périodes sans dénominateur**.
 *
 * Un `null` n'est pas un zéro : relier le point d'avant à celui d'après par
 * -dessus une période sans aucun message dessinerait une pente que personne n'a
 * mesurée. Le trait s'interrompt, ce qui est le fait.
 */
function pathOf(
  line: RateSeriesView,
  centre: (index: number) => number,
  y: (rate: number) => number,
): string {
  const parts: string[] = [];
  let open = false;
  for (let index = 0; index < line.points.length; index += 1) {
    const point = line.points[index];
    if (point === undefined || point.rate === null) {
      open = false;
      continue;
    }
    parts.push(`${open ? "L" : "M"}${centre(index)},${y(point.rate)}`);
    open = true;
  }
  return parts.join(" ");
}
