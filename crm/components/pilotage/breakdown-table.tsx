import Link from "next/link";
import { NO_DATA, rateLabel, type Breakdown } from "@/lib/domain/pilotage";

/**
 * Un tableau de regroupement — campagnes, segments, groupes de fonction.
 *
 * **Le même jeu de colonnes pour les trois axes**, parce qu'elles viennent de la
 * même fonction (`breakdown`) : « taux de réponse » veut donc dire la même chose
 * dans les trois tableaux, et il n'existe pas un comptage « pour le tableau » et
 * un autre « pour la pastille ».
 *
 * Le tri passe par des **liens** : la page reste un composant serveur, et la vue
 * triée se met en favori (le motif de `/contacts` depuis le jalon 21).
 */

export const BREAKDOWN_COLUMNS = [
  { key: "label", label: "", numeric: false },
  { key: "contacted", label: "Personnes", numeric: true },
  { key: "messages", label: "Messages", numeric: true },
  { key: "replies", label: "Réponses", numeric: true },
  { key: "replyRate", label: "Taux", numeric: true },
  { key: "demos", label: "Démos", numeric: true },
  { key: "qualified", label: "Qualifiées", numeric: true },
] as const;

export type BreakdownSort = (typeof BREAKDOWN_COLUMNS)[number]["key"];

export function BreakdownTable({
  title,
  hint,
  lines,
  sort,
  dir,
  sortHref,
  cellHref,
}: {
  readonly title: string;
  readonly hint?: string;
  readonly lines: readonly Breakdown[];
  readonly sort: BreakdownSort;
  readonly dir: "asc" | "desc";
  readonly sortHref: (key: BreakdownSort) => string;
  /** Le lien de la cellule : chaque nombre ouvre sa liste. */
  readonly cellHref: (line: Breakdown, column: BreakdownSort) => string | null;
}) {
  return (
    <div className="rounded-card border border-line bg-surface">
      <header className="flex flex-wrap items-baseline gap-x-2 border-b border-line px-4 py-3">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">{title}</h2>
        {hint !== undefined && <span className="text-[12px] text-muted">{hint}</span>}
      </header>

      {lines.length === 0 ? (
        <p className="px-4 py-5 text-[13px] text-muted">{NO_DATA}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line-2 text-left">
                {BREAKDOWN_COLUMNS.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`px-3 py-2 text-[11.5px] font-semibold tracking-wide text-muted uppercase ${
                      column.numeric ? "text-right" : ""
                    }`}
                  >
                    <Link
                      href={sortHref(column.key)}
                      data-sort={column.key}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      {column.label === "" ? " " : column.label}
                      {sort === column.key && <span aria-hidden>{dir === "asc" ? "↑" : "↓"}</span>}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key} data-line={line.key} className="border-b border-line-2 last:border-0">
                  <td className="max-w-[260px] truncate px-3 py-2 font-medium">{line.label}</td>
                  <Cell line={line} column="contacted" value={line.contacted} cellHref={cellHref} />
                  <Cell line={line} column="messages" value={line.messages} cellHref={cellHref} />
                  <Cell line={line} column="replies" value={line.replies} cellHref={cellHref} />
                  <td className="px-3 py-2 text-right tabular-nums text-muted">
                    {rateLabel(line.replyRate)}
                  </td>
                  <Cell line={line} column="demos" value={line.demos} cellHref={cellHref} />
                  <Cell line={line} column="qualified" value={line.qualified} cellHref={cellHref} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Cell({
  line,
  column,
  value,
  cellHref,
}: {
  readonly line: Breakdown;
  readonly column: BreakdownSort;
  readonly value: number;
  readonly cellHref: (line: Breakdown, column: BreakdownSort) => string | null;
}) {
  const href = cellHref(line, column);
  return (
    <td className="px-3 py-2 text-right tabular-nums" data-cell={column} data-count={value}>
      {href === null || value === 0 ? (
        <span className={value === 0 ? "text-muted" : undefined}>{value}</span>
      ) : (
        <Link href={href} className="underline decoration-line underline-offset-2 hover:text-brand-d">
          {value}
        </Link>
      )}
    </td>
  );
}
