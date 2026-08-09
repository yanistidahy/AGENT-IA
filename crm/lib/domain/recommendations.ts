import { addDays, startOfDay } from "./dates";

/**
 * Recommandations produites par les vacations d'agents.
 *
 * Le module est pur : il décide de la forme, de la sévérité, de la déduplication
 * et de la remise en sommeil. Rien n'y appelle Prisma ni Anthropic — c'est ce
 * qui permet de tester le cycle de vie complet d'une recommandation sans base et
 * sans clé d'API.
 */

export const SEVERITIES = ["info", "attention", "urgent"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const SEVERITY_LABELS: Record<Severity, string> = {
  info: "Info",
  attention: "À regarder",
  urgent: "Urgent",
};

export function isSeverity(value: string): value is Severity {
  return SEVERITIES.some((candidate) => candidate === value);
}

export const REC_STATUSES = ["new", "accepted", "dismissed", "snoozed", "expired"] as const;
export type RecStatus = (typeof REC_STATUSES)[number];

/** Motifs de rejet. Un clic, pas un champ libre : c'est ce qui les rend comparables. */
export const DISMISS_REASONS = ["Pas pertinent", "Déjà traité", "Plus tard"] as const;
export type DismissReason = (typeof DISMISS_REASONS)[number];

export function isDismissReason(value: string): value is DismissReason {
  return DISMISS_REASONS.some((candidate) => candidate === value);
}

/**
 * Durée pendant laquelle un constat écarté ne revient pas, selon le motif.
 *
 * « Pas pertinent » se tait longtemps : l'agent s'est trompé sur le fond, le
 * répéter dans trois jours ne le rendra pas plus juste. « Plus tard » est au
 * contraire une demande de rappel — c'est le seul motif à fenêtre courte.
 */
export const MUTE_DAYS: Record<DismissReason, number> = {
  "Pas pertinent": 60,
  "Déjà traité": 30,
  "Plus tard": 7,
};

export const EVIDENCE_TYPES = ["contact", "company", "deal", "task"] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export interface Evidence {
  readonly type: EvidenceType;
  readonly id: string;
  /** Ce que l'utilisateur lira dans le lien. */
  readonly label: string;
}

export interface ProposedAction {
  readonly tool: string;
  readonly input: Record<string, unknown>;
  /** Une phrase, pour que le bouton dise ce qu'il va faire. */
  readonly summary: string;
}

export interface RecommendationDraft {
  readonly agentId: string;
  readonly severity: Severity;
  readonly title: string;
  readonly rationale: string;
  readonly evidence: readonly Evidence[];
  readonly actions: readonly ProposedAction[];
  readonly dedupeKey: string;
}

/**
 * Une recommandation sans preuve est un bug, pas une suggestion.
 *
 * La règle est appliquée **à l'écriture** et non à l'affichage : une
 * recommandation invérifiable ne doit pas exister en base, sinon quelqu'un
 * finira par la lire en croyant qu'elle a été vérifiée.
 */
export function isPublishable(draft: RecommendationDraft): boolean {
  return (
    draft.evidence.length > 0 &&
    draft.title.trim() !== "" &&
    draft.dedupeKey.trim() !== ""
  );
}

/**
 * Clé d'identité d'un constat.
 *
 * Construite à partir de l'agent, du type de constat et des enregistrements
 * cités **triés** : le même constat sur les mêmes fiches produit la même clé
 * quel que soit l'ordre dans lequel le modèle les a listées. Sans le tri, deux
 * runs successifs créeraient deux recommandations pour une seule trouvaille.
 */
export function dedupeKey(agentId: string, kind: string, ids: readonly string[]): string {
  return [agentId, kind, [...ids].sort().join("+")].join(":");
}

export interface MutedLike {
  readonly dedupeKey: string;
  readonly status: RecStatus;
  readonly mutedUntil: Date | null;
  readonly snoozedUntil: Date | null;
}

/**
 * Un constat doit-il être tu ?
 *
 * Trois raisons, et une seule est définitive :
 *
 * - **accepté** — l'action a été prise, le reproposer serait absurde ;
 * - **écarté** dans sa fenêtre de silence ;
 * - **remis à plus tard** jusqu'à sa date.
 *
 * Passé ces fenêtres, le constat peut revenir : si le problème persiste après
 * deux mois de silence, c'est qu'il méritait bien d'être signalé.
 */
export function isMuted(existing: MutedLike, now: Date): boolean {
  if (existing.status === "accepted") return true;

  if (existing.status === "snoozed") {
    return existing.snoozedUntil !== null && existing.snoozedUntil > now;
  }

  if (existing.status === "dismissed") {
    return existing.mutedUntil !== null && existing.mutedUntil > now;
  }

  // `new` : le constat est déjà à l'écran, en produire un second n'ajoute rien.
  return existing.status === "new";
}

/** Fin de la fenêtre de silence, à partir du motif de rejet. */
export function muteUntil(reason: DismissReason, now: Date): Date {
  return addDays(startOfDay(now), MUTE_DAYS[reason]);
}

/** Ordre d'affichage : l'urgence d'abord, puis la plus récente. */
const RANK: Record<Severity, number> = { urgent: 0, attention: 1, info: 2 };

export function compareRecommendations(
  a: { severity: Severity; createdAt: Date },
  b: { severity: Severity; createdAt: Date },
): number {
  const bySeverity = RANK[a.severity] - RANK[b.severity];
  if (bySeverity !== 0) return bySeverity;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

/**
 * Une recommandation en sommeil dont la date est passée redevient visible.
 *
 * Calculé à la lecture plutôt qu'écrit par une tâche planifiée : il n'y a pas de
 * planificateur dans ce projet, et un statut qui ne change qu'au prochain run
 * mentirait entre-temps.
 */
export function effectiveStatus(
  row: { status: RecStatus; snoozedUntil: Date | null },
  now: Date,
): RecStatus {
  if (row.status !== "snoozed") return row.status;
  if (row.snoozedUntil === null) return "new";
  return row.snoozedUntil > now ? "snoozed" : "new";
}
