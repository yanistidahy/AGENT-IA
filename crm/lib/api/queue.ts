import "server-only";
import { z } from "zod";
import { prisma } from "../db";
import { addDays, dayKey, startOfDay } from "../domain/dates";
import { LOST_LIFECYCLE, OPT_OUT_MESSAGE } from "../domain/lost";
import { parseQueueId, type QueueTarget } from "../domain/queue";
import { runSequence } from "./sequences";

/**
 * Les actions groupées de la file d'accueil.
 *
 * Le principe qui gouverne ce fichier : **rien n'est irréversible dans les cinq
 * secondes qui suivent.** Chaque écriture rend l'écriture inverse, sous forme de
 * données et non de code, et l'annulation les rejoue par le même chemin. C'est
 * ce qui rend un clic manqué sur « Reporter » rattrapable — et un report manqué
 * sur six lignes est exactement le genre d'erreur que produit une barre
 * d'actions groupées.
 *
 * L'inverse est calculé **avant** d'écrire, à partir de l'état lu. Le déduire
 * après coup reviendrait à deviner, et à restaurer une valeur plausible plutôt
 * que la vraie.
 */

/* -------------------------------------------------------------- entrées */

export const queueBatchSchema = z.object({
  ids: z.array(z.string().trim().min(1)).min(1, "Aucune ligne sélectionnée").max(200),
  action: z.enum(["postpone", "assign", "lost", "complete", "sequence"]),
  /** Report : nombre de jours à ajouter à aujourd'hui. */
  days: z.number().int().min(1).max(365).optional(),
  owner: z.string().trim().min(1).optional(),
  reason: z.string().trim().max(120).optional(),
  sequenceId: z.string().trim().min(1).optional(),
  /**
   * Compter ces lignes dans l'avancement du jour.
   *
   * Vrai pour la file d'accueil, dont l'anneau mesure exactement cela. Faux
   * pour les autres surfaces qui empruntent ce chemin d'écriture — le bloc
   * « sans réponse » de `/emails` depuis le jalon 39 : marquer perdu quelqu'un
   * qui n'avait aucune échéance aujourd'hui ferait apparaître dans l'anneau
   * une ligne qui n'a jamais été au programme, et le dénominateur ne
   * redescend jamais.
   */
  mark: z.boolean().optional(),
});

export type QueueBatchInput = z.infer<typeof queueBatchSchema>;

/**
 * L'écriture inverse.
 *
 * Les dates voyagent en ISO parce que ce document fait l'aller-retour par le
 * réseau : un `Date` y deviendrait une chaîne de toute façon, autant que le type
 * le dise.
 */
export const undoStepSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("contact"),
    id: z.string().trim().min(1),
    nextReminder: z.string().nullable().optional(),
    lifecycle: z.string().optional(),
    lostReason: z.string().optional(),
    owner: z.string().optional(),
  }),
  z.object({
    kind: z.literal("task"),
    id: z.string().trim().min(1),
    due: z.string().optional(),
    done: z.boolean().optional(),
    owner: z.string().optional(),
  }),
  z.object({
    kind: z.literal("task-delete"),
    id: z.string().trim().min(1),
  }),
  /**
   * L'inverse d'une qualification : l'affaire qu'elle vient d'ouvrir disparaît.
   *
   * Supprimer une affaire est violent, et c'est pourquoi cette étape n'est
   * jamais fabriquée par le client : elle ne peut venir que d'une réponse du
   * serveur, qui vient de créer cette affaire-là dans la seconde précédente.
   * Les visites d'étape partent en cascade, l'interaction de qualification est
   * retirée avec elle.
   */
  z.object({
    kind: z.literal("deal-delete"),
    id: z.string().trim().min(1),
  }),
  /**
   * L'inverse d'un domaine accepté : la société retrouve la valeur qu'elle
   * portait, miroir de recherche compris.
   *
   * Le miroir voyage avec la valeur plutôt que d'être recalculé à
   * l'annulation : le recalculer supposerait de relire le nom, le secteur et
   * la localisation tels qu'ils sont **maintenant**, et une modification faite
   * entre-temps se retrouverait défaite par une annulation qui n'a rien à voir
   * avec elle.
   */
  z.object({
    kind: z.literal("company-domain"),
    id: z.string().trim().min(1),
    domain: z.string(),
    searchText: z.string(),
  }),
]);

export type UndoStep = z.infer<typeof undoStepSchema>;

export const queueUndoSchema = z.object({
  steps: z.array(undoStepSchema).min(1).max(400),
  /** Lignes à rendre à la file du jour : l'annulation les remet à traiter. */
  ids: z.array(z.string().trim().min(1)).max(200).optional(),
});

export interface QueueBatchResult {
  readonly done: number;
  /** Identifiants refusés, avec la raison — jamais un échec silencieux. */
  readonly failed: ReadonlyArray<{ id: string; reason: string }>;
  readonly undo: readonly UndoStep[];
  readonly message: string;
}

/* ------------------------------------------------------------- exécution */

function iso(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

export async function runQueueBatch(
  input: QueueBatchInput,
  now: Date = new Date(),
): Promise<QueueBatchResult> {
  const undo: UndoStep[] = [];
  const failed: Array<{ id: string; reason: string }> = [];
  const handled: string[] = [];

  for (const id of input.ids) {
    const target = parseQueueId(id);
    if (target === null) {
      failed.push({ id, reason: "Ligne inconnue." });
      continue;
    }

    try {
      const refusal = await applyOne(target, input, now, undo);
      if (refusal === null) handled.push(id);
      else failed.push({ id, reason: refusal });
    } catch (error) {
      console.error("[file] action groupée", error);
      failed.push({ id, reason: "L'écriture a échoué." });
    }
  }

  if (input.mark !== false) await markHandled(handled, input.action, now);

  return {
    done: handled.length,
    failed,
    undo,
    message: summarise(input, handled.length, failed.length),
  };
}

/**
 * Applique une action à une ligne. Renvoie `null` en cas de succès, ou le motif
 * du refus — une chaîne plutôt qu'une exception, parce qu'un refus attendu
 * (« une affaire ne se reporte pas ») n'est pas une panne.
 */
async function applyOne(
  target: QueueTarget,
  input: QueueBatchInput,
  now: Date,
  undo: UndoStep[],
): Promise<string | null> {
  if (input.action === "postpone") {
    const due = addDays(startOfDay(now), input.days ?? 3);

    if (target.kind === "reminder") {
      const contact = await prisma.contact.findUnique({
        where: { id: target.ref },
        select: { nextReminder: true },
      });
      if (contact === null) return "Contact introuvable.";
      undo.push({ kind: "contact", id: target.ref, nextReminder: iso(contact.nextReminder) });
      await prisma.contact.update({ where: { id: target.ref }, data: { nextReminder: due } });
      return null;
    }

    if (target.kind === "task") {
      const task = await prisma.task.findUnique({
        where: { id: target.ref },
        select: { due: true },
      });
      if (task === null) return "Tâche introuvable.";
      undo.push({ kind: "task", id: target.ref, due: task.due.toISOString() });
      await prisma.task.update({ where: { id: target.ref }, data: { due } });
      return null;
    }

    return "Une affaire en sommeil n'a pas d'échéance à reporter.";
  }

  if (input.action === "complete") {
    if (target.kind !== "task") return "Seule une tâche se marque faite.";
    const task = await prisma.task.findUnique({ where: { id: target.ref }, select: { done: true } });
    if (task === null) return "Tâche introuvable.";
    undo.push({ kind: "task", id: target.ref, done: task.done });
    await prisma.task.update({
      where: { id: target.ref },
      data: { done: true, doneAt: now },
    });
    return null;
  }

  if (input.action === "assign") {
    const owner = input.owner;
    if (owner === undefined) return "Aucun destinataire choisi.";

    if (target.kind === "reminder") {
      const contact = await prisma.contact.findUnique({
        where: { id: target.ref },
        select: { owner: true },
      });
      if (contact === null) return "Contact introuvable.";
      undo.push({ kind: "contact", id: target.ref, owner: contact.owner });
      await prisma.contact.update({ where: { id: target.ref }, data: { owner } });
      return null;
    }

    if (target.kind === "task") {
      const task = await prisma.task.findUnique({
        where: { id: target.ref },
        select: { owner: true },
      });
      if (task === null) return "Tâche introuvable.";
      undo.push({ kind: "task", id: target.ref, owner: task.owner });
      await prisma.task.update({ where: { id: target.ref }, data: { owner } });
      return null;
    }

    return "Une affaire ne s'assigne pas depuis la file.";
  }

  if (input.action === "lost") {
    if (target.kind !== "reminder") return "Seul un contact se marque perdu ici.";
    const contact = await prisma.contact.findUnique({
      where: { id: target.ref },
      select: { lifecycle: true, lostReason: true, nextReminder: true },
    });
    if (contact === null) return "Contact introuvable.";

    undo.push({
      kind: "contact",
      id: target.ref,
      lifecycle: contact.lifecycle,
      lostReason: contact.lostReason,
      nextReminder: iso(contact.nextReminder),
    });
    // La relance programmée part avec : garder une échéance sur une fiche
    // perdue la ferait revenir dans la file de demain.
    await prisma.contact.update({
      where: { id: target.ref },
      data: {
        lifecycle: LOST_LIFECYCLE,
        lostReason: input.reason ?? "",
        nextReminder: null,
      },
    });
    return null;
  }

  // Séquence.
  if (target.kind !== "reminder") return "Une séquence se lance sur un contact.";
  const sequenceId = input.sequenceId;
  if (sequenceId === undefined) return "Aucune séquence choisie.";

  const contact = await prisma.contact.findUnique({
    where: { id: target.ref },
    select: { owner: true },
  });
  if (contact === null) return "Contact introuvable.";

  const result = await runSequence(sequenceId, {
    owner: input.owner ?? contact.owner,
    start: startOfDay(now),
    contactId: target.ref,
  });

  if (!result.ok) {
    if (result.reason === "opted_out") return OPT_OUT_MESSAGE;
    return result.reason === "inactive" ? "Séquence inactive." : "Séquence introuvable.";
  }

  // L'inverse d'une séquence lancée est la suppression des tâches qu'elle vient
  // de créer — et d'elles seules, jamais des tâches préexistantes.
  for (const task of result.tasks) undo.push({ kind: "task-delete", id: task.id });
  return null;
}

/* ------------------------------------------------------------- annulation */

export async function undoQueueBatch(
  steps: readonly UndoStep[],
  ids: readonly string[] = [],
  now: Date = new Date(),
): Promise<{ readonly restored: number }> {
  let restored = 0;

  for (const step of steps) {
    try {
      if (step.kind === "task-delete") {
        await prisma.task.delete({ where: { id: step.id } });
        restored += 1;
        continue;
      }

      if (step.kind === "deal-delete") {
        // Les interactions survivent à la suppression d'une affaire
        // (`SetNull`) : celle qui annonce la qualification n'aurait plus de
        // sens sans elle, on la retire explicitement.
        await prisma.activity.deleteMany({ where: { dealId: step.id } });
        await prisma.deal.delete({ where: { id: step.id } });
        restored += 1;
        continue;
      }

      if (step.kind === "company-domain") {
        await prisma.company.update({
          where: { id: step.id },
          data: { domain: step.domain, searchText: step.searchText },
        });
        restored += 1;
        continue;
      }

      if (step.kind === "task") {
        await prisma.task.update({
          where: { id: step.id },
          data: {
            ...(step.due === undefined ? {} : { due: new Date(step.due) }),
            ...(step.owner === undefined ? {} : { owner: step.owner }),
            // Défaire un « fait » efface aussi sa date : la garder laisserait
            // une tâche ouverte prétendant avoir été terminée.
            ...(step.done === undefined ? {} : { done: step.done, doneAt: step.done ? now : null }),
          },
        });
        restored += 1;
        continue;
      }

      await prisma.contact.update({
        where: { id: step.id },
        data: {
          ...(step.nextReminder === undefined
            ? {}
            : { nextReminder: step.nextReminder === null ? null : new Date(step.nextReminder) }),
          ...(step.lifecycle === undefined ? {} : { lifecycle: step.lifecycle }),
          ...(step.lostReason === undefined ? {} : { lostReason: step.lostReason }),
          ...(step.owner === undefined ? {} : { owner: step.owner }),
        },
      });
      restored += 1;
    } catch (error) {
      // Une étape d'annulation qui échoue ne doit pas emporter les autres :
      // restaurer quatre lignes sur six vaut mieux que zéro.
      console.error("[file] annulation", error);
    }
  }

  if (ids.length > 0) {
    await prisma.queueMark.deleteMany({ where: { day: dayKey(now), itemId: { in: [...ids] } } });
  }

  return { restored };
}

/* ---------------------------------------------------------- avancement */

/** Marque des lignes comme traitées aujourd'hui. Idempotent par la contrainte d'unicité. */
export async function markHandled(
  ids: readonly string[],
  action: string,
  now: Date = new Date(),
): Promise<void> {
  if (ids.length === 0) return;
  const day = dayKey(now);
  try {
    await prisma.queueMark.createMany({
      data: ids.map((itemId) => ({ day, itemId, action })),
      skipDuplicates: true,
    });
  } catch (error) {
    // L'avancement est un encouragement, pas une donnée métier : son échec ne
    // doit jamais faire échouer l'action que l'utilisateur vient de demander.
    console.error("[file] marque", error);
  }
}

export interface QueueProgress {
  readonly done: number;
  readonly planned: number;
}

/**
 * L'avancement du jour, et la taille figée de la file.
 *
 * `planned` est écrit une fois par jour, au premier passage, puis relevé si la
 * file grossit. Il n'est jamais abaissé — voir `lib/domain/progress.ts` pour
 * pourquoi un dénominateur qui recule rendrait l'anneau immobile.
 */
export async function readQueueProgress(
  remaining: number,
  now: Date = new Date(),
): Promise<QueueProgress> {
  const day = dayKey(now);

  try {
    const done = await prisma.queueMark.count({ where: { day } });
    const floor = done + remaining;

    const existing = await prisma.queueDay.findUnique({ where: { day } });
    if (existing === null) {
      await prisma.queueDay.create({ data: { day, planned: floor } });
      return { done, planned: floor };
    }

    if (existing.planned < floor) {
      await prisma.queueDay.update({ where: { day }, data: { planned: floor } });
      return { done, planned: floor };
    }

    return { done, planned: existing.planned };
  } catch (error) {
    console.error("[file] avancement", error);
    return { done: 0, planned: remaining };
  }
}

/* ------------------------------------------------------------------ texte */

function summarise(input: QueueBatchInput, done: number, failures: number): string {
  const subject = done === 1 ? "1 ligne" : `${done} lignes`;
  const tail = failures === 0 ? "" : ` — ${failures} refusée(s).`;

  switch (input.action) {
    case "postpone":
      return `${subject} reportée(s) de ${input.days ?? 3} jours.${tail}`;
    case "complete":
      return `${subject} marquée(s) faite(s).${tail}`;
    case "assign":
      return `${subject} assignée(s) à ${input.owner ?? "—"}.${tail}`;
    case "lost":
      return `${subject} marquée(s) perdue(s).${tail}`;
    case "sequence":
      return `Séquence lancée sur ${subject}.${tail}`;
  }
}
