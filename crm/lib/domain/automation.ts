import { addDays, startOfDay } from "./dates";
import { optedOut } from "./lost";
import type { ActivityType, TaskPriority } from "./types";

/**
 * Règles d'automatisation.
 *
 * Pures : ni Prisma, ni React. Elles décident *quoi* écrire ; les services de
 * `lib/api/` exécutent. Un seul endroit décide, personne ne réinvente la règle
 * dans une route ou un composant — le test `no-duplicate-thresholds` étend cette
 * garantie aux clés d'automatisation.
 *
 * Deux principes gouvernent tout ce fichier :
 *
 * 1. **Idempotence par clé.** Chaque tâche automatique porte une `autoKey`
 *    déterministe, unique en base. Rejouer un déclencheur ne peut pas créer de
 *    doublon : la contrainte d'unicité le refuse, on met à jour au lieu d'insérer.
 * 2. **Rien de muet.** Ce module ne produit que des *intentions*. Ce qui est
 *    écrit sans confirmation est le strict miroir d'une saisie de l'utilisateur
 *    (il pose une date de relance, la tâche suit) ; tout le reste est proposé.
 */

/** Familles de tâches automatiques. Le préfixe rend la clé lisible en base. */
export const AUTO_KINDS = ["reminder", "stage", "stale"] as const;
export type AutoKind = (typeof AUTO_KINDS)[number];

/**
 * Clé d'idempotence.
 *
 * `reminder:<contactId>` — un seul rappel ouvert par contact, quelle que soit la
 * date : déplacer l'échéance déplace la tâche, elle ne s'ajoute pas.
 *
 * `stage:<dealId>:<stageId>` — inclut l'étape, pour qu'un aller-retour entre
 * deux étapes reproposent l'action de la seconde, mais qu'un même passage
 * répété n'en crée qu'une.
 *
 * `stale:<dealId>` — une seule relance de réveil par affaire ; rouvrir le sujet
 * demande de terminer ou supprimer la précédente.
 */
export function autoKey(kind: AutoKind, ...parts: readonly string[]): string {
  return [kind, ...parts].join(":");
}

export function isAutoKind(value: string, kind: AutoKind): boolean {
  return value.startsWith(`${kind}:`);
}

export interface TaskIntent {
  readonly autoKey: string;
  readonly title: string;
  readonly due: Date;
  readonly priority: TaskPriority;
  readonly owner: string;
  readonly contactId: string | null;
  readonly companyId: string | null;
  readonly dealId: string | null;
}

/**
 * Tâche miroir d'une relance de contact.
 *
 * C'est la seule automatisation qui écrit sans demander : l'utilisateur vient
 * de saisir une date de relance, la tâche n'ajoute aucune décision — elle rend
 * visible dans /taches ce qu'il a déjà décidé sur la fiche. Sans elle, la
 * relance n'existe que dans une colonne qu'il faut penser à regarder.
 */
export function reminderTask(input: {
  readonly contactId: string;
  readonly contactName: string;
  readonly owner: string;
  readonly due: Date;
}): TaskIntent {
  return {
    autoKey: autoKey("reminder", input.contactId),
    title: `Relancer ${input.contactName}`,
    due: input.due,
    priority: "normale",
    owner: input.owner,
    contactId: input.contactId,
    companyId: null,
    dealId: null,
  };
}

/**
 * Action de suivi proposée à l'entrée dans une étape.
 *
 * `null` quand l'étape n'en déclare pas — l'étape terminale « Gagné », par
 * exemple, n'a pas de suite dans le pipeline.
 */
export function stageTask(input: {
  readonly dealId: string;
  readonly dealName: string;
  readonly stageId: string;
  readonly stageLabel: string;
  readonly stageDays: number;
  readonly owner: string;
  readonly from: Date;
}): TaskIntent | null {
  if (input.stageLabel.trim() === "") return null;

  return {
    autoKey: autoKey("stage", input.dealId, input.stageId),
    title: `${input.stageLabel} — ${input.dealName}`,
    due: startOfDay(addDays(input.from, input.stageDays)),
    priority: "normale",
    owner: input.owner,
    contactId: null,
    companyId: null,
    dealId: input.dealId,
  };
}

/** Relance de réveil d'une affaire en sommeil. Haute priorité : elle stagne déjà. */
export function staleDealTask(input: {
  readonly dealId: string;
  readonly dealName: string;
  readonly owner: string;
  readonly from: Date;
}): TaskIntent {
  return {
    autoKey: autoKey("stale", input.dealId),
    title: `Réveiller l'affaire — ${input.dealName}`,
    due: startOfDay(input.from),
    priority: "haute",
    owner: input.owner,
    contactId: null,
    companyId: null,
    dealId: input.dealId,
  };
}

/**
 * Délais de relance proposés après une interaction, par type.
 *
 * Ce sont des **propositions** pré-remplies dans le formulaire de saisie, pas
 * des écritures. Les valeurs vivent dans les réglages ; celles-ci ne sont que
 * le repli quand la ligne de réglages n'existe pas encore.
 */
export interface ReminderDelays {
  readonly call: number;
  readonly email: number;
  readonly demo: number;
  readonly meeting: number;
  readonly linkedin: number;
  readonly note: number;
}

export const DEFAULT_REMINDER_DELAYS: ReminderDelays = {
  call: 7,
  email: 4,
  demo: 2,
  meeting: 3,
  // Un message LinkedIn se relance comme un email : même canal écrit, même
  // absence d'engagement immédiat.
  linkedin: 4,
  note: 7,
};

export function reminderDelayFor(type: ActivityType, delays: ReminderDelays): number {
  return delays[type];
}

/**
 * Date de relance proposée après une interaction.
 *
 * `null` quand aucune proposition ne doit être faite : la personne s'oppose au
 * démarchage, ou le contact porte déjà une relance postérieure — la remplacer par une date plus proche sans le dire
 * reviendrait à décider à la place de l'utilisateur.
 */
export function proposedReminder(input: {
  readonly type: ActivityType;
  readonly interactionDate: Date;
  readonly existingReminder: Date | null;
  readonly delays: ReminderDelays;
  /** Motif de perte de la fiche, s'il y en a un. Voir lib/domain/lost.ts. */
  readonly lostReason?: string;
}): Date | null {
  // Opposition au démarchage : aucune relance n'est proposée, quel que soit le
  // cycle de vie. La règle est ici, dans le domaine, et non dans le formulaire —
  // le formulaire n'est qu'un des appelants.
  if (optedOut({ lostReason: input.lostReason ?? "" })) return null;

  const proposal = startOfDay(
    addDays(input.interactionDate, reminderDelayFor(input.type, input.delays)),
  );

  if (input.existingReminder !== null && startOfDay(input.existingReminder) >= proposal) {
    return null;
  }
  return proposal;
}
