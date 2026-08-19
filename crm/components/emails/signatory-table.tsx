import { formatRate, type SignatoryLine } from "@/lib/domain/email-stats";

/**
 * Ce que chacun a envoyé, et ce que cela a rapporté.
 *
 * Ils sont deux depuis le jalon 35 : un chiffre global ne dit plus qui écrit ni
 * ce que chacun obtient. Un tableau plutôt qu'un graphique — sur deux ou trois
 * lignes, une barre occupe dix fois la place de ce qu'elle affirme.
 *
 * **Le taux se rapporte aux personnes, pas aux messages** : relancer trois fois
 * la même personne ne divise pas le taux par trois. Et la réponse est créditée
 * au signataire du dernier message qui la précède — c'est à celui-là qu'on
 * répond.
 */
export function SignatoryTable({ lines }: { readonly lines: readonly SignatoryLine[] }) {
  if (lines.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["Signataire", "Messages", "Personnes", "Réponses", "Taux"].map((label, index) => (
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
            <tr key={line.name} className="hover:bg-surface-2">
              <td className="border-b border-line-2 px-3 py-1.5 text-[12.5px] font-medium">
                {line.name}
              </td>
              <Number value={String(line.messages)} />
              <Number value={String(line.people)} />
              <Number value={String(line.replies)} />
              <Number value={formatRate(line.replyRate)} strong />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Number({ value, strong = false }: { readonly value: string; readonly strong?: boolean }) {
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
