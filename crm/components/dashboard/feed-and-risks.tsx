import Link from "next/link";
import { HeatTag, Tag, type Tone } from "@/components/ui/primitives";
import type { FeedItem, RiskDeal } from "@/lib/api/dashboard";
import type { ActivityType } from "@/lib/domain/types";
import { formatDate, money } from "@/lib/format";

const TYPE_LABELS: Record<ActivityType, string> = {
  call: "Appel",
  email: "Email",
  meeting: "Réunion",
  demo: "Démo",
  linkedin: "LinkedIn",
  note: "Note",
};

const TYPE_TONES: Record<ActivityType, Tone> = {
  call: "brand",
  email: "sky",
  meeting: "violet",
  demo: "gold",
  linkedin: "sky",
  note: "mute",
};

/** Ce qui s'est passé ces deux derniers jours. */
export function ActivityFeed({ items }: { items: readonly FeedItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
        Aucune interaction consignée ces deux derniers jours.
      </p>
    );
  }

  return (
    <ul className="grid gap-1.5">
      {items.map((item) => (
        <li
          key={item.id}
          className="rounded-card border border-line bg-surface px-3.5 py-2.5 text-[13px]"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Tag tone={TYPE_TONES[item.type]}>{TYPE_LABELS[item.type]}</Tag>
            {item.label !== null && <span className="font-semibold">{item.label}</span>}
            <span className="ml-auto font-mono text-[11.5px] text-muted">
              {formatDate(item.date)} · {item.owner}
            </span>
          </div>
          {item.notes !== "" && (
            <p className="mt-1 line-clamp-2 text-[12.5px] text-muted">{item.notes}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Affaires en cours qui ne sont plus actives, les plus grosses d'abord. */
export function RiskDeals({ deals }: { deals: readonly RiskDeal[] }) {
  if (deals.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
        Aucune affaire en sommeil : toutes ont été touchées récemment.
      </p>
    );
  }

  return (
    <ul className="grid gap-1.5">
      {deals.map((deal) => (
        <li key={deal.id}>
          <Link
            href={`/affaires?status=all&fiche=${deal.id}`}
            className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface px-3.5 py-2.5 text-[13px] transition-colors hover:border-brand"
          >
            <span className="font-semibold">{deal.name}</span>
            <span
              className="rounded-full px-2 py-[2px] text-[11px] font-semibold"
              style={{ backgroundColor: `${deal.stageColor}1f`, color: deal.stageColor }}
            >
              {deal.stageName}
            </span>
            <HeatTag heat={deal.heat} days={deal.idleDays} />
            <span className="ml-auto font-mono font-semibold tabular-nums">
              {money(deal.amount)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
