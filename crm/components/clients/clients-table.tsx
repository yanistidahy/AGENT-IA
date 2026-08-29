import Link from "next/link";
import { ContactStatusTag, Eyebrow } from "@/components/ui/primitives";
import { contactAttention } from "@/lib/domain/contact-status";
import type { ClientRow, ClientSort } from "@/lib/api/clients";
import { needsAttention } from "@/lib/domain/follow-up";
import { formatDate, money, moneyShort } from "@/lib/format";
import type { FacetValue } from "@/lib/domain/column-match";
import { ClientFilterCell } from "./client-filter-cell";
import { contactTitle } from "@/lib/domain/contact-identity";

/**
 * Portefeuille clients.
 *
 * Composant serveur : le tri passe par des liens, comme le tableau « dernière
 * touche » du centre de pilotage. Aucun JavaScript n'est envoyé pour trier.
 */
interface ClientsTableProps {
  readonly clients: readonly ClientRow[];
  readonly sort: ClientSort;
  readonly coldDays: number;
  readonly facets: Readonly<Record<string, readonly FacetValue[]>>;
}

/** `filter` désigne la colonne filtrable ; `null` quand elle ne l'est pas. */
const COLUMNS: ReadonlyArray<{
  key: ClientSort | null;
  label: string;
  filter: string | null;
  numeric?: boolean;
}> = [
  { key: "name", label: "Client", filter: null },
  { key: null, label: "Société", filter: "company" },
  { key: "revenue", label: "CA signé", filter: "wonValue", numeric: true },
  { key: null, label: "Pipeline ouvert", filter: "openValue", numeric: true },
  { key: "signedAt", label: "Signé le", filter: "signedAt" },
  { key: "lastContact", label: "Dernière interaction", filter: "lastContact" },
  { key: null, label: "Prochaine relance", filter: "nextReminder" },
  { key: "followUp", label: "Statut", filter: "followUp" },
];

export function ClientsTable({ clients, sort, coldDays, facets }: ClientsTableProps) {
  if (clients.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface px-5 py-11 text-center shadow-card">
        <b className="mb-1.5 block font-display text-[15px]">Aucun client pour l'instant.</b>
        <span className="text-[13px] text-muted">
          Un contact devient client quand son cycle de vie passe à « Client » — ce que
          propose la fiche d'une affaire gagnée.
        </span>
      </div>
    );
  }

  return (
    <>
      {/* La forme cartes du téléphone. Rendue ici plutôt que par `CardList` :
          ce tableau est un composant serveur, et des fonctions de rendu ne
          franchissent pas la frontière serveur → client. Le lien fait office
          de tap — la fiche porte le reste. */}
      <ul className="grid gap-2 lg:hidden">
        {clients.map((client) => (
          <li key={client.id}>
            <Link
              href={`/contacts?lifecycle=all&fiche=${client.id}`}
              className="block rounded-card border border-line bg-surface px-3.5 py-3 shadow-card transition-colors active:bg-surface-2"
            >
              <div className="truncate text-[14.5px] font-semibold">
                {contactTitle(client)}
              </div>
              {client.companyName !== null && client.companyName !== "" && (
                <div className="truncate text-[12px] text-muted">{client.companyName}</div>
              )}
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                <div className="flex items-baseline gap-1.5">
                  <dt className="font-mono text-[9.5px] tracking-[0.1em] text-muted uppercase">
                    CA signé
                  </dt>
                  <dd className="font-mono text-[12.5px] font-semibold tabular-nums">
                    {money(client.wonValue)}
                  </dd>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <dt className="font-mono text-[9.5px] tracking-[0.1em] text-muted uppercase">
                    Dernier contact
                  </dt>
                  <dd className="font-mono text-[12.5px] tabular-nums">
                    {client.lastContact === null ? "—" : formatDate(client.lastContact)}
                  </dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>

      <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card max-lg:hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {COLUMNS.map(({ key, label, filter, numeric }) => (
              <th
                key={label}
                scope="col"
                className={`border-b border-line bg-surface-2 px-3.5 py-2.5 font-mono text-[9.5px] font-medium tracking-[0.12em] whitespace-nowrap text-muted uppercase ${
                  numeric === true ? "text-right" : "text-left"
                }`}
              >
                <span className="inline-flex items-center">
                  {key === null ? (
                    label
                  ) : (
                    <Link
                      href={key === "revenue" ? "/clients" : `/clients?tri=${key}`}
                      scroll={false}
                      className="uppercase transition-colors hover:text-ink"
                    >
                      {label}
                      {sort === key && " ↓"}
                    </Link>
                  )}
                  {filter !== null && (
                    <ClientFilterCell columnKey={filter} facets={facets[filter] ?? []} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => {
            // Même source de vérité que /contacts et /accueil.
            const cold = contactAttention(client);

            return (
              <tr key={client.id} className="transition-colors hover:bg-surface-2">
                <td className="border-b border-line-2 px-3.5 py-2.5">
                  <Link
                    href={`/contacts?lifecycle=all&fiche=${client.id}`}
                    className="font-semibold hover:underline"
                  >
                    {contactTitle(client)}
                  </Link>
                  <br />
                  <span className="text-[12px] text-muted">{client.owner || "—"}</span>
                </td>
                <td className="border-b border-line-2 px-3.5 py-2.5 text-[13px]">
                  {client.companyName ?? "—"}
                </td>
                <td className="border-b border-line-2 px-3.5 py-2.5 text-right font-mono font-semibold tabular-nums">
                  {money(client.wonValue)}
                  <span className="block text-[11px] font-normal text-muted">
                    {client.wonCount} affaire(s)
                  </span>
                </td>
                <td className="border-b border-line-2 px-3.5 py-2.5 text-right font-mono text-muted tabular-nums">
                  {client.openValue === 0 ? "—" : money(client.openValue)}
                </td>
                <td className="border-b border-line-2 px-3.5 py-2.5 font-mono text-[12.5px] text-muted">
                  {formatDate(client.signedAt)}
                </td>
                <td className="border-b border-line-2 px-3.5 py-2.5 font-mono text-[12.5px]">
                  <span className={cold ? "font-semibold text-[#B2311F]" : "text-muted"}>
                    {client.idleDays === null ? "jamais" : `${client.idleDays} j`}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {formatDate(client.lastContact)}
                  </span>
                </td>
                <td className="border-b border-line-2 px-3.5 py-2.5 font-mono text-[12.5px] text-muted">
                  {formatDate(client.nextReminder)}
                </td>
                <td className="border-b border-line-2 px-3.5 py-2.5">
                  <ContactStatusTag
                    status={client.status}
                    followUp={client.followUp}
                    lifecycle={client.lifecycle}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
}

export function PortfolioTotals({
  count,
  total,
  average,
}: {
  count: number;
  total: number;
  average: number;
}) {
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-3">
      <Stat label="Clients actifs" value={String(count)} />
      <Stat label="CA signé cumulé" value={moneyShort(total)} />
      <Stat label="CA moyen par client" value={moneyShort(average)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3 shadow-card">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-1 font-display text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
