import "server-only";
import { z } from "zod";
import { prisma } from "../db";
import { autoUnlock, MAX_STEPS, type AutoUnlock } from "../domain/sequence-rules";

/**
 * Les séquences d'emails : définition, inscriptions, état du verrou.
 *
 * **Distinctes des séquences de tâches du jalon 4.** Celles-ci envoient des
 * messages, celles-là créent des tâches à faire à la main. Les fondre aurait
 * produit un objet dont la moitié des champs n'aurait eu de sens qu'une fois
 * sur deux — et un écran obligé de demander « celle-ci envoie-t-elle
 * vraiment ? » à chaque ligne.
 */

export interface SequenceStepView {
  readonly id: string;
  readonly position: number;
  readonly delayDays: number;
  readonly brief: string;
}

export interface SequenceView {
  readonly id: string;
  readonly name: string;
  readonly active: boolean;
  readonly autoMode: boolean;
  readonly steps: readonly SequenceStepView[];
  readonly enrolled: number;
  readonly running: number;
  /** L'état du verrou, calculé — jamais stocké, donc jamais périmé. */
  readonly unlock: AutoUnlock;
}

/**
 * Ce qui déverrouille le mode automatique, compté depuis les faits.
 *
 * `validated` ne compte que les départs **décidés à la main** (`auto: false`) :
 * compter les envois automatiques ferait grandir le compteur tout seul une fois
 * le mode activé, ce qui reviendrait à ce qu'il se justifie lui-même.
 *
 * `replies` compte les inscriptions arrêtées parce que le contact a répondu.
 * C'est la seule mesure disponible tant que la détection est manuelle, et elle
 * a le mérite d'être exactement ce qu'on veut savoir : cette séquence a-t-elle
 * déjà fait parler quelqu'un ?
 */
async function unlockFor(sequenceId: string): Promise<AutoUnlock> {
  const [validated, replies] = await Promise.all([
    prisma.sequenceDeparture.count({
      where: { status: "sent", auto: false, enrollment: { sequenceId } },
    }),
    prisma.sequenceEnrollment.count({
      where: { sequenceId, status: "stopped", stopReason: { contains: "répondu" } },
    }),
  ]);
  return autoUnlock(validated, replies);
}

export async function listSequences(): Promise<SequenceView[]> {
  const rows = await prisma.emailSequence.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      steps: { orderBy: { position: "asc" } },
      _count: { select: { enrollments: true } },
    },
  });

  const views: SequenceView[] = [];
  for (const row of rows) {
    const running = await prisma.sequenceEnrollment.count({
      where: { sequenceId: row.id, status: "active" },
    });
    views.push({
      id: row.id,
      name: row.name,
      active: row.active,
      autoMode: row.autoMode,
      steps: row.steps.map((step) => ({
        id: step.id,
        position: step.position,
        delayDays: step.delayDays,
        brief: step.brief,
      })),
      enrolled: row._count.enrollments,
      running,
      unlock: await unlockFor(row.id),
    });
  }
  return views;
}

export const sequenceSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Le nom ne peut pas être vide").max(80),
  active: z.boolean(),
  autoMode: z.boolean(),
  steps: z
    .array(
      z.object({
        delayDays: z.number().int().min(0, "Un délai ne peut être négatif").max(90),
        brief: z.string().trim().max(400),
      }),
    )
    .min(1, "Une séquence a au moins une étape")
    // **Trois au maximum**, refusé ici et pas seulement à l'écran : la limite
    // est une décision produit, et une route appelée directement doit s'y
    // heurter comme le formulaire.
    .max(MAX_STEPS, `Trois étapes au maximum`),
});

export type SequenceInput = z.infer<typeof sequenceSchema>;

/**
 * Enregistre une séquence.
 *
 * **Le mode automatique est refusé si les conditions ne sont pas réunies**, et
 * le refus est explicite. L'écran verrouille déjà l'interrupteur ; le serveur
 * le revérifie, parce que l'écran n'est pas la seule porte — c'est la même
 * règle que l'acceptation groupée des domaines au jalon 26.
 */
export async function saveSequence(
  input: SequenceInput,
): Promise<{ ok: true; sequence: SequenceView } | { ok: false; message: string }> {
  const id = input.id;

  if (input.autoMode && id !== undefined) {
    const unlock = await unlockFor(id);
    if (!unlock.unlocked) {
      return { ok: false, message: `Mode automatique indisponible. ${unlock.reason}` };
    }
  }
  if (input.autoMode && id === undefined) {
    return {
      ok: false,
      message:
        "Une séquence qui vient d'être créée ne peut pas démarrer en automatique : elle n'a encore rien prouvé.",
    };
  }

  const data = { name: input.name, active: input.active, autoMode: input.autoMode };

  const saved = await prisma.$transaction(async (tx) => {
    const sequence =
      id === undefined
        ? await tx.emailSequence.create({ data })
        : await tx.emailSequence.update({ where: { id }, data });

    // Les étapes sont remplacées d'un bloc : l'écran manipule la liste entière,
    // et décrire des suppressions étape par étape n'apporterait rien.
    await tx.emailSequenceStep.deleteMany({ where: { sequenceId: sequence.id } });
    for (const [index, step] of input.steps.entries()) {
      await tx.emailSequenceStep.create({
        data: {
          sequenceId: sequence.id,
          position: index + 1,
          delayDays: step.delayDays,
          brief: step.brief,
        },
      });
    }
    return sequence.id;
  });

  const all = await listSequences();
  const sequence = all.find((entry) => entry.id === saved);
  if (sequence === undefined) return { ok: false, message: "Séquence introuvable après écriture." };
  return { ok: true, sequence };
}

export const enrollSchema = z.object({
  sequenceId: z.string().min(1),
  contactIds: z.array(z.string().min(1)).min(1, "Aucun contact sélectionné").max(200),
});

export interface EnrollOutcome {
  readonly enrolled: number;
  readonly already: number;
  readonly refused: ReadonlyArray<{ readonly contactId: string; readonly reason: string }>;
}

/**
 * Inscrit des contacts.
 *
 * **On n'écarte ici que ce qui n'a aucun sens à inscrire** — une fiche close,
 * une opposition, une adresse absente. Le reste est vérifié **à l'envoi**, et
 * c'est la règle centrale : entre l'inscription et le troisième message, il
 * peut se passer trois semaines pendant lesquelles la personne répond ou se
 * désabonne. Filtrer une bonne fois à l'inscription reviendrait à décider avec
 * l'information d'hier.
 */
export async function enroll(input: z.infer<typeof enrollSchema>): Promise<EnrollOutcome> {
  const contacts = await prisma.contact.findMany({
    where: { id: { in: input.contactIds } },
    select: { id: true, lifecycle: true, lostReason: true, email: true },
  });

  let enrolled = 0;
  let already = 0;
  const refused: Array<{ contactId: string; reason: string }> = [];

  for (const contact of contacts) {
    if (contact.email.trim() === "") {
      refused.push({ contactId: contact.id, reason: "Aucune adresse électronique" });
      continue;
    }

    const existing = await prisma.sequenceEnrollment.findUnique({
      where: { sequenceId_contactId: { sequenceId: input.sequenceId, contactId: contact.id } },
    });
    if (existing !== null) {
      already += 1;
      continue;
    }

    await prisma.sequenceEnrollment.create({
      data: { sequenceId: input.sequenceId, contactId: contact.id },
    });
    enrolled += 1;
  }

  return { enrolled, already, refused };
}

/** Arrête une inscription en écrivant **pourquoi**. */
export async function stopEnrollment(id: string, reason: string): Promise<void> {
  await prisma.sequenceEnrollment.update({
    where: { id },
    data: { status: "stopped", stopReason: reason },
  });
}
