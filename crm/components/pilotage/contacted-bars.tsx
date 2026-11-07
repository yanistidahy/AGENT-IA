import { NO_DATA } from "@/lib/domain/pilotage";

/**
 * **« Personnes contactées » — barres groupées, pas empilées.**
 *
 * La question est « combien de petites **contre** combien de grosses cette
 * semaine », et une pile répond à « combien en tout », ce que l'onglet d'à côté
 * dit déjà. Groupées, les deux hauteurs se comparent à l'œil sans arithmétique.
 *
 * **La seconde série est hachurée en plus d'être orange.** Même règle que
 * partout dans ce jalon : la couleur seule ne distingue rien pour un daltonien,
 * et rien du tout à l'impression. Les hachures sont un dégradé CSS appliqué en
 * SVG par `fill` d'un motif nommé **une seule fois par graphique** — un
 * identifiant dupliqué ferait un document invalide.
 *
 * Les valeurs sont écrites **sur** les barres : lire une hauteur contre un axe
 * est une opération qu'on fait mal, et le chiffre exact est ce qu'on venait
 * chercher.
 */

export interface BarGroup {
  readonly key: string;
  readonly short: string;
  readonly exact: string;
  readonly values: readonly {
    readonly bucket: string;
    readonly label: string;
    readonly count: number;
    readonly hatched: boolean;
    readonly color: string;
    readonly href: string;
  }[];
}

const HEIGHT = 180;
const PAD = { top: 18, right: 10, bottom: 26, left: 34 } as const;

export function ContactedBars({ groups }: { readonly groups: readonly BarGroup[] }) {
  let peak = 1;
  for (const group of groups) {
    for (const value of group.values) if (value.count > peak) peak = value.count;
  }

  if (groups.length === 0) {
    return (
      <section data-contacted-bars className="rounded-board border border-line bg-surface p-3.5">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Personnes contactées</h3>
        <p className="mt-2 text-[13px] text-muted">{NO_DATA}</p>
      </section>
    );
  }

  const perGroup = Math.max(1, groups[0]?.values.length ?? 1);
  const width = Math.max(320, 50 + groups.length * (18 + perGroup * 16));
  const inner = width - PAD.left - PAD.right;
  const slot = inner / groups.length;
  const barW = Math.max(7, Math.min(22, (slot - 10) / perGroup));
  const y = (count: number) => HEIGHT - PAD.bottom - (count / peak) * (HEIGHT - PAD.top - PAD.bottom);

  return (
    <section data-contacted-bars className="rounded-board border border-line bg-surface p-3.5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">
          Personnes contactées
          <span className="ml-2 text-[12px] font-normal text-muted">par période et par tranche</span>
        </h3>
      </header>

      <div className="mt-2 overflow-x-auto" data-contacted-frame>
        <svg
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Personnes contactées par période, une barre par tranche de taille"
        >
          <defs>
            {/* Un seul motif par graphique, nommé une fois : voir l'en-tête. */}
            <pattern
              id="contacted-hatch"
              width="5"
              height="5"
              patternTransform="rotate(45)"
              patternUnits="userSpaceOnUse"
            >
              <rect width="5" height="5" fill="var(--color-accent-2-l)" />
              <line x1="0" y1="0" x2="0" y2="5" stroke="var(--color-accent-2)" strokeWidth="2" />
            </pattern>
          </defs>

          {[0, 0.5, 1].map((fraction) => (
            <g key={fraction}>
              <line
                x1={PAD.left}
                y1={y(peak * fraction)}
                x2={width - PAD.right}
                y2={y(peak * fraction)}
                stroke="var(--color-line-2)"
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

          {groups.map((group, index) => {
            const left = PAD.left + index * slot + (slot - barW * perGroup) / 2;
            return (
              <g key={group.key} data-bar-group={group.key}>
                {group.values.map((value, position) => {
                  const x = left + position * barW;
                  const top = y(value.count);
                  return (
                    <a
                      key={value.bucket}
                      href={value.href}
                      aria-label={`${value.label}, ${group.exact} : ${value.count} personnes`}
                    >
                      <g data-bar={`${group.key}:${value.bucket}`} data-count={value.count}>
                        <rect
                          x={x + 1}
                          y={top}
                          width={Math.max(3, barW - 2)}
                          height={Math.max(0, HEIGHT - PAD.bottom - top)}
                          rx="2"
                          fill={value.hatched ? "url(#contacted-hatch)" : value.color}
                          stroke={value.color}
                          strokeWidth="1"
                        />
                        {value.count > 0 ? (
                          <text
                            x={x + barW / 2}
                            y={top - 3}
                            textAnchor="middle"
                            fontSize="9"
                            fontWeight="600"
                            fill="var(--color-ink-2)"
                          >
                            {value.count}
                          </text>
                        ) : null}
                      </g>
                    </a>
                  );
                })}
                <text
                  x={PAD.left + index * slot + slot / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  fontSize="9"
                  fill="var(--color-muted)"
                >
                  {group.short}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]" data-contacted-legend>
        {(groups[0]?.values ?? []).map((value) => (
          <li key={value.bucket} className="flex items-center gap-1.5 text-muted">
            <span
              aria-hidden="true"
              className="inline-block size-3 rounded-[2px] border"
              style={{
                borderColor: value.color,
                backgroundColor: value.hatched ? "transparent" : value.color,
                backgroundImage: value.hatched
                  ? `repeating-linear-gradient(45deg, ${value.color} 0 2px, transparent 2px 5px)`
                  : undefined,
              }}
            />
            {value.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
