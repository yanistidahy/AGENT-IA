"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { Eyebrow, LifecycleTag, StatusTag } from "@/components/ui/primitives";
import type { ContactRecord } from "@/lib/api/contacts";
import { deleteContact } from "@/lib/client/crm-api";
import { daysSince } from "@/lib/domain/dates";
import { formatDate, money } from "@/lib/format";
import { RecordPanel } from "@/components/activities/record-panel";
import type { SequenceOption } from "@/components/activities/run-sequence";
import type { Alert } from "@/lib/domain/types";
import { ContactForm, type ContactFormOptions } from "./contact-form";
import { LinkDeal, type LinkableDeal } from "./link-deal";

interface ContactDrawerProps extends ContactFormOptions {
  readonly contact: ContactRecord | null;
  readonly linkableDeals: readonly LinkableDeal[];
  readonly sequences: readonly SequenceOption[];
  readonly alerts: readonly Alert[];
  readonly onClose: () => void;
  readonly onChanged: () => void;
}

export function ContactDrawer({
  contact,
  linkableDeals,
  sequences,
  alerts,
  onClose,
  onChanged,
  ...options
}: ContactDrawerProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (contact === null) return null;

  const now = new Date();
  const openValue = contact.deals
    .filter((deal) => deal.status === "open")
    .reduce((total, deal) => total + deal.amount, 0);
  const wonValue = contact.deals
    .filter((deal) => deal.status === "won")
    .reduce((total, deal) => total + deal.amount, 0);

  const remove = async () => {
    setBusy(true);
    setError(null);
    const result = await deleteContact(contact.id);
    setBusy(false);
    if (result.ok) onChanged();
    else setError(result.message);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={`${contact.firstName} ${contact.lastName}`}
      subtitle={`${contact.title || "Fonction non renseignée"} · ${contact.company?.name ?? "Sans société"}`}
      footer={
        editing ? undefined : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-control bg-ink px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-ink-3"
            >
              Modifier
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => (confirming ? void remove() : setConfirming(true))}
              className="ml-auto rounded-control border border-[#F0C9C2] px-4 py-2 text-[13px] font-semibold text-[#B2311F] transition-colors hover:bg-pulse-l disabled:opacity-50"
            >
              {confirming ? "Confirmer la suppression" : "Supprimer"}
            </button>
          </>
        )
      }
    >
      {editing ? (
        <ContactForm
          {...options}
          contact={contact}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            <LifecycleTag lifecycle={contact.lifecycle} />
            {contact.owner !== "" && (
              <span className="inline-flex items-center rounded-full bg-paper px-2 py-[3px] text-[11.5px] font-semibold text-muted">
                {contact.owner}
              </span>
            )}
            {contact.source !== "" && (
              <span className="inline-flex items-center rounded-full bg-paper px-2 py-[3px] text-[11.5px] font-semibold text-muted">
                {contact.source}
              </span>
            )}
          </div>

          {confirming && (
            <p className="mb-4 rounded-control border border-[#F0C9C2] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
              Les affaires et interactions liées seront conservées, mais détachées. Les tâches
              de ce contact seront supprimées. Cliquez à nouveau sur « Supprimer » pour confirmer.
            </p>
          )}

          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-card border border-line bg-surface-2 px-4 py-3">
              <Eyebrow>Pipeline ouvert</Eyebrow>
              <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums">
                {money(openValue)}
              </div>
            </div>
            <div className="rounded-card border border-line bg-surface-2 px-4 py-3">
              <Eyebrow>CA signé</Eyebrow>
              <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums">
                {money(wonValue)}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-[130px_1fr] gap-x-3.5 gap-y-2.5 text-[13.5px]">
            <Row label="Email">
              {contact.email === "" ? (
                "—"
              ) : (
                <a href={`mailto:${contact.email}`} className="text-flux-d hover:underline">
                  {contact.email}
                </a>
              )}
            </Row>
            <Row label="Téléphone">{contact.phone || "—"}</Row>
            <Row label="LinkedIn">
              {contact.linkedin === "" ? (
                "—"
              ) : (
                <a
                  href={contact.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="text-flux-d hover:underline"
                >
                  {contact.linkedin}
                </a>
              )}
            </Row>
            <Row label="Département">{contact.dep || "—"}</Row>
            <Row label="Société">{contact.company?.name ?? "—"}</Row>
            <Row label="Dernier contact">
              {contact.lastContact === null
                ? "jamais"
                : `${formatDate(contact.lastContact)} · ${daysSince(contact.lastContact, now)} j`}
            </Row>
            <Row label="Prochaine relance">{formatDate(contact.nextReminder)}</Row>
            <Row label="Créé le">{formatDate(contact.createdAt)}</Row>
          </dl>

          {contact.notes !== "" && (
            <div className="mt-4 rounded-card border border-line bg-surface-2 px-3.5 py-3">
              <Eyebrow>Notes</Eyebrow>
              <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line">
                {contact.notes}
              </p>
            </div>
          )}

          <h3 className="mt-6 mb-2.5 font-display text-sm font-semibold">
            Affaires liées ({contact.deals.length})
          </h3>
          {contact.deals.length === 0 ? (
            <p className="rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
              Aucune affaire rattachée à ce contact.
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {contact.deals.map((deal) => (
                <li
                  key={deal.id}
                  className="flex flex-wrap items-center gap-2 rounded-card border border-line px-3 py-2 text-[13px]"
                >
                  <span className="font-semibold">{deal.name}</span>
                  <span
                    className="rounded-full px-2 py-[2px] text-[11px] font-semibold"
                    style={{ backgroundColor: `${deal.stage.color}1f`, color: deal.stage.color }}
                  >
                    {deal.stage.name}
                  </span>
                  {deal.status !== "open" && <StatusTag status={deal.status} />}
                  <span className="ml-auto font-mono font-semibold tabular-nums">
                    {money(deal.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <LinkDeal contactId={contact.id} deals={linkableDeals} onChanged={onChanged} />

          {error !== null && (
            <p className="mt-3 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
              {error}
            </p>
          )}

          <RecordPanel
            link={{ contactId: contact.id }}
            owners={options.owners}
            defaultOwner={contact.owner === "" ? (options.owners[0] ?? "") : contact.owner}
            sequences={sequences}
            alerts={alerts}
            onChanged={onChanged}
          />
        </>
      )}
    </Drawer>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="pt-0.5 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        {label}
      </dt>
      <dd className="font-medium break-words">{children}</dd>
    </>
  );
}
