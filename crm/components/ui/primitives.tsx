import type { ReactNode } from "react";
import { FOLLOW_UP_LABELS, type FollowUpStatus } from "@/lib/domain/follow-up";
import { resolveStatus } from "@/lib/domain/status";
import { isTerminal } from "@/lib/domain/lost";
import type { DealHeat, DealStatus, Lifecycle, StageLike } from "@/lib/domain/types";

/** Petites briques d'affichage partagées par les vues CRM. */

const TONES = {
  /** Action et marque. Ce n'est pas un état : c'est « ceci vous concerne ». */
  brand: "bg-brand-l text-brand-d",
  /** Réussite, et seulement elle : gagné, sain, à jour. */
  win: "bg-win-l text-win-d",
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
  hot: { tone: "win", label: "Active" },
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
  won: "win",
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
  // L'or, comme le « tiède » des affaires : quelque chose est engagé et
  // attend une suite. C'est le seul cycle de vie qui porte une affaire.
  Qualifié: "gold",
  Client: "win",
  "Ancien Client": "mute",
  // Gris : un prospect perdu n'est ni une alerte ni une réussite, il est classé.
  Perdu: "mute",
};

export function LifecycleTag({ lifecycle }: { lifecycle: Lifecycle }) {
  return <Tag tone={LIFECYCLE_TONES[lifecycle]}>{lifecycle}</Tag>;
}

/**
 * Statut de relance. Les couleurs sont celles demandées : gris « jamais
 * contacté », rouge « à relancer », bleu « relance prévue », vert « en attente »,
 * ambre « sans nouvelles ».
 */
const FOLLOW_UP_TONES: Record<FollowUpStatus, Tone> = {
  never: "mute",
  due: "pulse",
  planned: "sky",
  waiting: "win",
  silent: "gold",
};

/**
 * Badge de statut **résolu** : la saisie l'emporte sur le calcul.
 *
 * Source unique de l'affichage du statut — tableau des contacts, tiroir,
 * accueil, portefeuille. Un composant unique est ce qui garantit qu'aucun écran
 * n'affichera le calcul alors qu'un autre affiche la saisie.
 */
export function ContactStatusTag({
  status,
  followUp,
  lifecycle,
  suffix,
}: {
  status: string;
  followUp: FollowUpStatus;
  /**
   * Fourni, un cycle de vie terminal **supprime** la pastille de statut : une
   * fiche « Perdu » n'attend rien, et afficher « en attente » à côté de son
   * cycle de vie était la contradiction corrigée au jalon 28.
   */
  lifecycle?: Lifecycle;
  suffix?: string;
}) {
  if (lifecycle !== undefined && isTerminal(lifecycle)) return null;

  const resolved = resolveStatus({ status, followUp });

  // Le ton suit le statut *calculé* tant que rien n'est saisi ; un libellé saisi
  // et connu reprend son ton, un libellé libre reste neutre.
  const tone = resolved.source === "computed" ? FOLLOW_UP_TONES[followUp] : toneFor(resolved.label);

  return (
    <Tag tone={tone} dot={resolved.attention}>
      {resolved.label}
      {suffix !== undefined && suffix !== "" ? ` · ${suffix}` : ""}
    </Tag>
  );
}

function toneFor(label: string): Tone {
  for (const status of Object.keys(FOLLOW_UP_LABELS) as FollowUpStatus[]) {
    if (FOLLOW_UP_LABELS[status] === label) return FOLLOW_UP_TONES[status];
  }
  if (label === "Ne répond plus") return "pulse";
  if (label === "Intéressé" || label === "RDV pris") return "win";
  if (label === "Perdu") return "mute";
  return "sky";
}

export function FollowUpTag({
  status,
  suffix,
}: {
  status: FollowUpStatus;
  suffix?: string;
}) {
  return (
    <Tag tone={FOLLOW_UP_TONES[status]} dot={status === "due"}>
      {FOLLOW_UP_LABELS[status]}
      {suffix !== undefined && suffix !== "" ? ` · ${suffix}` : ""}
    </Tag>
  );
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
