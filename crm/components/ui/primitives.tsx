import type { ReactNode } from "react";
import type { DealHeat, DealStatus, Lifecycle, StageLike } from "@/lib/domain/types";

/** Petites briques d'affichage partagées par les vues CRM. */

const TONES = {
  flux: "bg-flux-l text-flux-d",
  gold: "bg-gold-l text-[#9A6410]",
  pulse: "bg-pulse-l text-[#B2311F]",
  violet: "bg-violet-l text-[#4B37C0]",
  sky: "bg-sky-l text-[#1B5AB0]",
  mute: "bg-paper text-muted",
} as const;

export type Tone = keyof typeof TONES;

export function Tag({
  tone = "mute",
  dot = false,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[11.5px] font-semibold whitespace-nowrap ${TONES[tone]}`}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Pastille d'étape, teintée de la couleur configurée pour l'étape. */
export function StageTag({ stage }: { stage: StageLike }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[3px] text-[11.5px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: `${stage.color}1f`, color: stage.color }}
    >
      {stage.name}
    </span>
  );
}

const HEAT_LABELS: Record<DealHeat, { tone: Tone; label: string }> = {
  hot: { tone: "flux", label: "Active" },
  warm: { tone: "gold", label: "Tiède" },
  cold: { tone: "pulse", label: "Froide" },
};

export function HeatTag({ heat, days }: { heat: DealHeat; days: number }) {
  const { tone, label } = HEAT_LABELS[heat];
  return (
    <Tag tone={tone} dot>
      {label} · {days} j
    </Tag>
  );
}

const STATUS_TONES: Record<DealStatus, Tone> = {
  open: "sky",
  won: "flux",
  lost: "pulse",
};

const STATUS_LABELS: Record<DealStatus, string> = {
  open: "En cours",
  won: "Gagnée",
  lost: "Perdue",
};

export function StatusTag({ status }: { status: DealStatus }) {
  return <Tag tone={STATUS_TONES[status]}>{STATUS_LABELS[status]}</Tag>;
}

const LIFECYCLE_TONES: Record<Lifecycle, Tone> = {
  Lead: "sky",
  Prospect: "violet",
  Client: "flux",
  "Ancien Client": "mute",
};

export function LifecycleTag({ lifecycle }: { lifecycle: Lifecycle }) {
  return <Tag tone={LIFECYCLE_TONES[lifecycle]}>{lifecycle}</Tag>;
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="px-5 py-11 text-center text-muted">
      <b className="mb-1.5 block font-display text-[15px] text-ink">{title}</b>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[9.5px] tracking-[0.14em] text-muted uppercase">
      {children}
    </span>
  );
}
