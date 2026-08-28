"use client";

import { useState } from "react";
import { instagramLabel, instagramUrl } from "@/lib/domain/instagram";
import { ExternalLink } from "@/components/ui/external-link";
import { Eyebrow } from "@/components/ui/primitives";
import type { ContactRecord } from "@/lib/api/contacts";
import { daysSince } from "@/lib/domain/dates";
import { formatDate } from "@/lib/format";

/**
 * L'onglet « Fiche » : les champs, sur deux colonnes.
 *
 * Le partage entre ce qui est visible et ce qui est replié n'est pas
 * esthétique. Département, source et propriétaire se consultent quelques fois
 * par mois ; adresse, société, site et LinkedIn se consultent avant chaque
 * appel — ce sont exactement les deux liens qu'on veut ouvrir sans avoir à
 * déplier quoi que ce soit.
 */
export function ContactFields({ contact }: { contact: ContactRecord }) {
  const [more, setMore] = useState(false);
  const now = new Date();

  return (
    <div className="py-4">
      <dl className="grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
        <Field label="Email">
          {contact.email === "" ? (
            "—"
          ) : (
            <a href={`mailto:${contact.email}`} className="text-brand-d hover:underline">
              {contact.email}
            </a>
          )}
        </Field>
        <Field label="Téléphone">{contact.phone || "—"}</Field>
        <Field label="Société">{contact.company?.name ?? "—"}</Field>
        <Field label="Fonction">{contact.title || "—"}</Field>
        <Field label="Site">
          <ExternalLink value={contact.website} />
        </Field>
        <Field label="LinkedIn">
          <ExternalLink value={contact.linkedin} />
        </Field>
        <Field label="Instagram">
          {instagramUrl(contact.instagram) === null ? (
            // La valeur brute reste lisible quand elle ne fait pas un lien :
            // quelqu'un a peut-être écrit une note dans le champ, et l'effacer
            // de l'écran ferait croire qu'il est vide.
            <span className="text-muted">{contact.instagram || "—"}</span>
          ) : (
            <a
              href={instagramUrl(contact.instagram) ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-d hover:underline"
            >
              {instagramLabel(contact.instagram)}
            </a>
          )}
        </Field>
        <Field label="Étiquette">{contact.tag || "—"}</Field>
        <Field label="Dernier contact">
          {contact.lastContact === null
            ? "jamais"
            : `${formatDate(contact.lastContact)} · ${daysSince(contact.lastContact, now)} j`}
        </Field>
        {contact.lostReason !== "" && <Field label="Motif de perte">{contact.lostReason}</Field>}
      </dl>

      <button
        type="button"
        aria-expanded={more}
        onClick={() => setMore(!more)}
        className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted transition-colors hover:text-ink"
      >
        <span aria-hidden className="text-[10px]">
          {more ? "▾" : "▸"}
        </span>
        Plus de détails
      </button>

      {more && (
        <dl className="mt-2 grid gap-x-5 gap-y-2.5 sm:grid-cols-2">
          <Field label="Département">{contact.dep || "—"}</Field>
          <Field label="Source">{contact.source || "—"}</Field>
          <Field label="Propriétaire">{contact.owner || "—"}</Field>
          <Field label="Créé le">
            {formatDate(contact.createdAt)} · {contact.ageDays} j
          </Field>
          <Field label="Statut saisi le">
            {contact.statusSetAt === null ? "—" : formatDate(contact.statusSetAt)}
          </Field>
        </dl>
      )}

      {contact.notes !== "" && (
        <div className="mt-4 rounded-card border border-line bg-surface-2 px-3.5 py-3">
          <Eyebrow>Notes</Eyebrow>
          <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line">{contact.notes}</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[9.5px] tracking-[0.1em] text-muted uppercase">{label}</dt>
      <dd className="mt-0.5 text-[13.5px] font-medium break-words">{children}</dd>
    </div>
  );
}
