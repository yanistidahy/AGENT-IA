import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { autoKey, reminderTask, type TaskIntent } from "../domain/automation";

/**
 * Exécution des règles d'automatisation.
 *
 * Les règles décident (`lib/domain/automation.ts`), ce module écrit. Toutes les
 * fonctions acceptent un client de transaction : une automatisation qui
 * accompagne une écriture métier doit réussir ou échouer avec elle, jamais à
 * moitié.
 */
export type Tx = Prisma.TransactionClient;

export interface AutoTaskOutcome {
  readonly id: string;
  readonly title: string;
  readonly due: Date;
  /** `created` quand la tâche naît, `moved` quand elle existait déjà. */
  readonly effect: "created" | "moved";
}

/**
 * Applique une intention, sans jamais dupliquer.
 *
 * `upsert` sur `autoKey` : rejouer le même déclencheur met à jour la tâche
 * existante au lieu d'en créer une seconde. C'est la contrainte d'unicité de la
 * base qui garantit la propriété, pas une vérification applicative qu'une course
 * pourrait contourner.
 *
 * Une tâche **déjà terminée** n'est jamais rouverte : effacer un `doneAt` ferait
 * disparaître la trace d'un travail accompli. Elle libère en revanche sa clé, et
 * une nouvelle tâche naît à côté. C'est la différence entre les deux situations
 * que la clé seule ne distingue pas : rejouer un déclencheur sur une relance
 * déjà traitée ne doit rien produire *de nouveau* pour la même échéance, mais
 * reposer volontairement une relance après l'avoir traitée doit bien redonner
 * une tâche — sans quoi la fiche afficherait « à relancer » sans que rien
 * n'apparaisse dans /taches.
 */
export async function applyTaskIntent(
  tx: Tx,
  intent: TaskIntent,
): Promise<AutoTaskOutcome | null> {
  const existing = await tx.task.findUnique({
    where: { autoKey: intent.autoKey },
    select: { id: true, done: true, due: true },
  });

  if (existing !== null && existing.done) {
    // Même échéance : le déclencheur ne fait que repasser, il n'y a rien de neuf.
    if (existing.due.getTime() === intent.due.getTime()) return null;

    await tx.task.update({ where: { id: existing.id }, data: { autoKey: null } });
    const revived = await tx.task.create({
      data: {
        autoKey: intent.autoKey,
        auto: true,
        title: intent.title,
        due: intent.due,
        priority: intent.priority,
        owner: intent.owner,
        contactId: intent.contactId,
        companyId: intent.companyId,
        dealId: intent.dealId,
      },
      select: { id: true, title: true, due: true },
    });
    return { ...revived, effect: "created" };
  }

  const task = await tx.task.upsert({
    where: { autoKey: intent.autoKey },
    create: {
      autoKey: intent.autoKey,
      auto: true,
      title: intent.title,
      due: intent.due,
      priority: intent.priority,
      owner: intent.owner,
      contactId: intent.contactId,
      companyId: intent.companyId,
      dealId: intent.dealId,
    },
    update: {
      title: intent.title,
      due: intent.due,
      owner: intent.owner,
    },
    select: { id: true, title: true, due: true },
  });

  return { ...task, effect: existing === null ? "created" : "moved" };
}

/**
 * Retire la tâche automatique d'une règle, si elle est encore ouverte.
 *
 * Une tâche terminée est de l'historique : effacer la relance ne doit pas
 * effacer la trace du travail accompli.
 */
export async function removeAutoTask(tx: Tx, key: string): Promise<boolean> {
  const deleted = await tx.task.deleteMany({ where: { autoKey: key, done: false } });
  return deleted.count > 0;
}

/** Synchronise la tâche miroir d'une relance de contact. */
export async function syncReminderTask(
  tx: Tx,
  input: {
    readonly contactId: string;
    readonly contactName: string;
    readonly owner: string;
    readonly reminder: Date | null;
  },
): Promise<AutoTaskOutcome | null> {
  const key = autoKey("reminder", input.contactId);

  if (input.reminder === null) {
    await removeAutoTask(tx, key);
    return null;
  }

  return applyTaskIntent(
    tx,
    reminderTask({
      contactId: input.contactId,
      contactName: input.contactName,
      owner: input.owner,
      due: input.reminder,
    }),
  );
}

/**
 * Terminer une tâche de relance efface la relance du contact.
 *
 * Sans cela, le contact reste marqué « À relancer » indéfiniment alors que le
 * travail est fait — le CRM mentirait sur ce qui reste à faire, ce qui est
 * exactement ce qu'on lui demande de ne jamais faire.
 */
export async function clearReminderAfterTask(
  tx: Tx,
  task: { readonly autoKey: string | null; readonly contactId: string | null },
): Promise<string | null> {
  if (task.autoKey === null || task.contactId === null) return null;
  if (task.autoKey !== autoKey("reminder", task.contactId)) return null;

  await tx.contact.update({
    where: { id: task.contactId },
    data: { nextReminder: null },
  });
  return task.contactId;
}

/** Le propriétaire d'une fiche, ou le premier propriétaire configuré à défaut. */
export async function ownerOrDefault(tx: Tx, owner: string): Promise<string> {
  if (owner.trim() !== "") return owner;

  const first = await tx.settingsList.findFirst({
    where: { kind: "owners" },
    orderBy: { position: "asc" },
    select: { value: true },
  });
  return first?.value ?? "";
}

/** Affaires en sommeil sans tâche de réveil ouverte — alimente l'action groupée. */
export async function staleDealsWithoutTask(
  ids: readonly string[],
): Promise<string[]> {
  if (ids.length === 0) return [];

  const existing = await prisma.task.findMany({
    where: { done: false, autoKey: { in: ids.map((id) => autoKey("stale", id)) } },
    select: { autoKey: true },
  });

  const covered = new Set(existing.map((task) => task.autoKey));
  return ids.filter((id) => !covered.has(autoKey("stale", id)));
}
