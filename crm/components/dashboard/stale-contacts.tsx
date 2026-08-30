import Link from "next/link";
import { ContactStatusTag, LifecycleTag } from "@/components/ui/primitives";
import { contactAttention } from "@/lib/domain/contact-status";
import { isTerminal } from "@/lib/domain/lost";
import type { StaleContact } from "@/lib/api/dashboard";
import { needsAttention } from "@/lib/domain/follow-up";
import { formatDate } from "@/lib/format";
import { contactTitle } from "@/lib/domain/contact-identity";

/**
 * « Qui avons-nous oublié ? »
 *
 * Le rouge n'est pas décoratif et n'est pas calculé ici : il vient de
 * `needsAttention(statut)`, la même fonction que /contacts et /clients. Le
 * statut dépend de `coldDays`, réglable dans Réglages — changer le seuil déplace
 * donc les trois écrans d'un coup, et aucun ne peut contredire les autres.
 *
 * Composant serveur : le tri passe par des liens, pas par un état de composant.
 * Aucun JavaScript n'est envoyé au navigateur pour trier un tableau, et l'ordre
 * choisi se retrouve dans l'URL comme tous les autres filtres du produit.
 */
export const STALE_SORTS = ["staleness", "name", "lifecycle"] as const;
export type StaleSort = (typeof STALE_SORTS)[number];

export function toStaleSort(value: string | undefined): StaleSort {
  return STALE_SORTS.find((candidate) => candidate === value) ?? "staleness";
}

interface StaleContactsProps {
  readonly contacts: readonly StaleContact[];
  readonly sort: StaleSort;
  readonly limit?: number;
}

/** `hide` : colonnes cédées sous `lg` — le nom, l'état et le silence suffisent
    à décider qui rappeler ; le reste est dans la fiche, à un tap. */
const COLUMNS: ReadonlyArray<{ key: StaleSort | null; label: string; hide?: string }> = [
  { key: "name", label: "Contact" },
  // Sous `lg`, la pastille cède aussi : le rouge du silence porte déjà le
  // signal, et une pastille de 100 px rendait au tableau son défilement.
  { key: "lifecycle", label: "Cycle de vie", hide: "max-lg:hidden" },
  { key: "staleness", label: "Dernière touche" },
  { key: null, label: "Prochaine action", hide: "max-lg:hidden" },
  { key: null, label: "Propriétaire", hide: "max-lg:hidden" },
];

/** Un contact jamais touché est le cas le plus préoccupant : il passe en tête. */
function rank(contact: StaleContact): number {
  return contact.idleDays ?? Number.MAX_SAFE_INTEGER;
}

function sortContacts(
  contacts: readonly StaleContact[],
  sort: StaleSort,
): StaleContact[] {
  const copy = [...contacts];
  if (sort === "name") return copy.sort((a, b) => a.lastName.localeCompare(b.lastName));
  if (sort === "lifecycle") {
    return copy.sort(
      (a, b) => a.lifecycle.localeCompare(b.lifecycle) || rank(b) - rank(a),
    );
  }
  return copy.sort((a, b) => rank(b) - rank(a));
}

export function StaleContacts({ contacts, sort, limit = 12 }: StaleContactsProps) {
  if (contacts.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
        Aucun contact actif. Importez une liste depuis Contacts.
      </p>
    );
  }

  const shown = sortContacts(contacts, sort).slice(0, limit);

  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {COLUMNS.map(({ key, label, hide }) => (
              <th
                key={label}
                scope="col"
                className={`border-b border-line bg-surface-2 px-3.5 py-2.5 text-left font-mono text-[9.5px] font-medium tracking-[0.12em] text-muted uppercase lg:whitespace-nowrap ${hide ?? ""}`}
              >
                {key === null ? (
                  label
                ) : (
                  <Link
                    href={key === "staleness" ? "/" : `/?tri=${key}`}
                    scroll={false}
                    className="uppercase transition-colors hover:text-ink"
                  >
                    {label}
                    {sort === key && " ↓"}
                  </Link>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((contact) => {
            // Même règle que /contacts et /clients : c'est le statut qui décide,
            // pas un seuil recalculé — sans quoi une relance programmée
            // s'afficherait en rouge ici et en bleu là-bas.
            const cold = contactAttention(contact);

            return (
              <tr key={contact.id} className="transition-colors hover:bg-surface-2">
                <td className="border-b border-line-2 px-3.5 py-2.5 max-lg:px-2">
                  <Link
                    href={`/contacts?lifecycle=all&fiche=${contact.id}`}
                    className="font-semibold hover:underline"
                  >
                    {contactTitle(contact)}
                  </Link>
                  <br />
                  <span className="text-[12px] text-muted">{contact.companyName ?? "—"}</span>
                </td>
                <td className="border-b border-line-2 px-3.5 py-2.5 max-lg:hidden">
                  <span className="flex flex-wrap items-center gap-1.5">
                    {/* Même cellule que la pastille de statut, qui porte déjà
                        « Perdu » sur une fiche close : une seule suffit. */}
                    {!isTerminal(contact.lifecycle) && (
                      <LifecycleTag lifecycle={contact.lifecycle} />
                    )}
                    <ContactStatusTag
                      status={contact.status}
                      followUp={contact.followUp}
                      lifecycle={contact.lifecycle}
                    />
                  </span>
                </td>
                <td className="border-b border-line-2 px-3.5 py-2.5 max-lg:px-2 font-mono text-[12.5px]">
                  <span className={cold ? "font-semibold text-[#B2311F]" : "text-muted"}>
                    {contact.idleDays === null ? "jamais" : `${contact.idleDays} j`}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {formatDate(contact.lastContact)}
                  </span>
                </td>
                <td className="border-b border-line-2 px-3.5 py-2.5 max-lg:px-2 text-[12.5px] max-lg:hidden">
                  {contact.nextAction === null ? (
                    <span className="text-muted">—</span>
                  ) : (
                    <>
                      {contact.nextAction.title}
                      <span className="block font-mono text-[11px] text-muted">
                        {formatDate(contact.nextAction.due)}
                      </span>
                    </>
                  )}
                </td>
                <td className="border-b border-line-2 px-3.5 py-2.5 max-lg:px-2 text-[12.5px] text-muted max-lg:hidden">
                  {contact.owner || "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {contacts.length > shown.length && (
        <p className="border-t border-line px-3.5 py-2 text-[12px] text-muted">
          {shown.length} sur {contacts.length} —{" "}
          <Link href="/contacts?sort=lastContact&dir=asc" className="text-brand-d hover:underline">
            voir tous les contacts
          </Link>
        </p>
      )}
    </div>
  );
}
