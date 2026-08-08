import Link from "next/link";
import type { UpcomingItem } from "@/lib/api/dashboard";
import { groupByDay } from "@/lib/api/dashboard";
import type { TaskPriority } from "@/lib/domain/types";

/** Relances des sept prochains jours, groupées par jour. */
const DOTS: Record<TaskPriority, string> = {
  haute: "bg-pulse",
  normale: "bg-gold",
  basse: "bg-line",
};

export function Upcoming({ items }: { items: readonly UpcomingItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
        Aucune relance planifiée dans les sept prochains jours.
      </p>
    );
  }

  const groups = groupByDay(items);

  return (
    <div className="grid gap-2.5">
      {groups.map(([day, dayItems]) => {
        const date = new Date(`${day}T12:00:00`);
        return (
          <div key={day} className="rounded-card border border-line bg-surface px-3.5 py-2.5">
            <div className="mb-1.5 font-mono text-[10px] tracking-[0.12em] text-muted uppercase">
              {date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "short" })}
              {" · "}
              {dayItems.length}
            </div>
            <ul className="grid gap-1">
              {dayItems.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2 text-[13px]">
                  <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${DOTS[item.priority]}`} />
                  <span>{item.title}</span>
                  {item.targetHref !== null && item.targetLabel !== null && (
                    <Link
                      href={item.targetHref}
                      className="rounded-full bg-paper px-2 py-[1px] text-[11.5px] text-muted hover:text-ink hover:underline"
                    >
                      {item.targetLabel}
                    </Link>
                  )}
                  <span className="ml-auto text-[11.5px] text-muted">{item.owner}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
