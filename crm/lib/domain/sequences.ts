import { addDays } from "./dates";
import type { SequenceLike, TaskPriority } from "./types";

/**
 * Tâche proposée par une séquence, avant écriture en base.
 *
 * Ce type est aussi la charge utile présentée à l'utilisateur dans la carte de
 * confirmation quand un agent déclenche `run_sequence` (phase 5) : une séquence
 * ne crée jamais de tâche sans validation humaine.
 */
export interface TaskDraft {
  readonly title: string;
  readonly due: Date;
  readonly priority: TaskPriority;
  readonly owner: string;
  readonly contactId: string | null;
  readonly companyId: string | null;
  readonly dealId: string | null;
}

export interface SequenceTarget {
  readonly owner: string;
  readonly contactId?: string | null;
  readonly companyId?: string | null;
  readonly dealId?: string | null;
  readonly priority?: TaskPriority;
}

/**
 * Développe une séquence en tâches datées à partir de `start`.
 * Une séquence en pause ne produit rien. Les étapes sortent triées par
 * échéance croissante, quel que soit leur ordre de saisie.
 */
export function generateSequenceTasks(
  sequence: SequenceLike,
  start: Date,
  target: SequenceTarget,
): TaskDraft[] {
  if (!sequence.active) return [];

  return [...sequence.steps]
    .sort((a, b) => a.day - b.day)
    .map((step) => ({
      title: step.label,
      due: addDays(start, step.day),
      priority: target.priority ?? "normale",
      owner: target.owner,
      contactId: target.contactId ?? null,
      companyId: target.companyId ?? null,
      dealId: target.dealId ?? null,
    }));
}
