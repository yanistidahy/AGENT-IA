import Link from "next/link";
import { rateLabel, NO_DATA } from "@/lib/domain/pilotage";
import type { NicheLine, NicheSort } from "@/lib/domain/segments";
import { ReliabilityChip } from "./reliability-chip";

/**
 * **« Par niche » — le tableau qui dit où insister.**
 *
 * Sept colonnes, triables, et **chaque taux porte son `n`** : c'est le tableau
 * où la règle d'échantillon compte le plus, parce qu'une niche de trois
 * personnes dont une a répondu affiche 33 % et se classerait première sur un tri
 * par taux. La puce de fiabilité est donc une colonne, pas une note de bas de
 * page.
 *
 * La tendance est une **sparkline du taux cumulé**, la même définition que la
 * courbe du dessus. Une sparkline hebdomadaire serait plus nerveuse et dirait
 * autre chose que le graphique juste au-dessus, dans le même écran.
 *
 * La bascule Toutes tailles / Petites / Grosses est au-dessus du tableau et vit
 * dans l'URL : le tableau se partage tel qu'on le lit.
 */

export const NICHE_COLUMNS: readonly { readonly key: NicheSort; readonly label: string }[] = [
  { key: "niche", label: "Niche" },
  { key: "contactees", label: "Contactées" },
  { key: "reponses", label: "Réponses" },
  { key: "taux", label: "Taux" },
  { key: "demos", label: "Démos" },
  { key: "qualifiees", label: "Qualifiées" },
];

export function NicheTable({
  lines,
  sort,
  sortHref,
  sizeTabs,
  cellHref,
}: {
  readonly lines: readonly NicheLine[];
  readonly sort: NicheSort;
  readonly sortHref: (key: NicheSort) => string;
  readonly sizeTabs: readonly { readonly label: string; readonly href: string; readonly active: boolean }[];
  readonly cellHref: (line: NicheLine, column: NicheSort) => string | null;
}) {
  return (
    <section data-niche-table className="rounded-board border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h3 className="font-display text-[15px] font-semibold tracking-tight">Par niche</h3>
        <ul className="flex gap-1" data-niche-sizes>
          {sizeTabs.map((tab) => (
            <li key={tab.label}>
              <Link
                href={tab.href}
                aria-pressed={tab.active}
                data-niche-size={tab.label}
                data-active={tab.active ? "1" : "0"}
                className={`inline-block rounded-control border px-2.5 py-1 text-[12px] font-medium ${
                  tab.active
                    ? "border-brand bg-brand-l text-brand-d"
                    : "border-line text-closed hover:bg-surface-2"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          ))}
        </ul>
      </header>

      {lines.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-muted">{NO_DATA}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-wide text-muted uppercase">
                {NICHE_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`px-3 py-2 font-semibold ${column.key === "niche" ? "" : "text-right"}`}
                    aria-sort={sort === column.key ? "descending" : "none"}
                  >
                    <Link
                      href={sortHref(column.key)}
                      data-niche-sort={column.key}
                      className={sort === column.key ? "text-brand-d" : "hover:text-ink"}
                    >
                      {column.label}
                      {sort === column.key ? " ↓" : ""}
                    </Link>
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Tendance
                </th>
                <th scope="col" className="px-3 py-2 text-right font-semibold">
                  Fiabilité
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key} data-niche-row={line.key} className="border-b border-line-2">
                  <th scope="row" className="max-w-[220px] truncate px-3 py-2 text-left font-medium text-ink">
                    {line.label}
                  </th>
                  <Cell value={line.contacted} href={cellHref(line, "contactees")} />
                  <Cell value={line.replies} href={cellHref(line, "reponses")} />
                  <td className="px-3 py-2 text-right">
                    {/*
                      La barre dans la cellule donne l'ordre de grandeur d'un
                      coup d'œil ; sa largeur vient du taux **calculé par le
                      domaine**, jamais d'une division écrite ici.
                    */}
                    <span className="flex items-center justify-end gap-2">
                      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-line-2" aria-hidden="true">
                        <span
                          className="block h-full rounded-full bg-brand"
                          style={{ width: `${line.rate === null ? 0 : Math.min(100, Math.round(line.rate * 100))}%` }}
                        />
                      </span>
                      <span
                        data-niche-rate
                        className={`tabular-nums ${line.reliability === "unusable" ? "text-closed" : "font-medium text-ink"}`}
                      >
                        {rateLabel(line.rate)}
                      </span>
                    </span>
                  </td>
                  <Cell value={line.demos} href={cellHref(line, "demos")} />
                  <Cell value={line.qualified} href={cellHref(line, "qualifiees")} />
                  <td className="px-3 py-2 text-right">
                    <Sparkline trend={line.trend} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <ReliabilityChip n={line.contacted} reliability={line.reliability} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Cell({ value, href }: { readonly value: number; readonly href: string | null }) {
  return (
    <td className="px-3 py-2 text-right tabular-nums">
      {href === null || value === 0 ? (
        <span className={value === 0 ? "text-muted" : "text-ink"}>{value}</span>
      ) : (
        <Link href={href} className="font-medium text-brand-d hover:underline">
          {value}
        </Link>
      )}
    </td>
  );
}

/**
 * La tendance, en trait de 70 px.
 *
 * Les périodes sans dénominateur coupent le trait : relier par-dessus
 * dessinerait une pente que personne n'a mesurée. Un seul point ne fait pas une
 * tendance et rend un tiret — une sparkline d'un point se lit comme une ligne
 * plate, c'est-à-dire comme une stabilité qu'on n'a pas observée.
 */
function Sparkline({ trend }: { readonly trend: readonly (number | null)[] }) {
  const known = trend.filter((value): value is number => value !== null);
  if (known.length < 2) {
    return (
      <span data-niche-trend="" className="text-muted">
        —
      </span>
    );
  }
  let highest = 0.01;
  for (const value of known) if (value > highest) highest = value;

  const w = 70;
  const h = 18;
  const step = trend.length === 1 ? w : w / (trend.length - 1);
  const parts: string[] = [];
  let open = false;
  for (let index = 0; index < trend.length; index += 1) {
    const value = trend[index];
    if (value === undefined || value === null) {
      open = false;
      continue;
    }
    // `Math.round` et non `toFixed` : la garde statique refuse `toFixed` dans
    // une vue de pilotage, parce que c'est ainsi qu'un second arrondi de taux
    // s'y installe. Ici ce sont des coordonnées, mais une garde sans nuance est
    // plus utile qu'une garde qu'on apprend à contourner.
    const x = Math.round(index * step * 10) / 10;
    const y = Math.round((h - 2 - (value / highest) * (h - 4)) * 10) / 10;
    parts.push(`${open ? "L" : "M"}${x},${y}`);
    open = true;
  }

  return (
    <svg
      width={w}
      height={h}
      data-niche-trend={known.length}
      role="img"
      aria-label={`Tendance du taux cumulé sur ${known.length} périodes`}
      className="inline-block align-middle"
    >
      <path d={parts.join(" ")} fill="none" stroke="var(--color-brand)" strokeWidth="1.6" />
    </svg>
  );
}
