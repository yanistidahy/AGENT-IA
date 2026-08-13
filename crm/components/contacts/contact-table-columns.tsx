"use client";

import type { ReactNode } from "react";
import { ContactStatusTag, LifecycleTag } from "@/components/ui/primitives";
import type { ContactRecord } from "@/lib/api/contacts";
import { describeReminder } from "@/lib/domain/follow-up";
import { resolveStatus } from "@/lib/domain/status";
import { formatDate } from "@/lib/format";
import { EXTRA_COLUMNS } from "./contact-table-extra-columns";

/**
 * Les colonnes de `/contacts`, définies une fois.
 *
 * Elles étaient écrites deux fois — un `<th>` dans une liste, un `<td>` en dur
 * dans le corps — et rien ne garantissait que les deux restent alignées. Une
 * colonne est maintenant **une** entrée : son libellé, son tri, son filtre et
 * sa cellule. En ajouter une, la masquer ou la déplacer ne touche qu'ici.
 *
 * `DEFAULT_COLUMNS` porte le second changement demandé : neuf colonnes en même
 * temps ne se comparent pas, elles se subissent. Six suffisent au quotidien —
 * qui, où, dans quel état, quand relancer, depuis quand silence, et le numéro.
 * Le reste reste à un clic, et le choix est conservé.
 */
export type ContactSortKey =
  | "lastName"
  | "firstName"
  | "company"
  | "lifecycle"
  | "owner"
  | "lastContact"
  | "tag"
  | "followUp"
  | "nextReminder"
  | "createdAt";

export interface ContactColumn {
  /** Clé stable : elle est conservée dans le stockage local. */
  readonly key: string;
  readonly label: string;
  readonly sort: ContactSortKey | null;
  /** Colonne de `CONTACT_FILTER_COLUMNS`, ou `null` si non filtrable. */
  readonly filterKey: string | null;
  readonly cell: (contact: ContactRecord, now: Date) => ReactNode;
}

const MUTED = <span className="text-muted">—</span>;

export const CONTACT_COLUMNS: readonly ContactColumn[] = [
  {
    key: "contact",
    label: "Contact",
    sort: "lastName",
    filterKey: null,
    cell: (contact) => (
      <>
        <span className="font-semibold">
          {contact.firstName} {contact.lastName}
        </span>
        <br />
        <span className="text-[12.5px] text-muted">{contact.title || "—"}</span>
      </>
    ),
  },
  {
    key: "company",
    label: "Société",
    sort: "company",
    filterKey: "company",
    cell: (contact) => contact.company?.name ?? "—",
  },
  {
    key: "status",
    label: "Statut",
    sort: "followUp",
    filterKey: "status",
    cell: (contact) => (
      <ContactStatusTag
        status={contact.status}
        followUp={contact.followUp}
        suffix={
          contact.followUp === "silent" && contact.idleDays !== null
            ? `${contact.idleDays} j`
            : undefined
        }
      />
    ),
  },
  {
    key: "nextReminder",
    label: "Prochaine relance",
    sort: "nextReminder",
    filterKey: "nextReminder",
    cell: (contact, now) => {
      if (contact.nextReminder === null) return MUTED;
      const reminder = describeReminder(contact.nextReminder, now);
      const late = reminder.urgency !== "future";
      return (
        <>
          <span className={late ? "font-semibold text-[#B2311F]" : "text-ink"}>
            {formatDate(contact.nextReminder)}
          </span>
          <span
            className={`block text-[11.5px] ${late ? "font-semibold text-[#B2311F]" : "text-muted"}`}
          >
            {reminder.label}
          </span>
        </>
      );
    },
  },
  {
    key: "lastContact",
    label: "Dernier contact",
    sort: "lastContact",
    filterKey: "lastContact",
    cell: (contact) => (
      <>
        {/* La couleur vient du statut, jamais d'un seuil recalculé ici : une
            relance déjà programmée n'est pas une alerte. Voir needsAttention(). */}
        <span className={resolveStatus(contact).attention ? "font-semibold text-[#B2311F]" : "text-muted"}>
          {contact.lastContact === null ? "jamais" : formatDate(contact.lastContact)}
        </span>
        {contact.idleDays !== null && (
          <span className="block text-[11.5px] text-muted">{contact.idleDays} j</span>
        )}
      </>
    ),
  },
  {
    key: "phone",
    label: "Téléphone",
    sort: null,
    filterKey: null,
    cell: (contact) =>
      contact.phone.trim() === "" ? (
        MUTED
      ) : (
        // `stopPropagation` : la ligne entière ouvre la fiche, et composer un
        // numéro ne doit pas ouvrir un tiroir par-dessus l'appel.
        <a
          href={`tel:${contact.phone.replace(/\s/g, "")}`}
          onClick={(event) => event.stopPropagation()}
          className="text-brand-d hover:underline"
        >
          {contact.phone}
        </a>
      ),
  },
  {
    key: "lifecycle",
    label: "Cycle de vie",
    sort: "lifecycle",
    filterKey: "lifecycle",
    cell: (contact) => (
      <>
        <LifecycleTag lifecycle={contact.lifecycle} />
        {contact.lostReason !== "" && (
          <span className="mt-0.5 block text-[11.5px] text-muted">{contact.lostReason}</span>
        )}
      </>
    ),
  },
  {
    key: "tag",
    label: "Étiquette",
    sort: "tag",
    filterKey: "tag",
    cell: (contact) =>
      contact.tag === "" ? (
        MUTED
      ) : (
        <span className="rounded-control border border-line bg-surface-2 px-1.5 py-0.5">
          {contact.tag}
        </span>
      ),
  },
  {
    key: "deals",
    label: "Affaires",
    sort: null,
    filterKey: null,
    cell: (contact) => {
      if (contact.deals.length === 0) return MUTED;
      const open = contact.deals.filter((deal) => deal.status === "open").length;
      return `${contact.deals.length} · ${open} en cours`;
    },
  },
  {
    key: "owner",
    label: "Propriétaire",
    sort: "owner",
    filterKey: "owner",
    cell: (contact) => contact.owner || "—",
  },
  ...EXTRA_COLUMNS,
];

/** Les six du quotidien. Le reste s'ajoute depuis le sélecteur « Colonnes ». */
export const DEFAULT_COLUMNS: readonly string[] = [
  "contact",
  "company",
  "status",
  "nextReminder",
  "lastContact",
  "phone",
];

/**
 * La colonne « Contact » ne se masque pas.
 *
 * Un tableau dont on peut retirer le nom des gens n'est plus un tableau de
 * contacts. C'est la seule contrainte du sélecteur.
 */
export const LOCKED_COLUMN = "contact";
