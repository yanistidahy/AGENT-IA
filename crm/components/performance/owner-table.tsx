import type { OwnerLine } from "@/lib/api/performance";
import { formatRate } from "@/lib/domain/email-stats";

/**
 * Yanis et Mohamed côte à côte, sur la même période.
 *
 * Pas pour se comparer — pour voir ce que chacun fait qui marche : le volume à
 * gauche, le résultat à droite, et le taux de réponse **par personne
 * contactée** au bout, seul nombre qui traverse les volumes différents.
 */
export function OwnerTable({ lines }: { readonly lines: readonly OwnerLine[] }) {
  if (lines.length < 2) return null;

  const HEADERS = [
    "Personne",
    "Interactions",
    "Appels",
    "Emails",
    "Réunions",
    "Réponses",
    "RDV",
    "Qualifiés",
    "Taux de rép.",
  ];

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {HEADERS.map((label, index) => (
              <th
                key={label}
                scope="col"
                className={`border-b border-line bg-surface-2 px-3 py-2 font-mono text-[9.5px] font-medium tracking-[0.12em] whitespace-nowrap text-muted uppercase ${
                  index === 0 ? "text-left" : "text-right"
                }`}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.owner} className="hover:bg-surface-2">
              <td className="border-b border-line-2 px-3 py-1.5 text-[12.5px] font-medium whitespace-nowrap">
                {line.owner}
              </td>
              <Num value={String(line.interactions)} />
              <Num value={String(line.calls)} />
              <Num value={String(line.emails)} />
              <Num value={String(line.meetings)} />
              <Num value={String(line.replies)} />
              <Num value={String(line.booked)} />
              <Num value={String(line.qualified)} />
              <Num value={formatRate(line.replyRate)} strong />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Num({ value, strong = false }: { readonly value: string; readonly strong?: boolean }) {
  return (
    <td
      className={`border-b border-line-2 px-3 py-1.5 text-right font-mono text-[12px] tabular-nums ${
        strong ? "font-semibold" : "text-muted"
      }`}
    >
      {value}
    </td>
  );
}
