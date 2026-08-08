"use client";

import { EmptyState, FollowUpTag, LifecycleTag } from "@/components/ui/primitives";
import type { ContactRecord } from "@/lib/api/contacts";
import { daysSince } from "@/lib/domain/dates";
import {
  describeReminder,
  emptyFilterMessage,
  needsAttention,
  type ContactFilter,
} from "@/lib/domain/follow-up";
import type { PilotageSettings } from "@/lib/domain/types";
import { formatDate } from "@/lib/format";

export type ContactSortKey =
  | "lastName"
  | "firstName"
  | "company"
  | "lifecycle"
  | "owner"
  | "lastContact"
  | "followUp"
  | "nextReminder";

interface ContactsTableProps {
  readonly contacts: readonly ContactRecord[];
  readonly settings: PilotageSettings;
  readonly sort: ContactSortKey | undefined;
  readonly dir: "asc" | "desc";
  readonly onSort: (key: ContactSortKey) => void;
  readonly onSelect: (contact: ContactRecord) => void;
  /** Filtre actif, pour expliquer une liste vide par la règle qui l'a produite. */
  readonly filter: ContactFilter | null;
}

const COLUMNS: ReadonlyArray<{ key: ContactSortKey | null; label: string }> = [
  { key: "lastName", label: "Contact" },
  { key: "company", label: "Société" },
  { key: "lifecycle", label: "Cycle de vie" },
  { key: "followUp", label: "Statut" },
  { key: "nextReminder", label: "Prochaine relance" },
  { key: "lastContact", label: "Dernier contact" },
  { key: null, label: "Affaires" },
  { key: "owner", label: "Propriétaire" },
];

export function ContactsTable({
  contacts,
  settings,
  sort,
  dir,
  onSort,
  onSelect,
  filter,
}: ContactsTableProps) {
  const now = new Date();

  if (contacts.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface shadow-card">
        <EmptyState title="Aucun contact ne correspond.">
          <span className="mx-auto block max-w-[52ch] text-[13px] leading-relaxed">
            {filter === null
              ? "Modifiez les filtres, créez un contact, ou importez une liste depuis votre tableur."
              : emptyFilterMessage(filter, settings)}
          </span>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {COLUMNS.map(({ key, label }) => (
              <th
                key={label}
                scope="col"
                className="border-b border-line bg-surface-2 px-3.5 py-2.5 text-left font-mono text-[9.5px] font-medium tracking-[0.12em] whitespace-nowrap text-muted uppercase"
              >
                {key === null ? (
                  label
                ) : (
                  <button
                    type="button"
                    onClick={() => onSort(key)}
                    className="uppercase transition-colors hover:text-ink"
                  >
                    {label}
                    {sort === key && (dir === "desc" ? " ↓" : " ↑")}
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => {
            const idle = contact.idleDays;
            // Couleur pilotée par le statut, pas par un seuil recalculé ici :
            // une relance déjà programmée n'est pas une alerte. Voir needsAttention().
            const stale = needsAttention(contact.followUp);
            const openDeals = contact.deals.filter((deal) => deal.status === "open").length;
            // Hiérarchie de la colonne « Prochaine relance » : le retard et le
            // jour même en rouge, l'à-venir en poids normal avec son délai.
            const reminder =
              contact.nextReminder === null
                ? null
                : describeReminder(contact.nextReminder, now);

            return (
              <tr
                key={contact.id}
                onClick={() => onSelect(contact)}
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(contact);
                  }
                }}
                className="cursor-pointer transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
              >
                <td className="border-b border-line-2 px-3.5 py-3">
                  <span className="font-semibold">
                    {contact.firstName} {contact.lastName}
                  </span>
                  <br />
                  <span className="text-[12.5px] text-muted">{contact.title || "—"}</span>
                </td>
                <td className="border-b border-line-2 px-3.5 py-3">
                  {contact.company?.name ?? "—"}
                </td>
                <td className="border-b border-line-2 px-3.5 py-3">
                  <LifecycleTag lifecycle={contact.lifecycle} />
                </td>
                <td className="border-b border-line-2 px-3.5 py-3">
                  <FollowUpTag
                    status={contact.followUp}
                    suffix={
                      contact.followUp === "silent" && idle !== null ? `${idle} j` : undefined
                    }
                  />
                </td>
                <td className="border-b border-line-2 px-3.5 py-3 font-mono text-[12.5px]">
                  {reminder === null || contact.nextReminder === null ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <>
                      <span
                        className={
                          reminder.urgency === "future"
                            ? "text-ink"
                            : "font-semibold text-[#B2311F]"
                        }
                      >
                        {formatDate(contact.nextReminder)}
                      </span>
                      <span
                        className={`block text-[11.5px] ${
                          reminder.urgency === "future"
                            ? "text-muted"
                            : "font-semibold text-[#B2311F]"
                        }`}
                      >
                        {reminder.label}
                      </span>
                    </>
                  )}
                </td>
                <td className="border-b border-line-2 px-3.5 py-3 font-mono text-[12.5px]">
                  <span className={stale ? "font-semibold text-[#B2311F]" : "text-muted"}>
                    {contact.lastContact === null ? "jamais" : formatDate(contact.lastContact)}
                  </span>
                  {idle !== null && (
                    <span className="block text-[11.5px] text-muted">{idle} j</span>
                  )}
                </td>
                <td className="border-b border-line-2 px-3.5 py-3 text-[12.5px] text-muted">
                  {contact.deals.length === 0
                    ? "—"
                    : `${contact.deals.length} · ${openDeals} en cours`}
                </td>
                <td className="border-b border-line-2 px-3.5 py-3 text-[12.5px] text-muted">
                  {contact.owner || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
