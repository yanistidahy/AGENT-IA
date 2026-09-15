"use client";

import type { CampaignView } from "@/lib/api/campaigns";
import {
  STATUS_LABELS,
  campaignStatus,
  draftReason,
  type CampaignStatus,
} from "@/lib/domain/campaign-status";
import {
  chosenSignatory,
  signatoryOptionLabel,
  type MailboxOption,
} from "@/lib/domain/signatory-choice";
import { SignatoryPreview } from "./signatory-preview";

/**
 * L'en-tête d'une campagne : ce qu'elle est, et ce qu'on peut lui faire.
 *
 * Le nom se corrige sur place, la boîte se change dans le même menu qu'à la
 * création — même intitulé, même étiquette : un écran d'édition qui décrirait
 * autrement ce que l'écran de création vient de décider ferait douter qu'il
 * s'agisse du même réglage.
 */

const CONTROL =
  "rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";

const TONES: Readonly<Record<CampaignStatus, string>> = {
  running: "border-win bg-win-l text-win-d",
  draft: "border-line bg-surface-2 text-muted",
  archived: "border-line bg-surface-2 text-closed",
};

export function CampaignHeader({
  campaign,
  name,
  onName,
  onRename,
  onMailbox,
  mailboxes,
  busy,
  actions,
}: {
  readonly campaign: CampaignView;
  readonly name: string;
  readonly onName: (value: string) => void;
  readonly onRename: () => void;
  readonly onMailbox: (id: string) => void;
  readonly mailboxes: readonly MailboxOption[];
  readonly busy: boolean;
  /** Les actions primaires, rendues par le parent qui les exécute. */
  readonly actions: React.ReactNode;
}) {
  const status = campaignStatus({
    archived: campaign.archivedAt !== null,
    hasBrief: campaign.hasBrief,
    enrolled: campaign.funnel.enrolled,
  });
  const reason =
    status === "draft"
      ? draftReason({ hasBrief: campaign.hasBrief, enrolled: campaign.funnel.enrolled })
      : null;

  return (
    <header className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(event) => onName(event.target.value)}
          onBlur={onRename}
          aria-label="Nom de la campagne"
          className={`${CONTROL} min-w-[220px] flex-1 font-display text-[17px] font-semibold`}
        />
        <span
          className={`rounded-control border px-2 py-1 font-mono text-[10px] tracking-[0.08em] uppercase ${TONES[status]}`}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      {reason !== null && <p className="mt-1 text-[12.5px] text-muted">{reason}</p>}

      <label className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
        Envoyée depuis et signée par
        <select
          value={campaign.mailboxId}
          disabled={busy}
          onChange={(event) => onMailbox(event.target.value)}
          className={CONTROL}
        >
          {mailboxes.map((box) => (
            <option key={box.id} value={box.id}>
              {signatoryOptionLabel(box)}
            </option>
          ))}
        </select>
      </label>

      <SignatoryPreview signatory={chosenSignatory(mailboxes, campaign.mailboxId)} />

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px]">{actions}</div>
    </header>
  );
}
