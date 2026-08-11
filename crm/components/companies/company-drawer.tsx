"use client";

import Link from "next/link";
import { useState } from "react";
import { Drawer } from "@/components/ui/drawer";
import { ExternalLink } from "@/components/ui/external-link";
import { Eyebrow, LifecycleTag, StatusTag } from "@/components/ui/primitives";
import type { CompanyRecord } from "@/lib/api/companies";
import { deleteCompany } from "@/lib/client/crm-api";
import { formatDate, money } from "@/lib/format";
import { RecordPanel } from "@/components/activities/record-panel";
import type { SequenceOption } from "@/components/activities/run-sequence";
import { CompanyForm } from "./company-form";

interface CompanyDrawerProps {
  readonly company: CompanyRecord | null;
  readonly industries: readonly string[];
  readonly owners: readonly string[];
  readonly sequences: readonly SequenceOption[];
  readonly onClose: () => void;
  readonly onChanged: () => void;
}

export function CompanyDrawer({
  company,
  industries,
  owners,
  sequences,
  onClose,
  onChanged,
}: CompanyDrawerProps) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (company === null) return null;

  const openDeals = company.deals.filter((deal) => deal.status === "open");

  const remove = async () => {
    setBusy(true);
    setError(null);
    const result = await deleteCompany(company.id);
    setBusy(false);
    if (result.ok) onChanged();
    else setError(result.message);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={company.name}
      subtitle={[company.industry, company.loc, company.size].filter((v) => v !== "").join(" · ")}
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
              onClick={() => void remove()}
              className="ml-auto rounded-control border border-[#F0C9C2] px-4 py-2 text-[13px] font-semibold text-[#B2311F] transition-colors hover:bg-pulse-l disabled:opacity-50"
            >
              Supprimer
            </button>
          </>
        )
      }
    >
      {editing ? (
        <CompanyForm
          company={company}
          industries={industries}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3">
            <div className="rounded-card border border-line bg-surface-2 px-4 py-3">
              <Eyebrow>Pipeline ouvert</Eyebrow>
              <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums">
                {money(company.openValue)}
              </div>
              <div className="mt-1 text-[12px] text-muted">{openDeals.length} affaire(s)</div>
            </div>
            <div className="rounded-card border border-line bg-surface-2 px-4 py-3">
              <Eyebrow>CA signé</Eyebrow>
              <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums">
                {money(company.wonValue)}
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-[130px_1fr] gap-x-3.5 gap-y-2.5 text-[13.5px]">
            <Row label="Domaine">
              <ExternalLink value={company.domain} />
            </Row>
            <Row label="Secteur">{company.industry || "—"}</Row>
            <Row label="Taille">{company.size || "—"}</Row>
            <Row label="Localisation">{company.loc || "—"}</Row>
            <Row label="Créée le">{formatDate(company.createdAt)}</Row>
          </dl>

          {company.desc !== "" && (
            <div className="mt-4 rounded-card border border-line bg-surface-2 px-3.5 py-3">
              <Eyebrow>Description</Eyebrow>
              <p className="mt-1 text-[13px] leading-relaxed">{company.desc}</p>
            </div>
          )}

          <h3 className="mt-6 mb-2.5 font-display text-sm font-semibold">
            Contacts ({company.contacts.length})
          </h3>
          {company.contacts.length === 0 ? (
            <p className="rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
              Aucun contact rattaché.{" "}
              <Link href="/contacts" className="text-brand-d hover:underline">
                Ajouter un contact
              </Link>
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {company.contacts.map((contact) => (
                <li
                  key={contact.id}
                  className="flex flex-wrap items-center gap-2 rounded-card border border-line px-3 py-2 text-[13px]"
                >
                  <Link
                    href={`/contacts?q=${encodeURIComponent(contact.lastName)}`}
                    className="font-semibold hover:underline"
                  >
                    {contact.firstName} {contact.lastName}
                  </Link>
                  <span className="text-[12.5px] text-muted">{contact.title || "—"}</span>
                  <span className="ml-auto">
                    <LifecycleTag lifecycle={contact.lifecycle} />
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="mt-6 mb-2.5 font-display text-sm font-semibold">
            Affaires ({company.deals.length})
          </h3>
          {company.deals.length === 0 ? (
            <p className="rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
              Aucune affaire pour cette société.
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {company.deals.map((deal) => (
                <li
                  key={deal.id}
                  className="flex flex-wrap items-center gap-2 rounded-card border border-line px-3 py-2 text-[13px]"
                >
                  <Link
                    href={`/affaires?status=all&q=${encodeURIComponent(deal.name)}`}
                    className="font-semibold hover:underline"
                  >
                    {deal.name}
                  </Link>
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

          {error !== null && (
            <p className="mt-3 rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
              {error}
            </p>
          )}

          <RecordPanel
            link={{ companyId: company.id }}
            owners={owners}
            defaultOwner={owners[0] ?? ""}
            sequences={sequences}
            alerts={[]}
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
