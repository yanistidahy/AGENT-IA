import { Eyebrow, Tag, type Tone } from "@/components/ui/primitives";
import { ACTIVITY_LABELS, type ActivityType } from "@/lib/domain/types";
import type { ActivityView } from "./types";
import { formatDate } from "@/lib/format";

/**
 * Chronologie des interactions d'une fiche, du plus récent au plus ancien.
 *
 * Purement présentationnel : il reçoit des `ActivityView` déjà converties. La
 * saisie vit dans `log-form.tsx`, le chargement dans `record-panel.tsx`.
 */

const TYPE_TONES: Record<ActivityType, Tone> = {
  call: "brand",
  email: "sky",
  meeting: "violet",
  demo: "gold",
  linkedin: "sky",
  note: "mute",
};

export function Timeline({ activities }: { activities: readonly ActivityView[] }) {
  if (activities.length === 0) {
    return (
      <p className="rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
        Aucune interaction consignée. Utilisez « Consigner une interaction » ci-dessus.
      </p>
    );
  }

  return (
    <ol className="relative grid gap-2.5 border-l border-line pl-4">
      {activities.map((activity) => (
        <li key={activity.id} className="relative">
          <span
            aria-hidden
            className="absolute top-2 -left-[21px] size-2 rounded-full bg-brand ring-4 ring-surface"
          />
          <div className="rounded-card border border-line bg-surface px-3.5 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone={TYPE_TONES[activity.type]}>{ACTIVITY_LABELS[activity.type]}</Tag>
              <span className="font-mono text-[11.5px] text-muted">
                {formatDate(activity.date)}
              </span>
              {activity.duration !== null && (
                <span className="font-mono text-[11.5px] text-muted">
                  {activity.duration} min
                </span>
              )}
              <span className="ml-auto text-[11.5px] text-muted">{activity.owner}</span>
            </div>

            {activity.notes !== "" && (
              <p className="mt-1.5 text-[13px] leading-relaxed whitespace-pre-line">
                {activity.notes}
              </p>
            )}

            <div className="mt-1.5 flex flex-wrap gap-2">
              {activity.dealName !== null && <Origin label={activity.dealName} />}
              {activity.contactName !== null && <Origin label={activity.contactName} />}
              {activity.companyName !== null && <Origin label={activity.companyName} />}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Rattachement de l'interaction — utile dans la chronologie d'une société, qui agrège. */
function Origin({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-paper px-2 py-[2px] text-[11px] text-muted">
      <Eyebrow>sur</Eyebrow>
      {label}
    </span>
  );
}
