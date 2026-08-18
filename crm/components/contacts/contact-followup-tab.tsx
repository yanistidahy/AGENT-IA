"use client";

import { EnrollBox } from "@/components/sequences/enroll-box";

import { Eyebrow, StatusTag } from "@/components/ui/primitives";
import type { ContactDealSummary } from "@/lib/api/contacts";
import { money } from "@/lib/format";
import { LinkDeal, type LinkableDeal } from "./link-deal";

/**
 * L'onglet « Suivi » : ce qui est engagé et ce qui reste à faire.
 *
 * Séparé du tiroir pour le garder sous la limite de 250 lignes, et parce que
 * c'est un tout : les deux chiffres du haut résument les affaires listées en
 * dessous, et le lien de rattachement les complète.
 */
export function FollowUpTab({
  deals,
  contactId,
  linkableDeals,
  onChanged,
}: {
  deals: readonly ContactDealSummary[];
  contactId: string;
  linkableDeals: readonly LinkableDeal[];
  onChanged: () => void;
}) {
  const openValue = deals
    .filter((deal) => deal.status === "open")
    .reduce((total, deal) => total + deal.amount, 0);
  const wonValue = deals
    .filter((deal) => deal.status === "won")
    .reduce((total, deal) => total + deal.amount, 0);

  return (
    <>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Figure label="Pipeline ouvert" value={money(openValue)} />
        <Figure label="CA signé" value={money(wonValue)} />
      </div>

      <h3 className="mt-5 mb-2.5 font-display text-sm font-semibold">
        Affaires liées ({deals.length})
      </h3>
      {deals.length === 0 ? (
        <p className="rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
          Aucune affaire rattachée à ce contact. Qualifier la fiche en ouvrira une.
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {deals.map((deal) => (
            <li
              key={deal.id}
              className="flex flex-wrap items-center gap-2 rounded-card border border-line px-3 py-2 text-[13px]"
            >
              {/* Lien dans les deux sens : l'affaire renvoie à sa fiche, la
                  fiche ouvre l'affaire. Une affaire créée à la qualification
                  serait sinon un aller sans retour. */}
              <a
                href={`/affaires?status=all&fiche=${encodeURIComponent(deal.id)}`}
                className="font-semibold text-brand-d hover:underline"
              >
                {deal.name}
              </a>
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

      <LinkDeal contactId={contactId} deals={linkableDeals} onChanged={onChanged} />
      <EnrollBox contactId={contactId} onChanged={onChanged} />
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-surface-2 px-4 py-3">
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-1.5 font-display text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
