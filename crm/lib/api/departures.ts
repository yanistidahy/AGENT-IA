import "server-only";
import { prisma } from "../db";
import { draftEmail } from "../agents/email-draft";
import { sendEmailToContact } from "./email-send";
import { checkRate } from "./send-rate";
import { REAL_ACTIVITY } from "./real-activity";
import { ANSWERED_OUTCOMES } from "../domain/status";
import { toLifecycle } from "../domain/guards";
import { daysSince } from "../domain/dates";
import {
  autoUnlock,
  BLOCK_LABELS,
  canSendAutomatically,
  isWeekend,
  nextStep,
  stopsEnrollment,
} from "../domain/sequence-rules";
import { contactTitle } from "../domain/contact-identity";

/**
 * « Départs du jour » : la file du matin, et ce qu'on en fait.
 *
 * **Composée le matin même, jamais la veille.** C'est la contrainte qui donne
 * sa valeur à la détection manuelle des réponses : un brouillon écrit vendredi
 * soir et envoyé lundi matin décrit l'état de vendredi, et la réponse arrivée
 * samedi ne l'aurait pas arrêté. La file du lundi se construit lundi, à partir
 * de l'état de lundi.
 *
 * **Ni composition ni départ le week-end.** Un message de prospection reçu le
 * dimanche se lit comme de l'automatisation, et personne ne relève sa boîte
 * professionnelle pour y répondre. Surtout, composer le samedi ferait entrer
 * deux jours d'aveuglement entre la décision et le clic.
 */

function dayKey(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Une réponse consignée depuis que la séquence court.
 *
 * **Le seul mécanisme d'arrêt tant que la détection est manuelle.** On prend la
 * date de l'interaction, pas seulement son existence.
 *
 * Le point de départ est le dernier envoi **ou, à défaut, l'inscription** — et
 * ce détail a été trouvé à la vérification, pas à la lecture. En prenant `null`
 * comme point de départ, toute réponse jamais consignée arrêtait la séquence
 * avant son premier message : un contact avec qui on a parlé il y a un an
 * devenait inéligible à vie, c'est-à-dire la moitié d'un CRM. Ce n'est pas ce
 * qu'« arrêter sur réponse » veut dire — c'est « ne pas relancer quelqu'un qui
 * vient de répondre ».
 */
async function repliedAfter(contactId: string, since: Date | null): Promise<Date | null> {
  const answer = await prisma.activity.findFirst({
    where: {
      ...REAL_ACTIVITY,
      contactId,
      outcome: { in: [...ANSWERED_OUTCOMES] },
      ...(since === null ? {} : { date: { gt: since } }),
    },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  return answer?.date ?? null;
}

export interface ComposeReport {
  readonly skipped: string | null;
  readonly composed: number;
  readonly sentAutomatically: number;
  readonly stopped: number;
  readonly waiting: number;
}

/**
 * Construit la file du jour.
 *
 * Appelée par le passage quotidien. Idempotente par construction : un départ
 * porte une clé unique `(inscription, étape)`, donc rejouer le passage ne peut
 * pas produire deux messages pour la même étape — c'est une contrainte de base,
 * pas une vérification applicative (leçon du jalon 8).
 */
export async function composeDepartures(now = new Date()): Promise<ComposeReport> {
  const empty = { composed: 0, sentAutomatically: 0, stopped: 0, waiting: 0 };

  if (isWeekend(now)) {
    return { ...empty, skipped: "Samedi ou dimanche : aucune composition, aucun départ." };
  }

  const enrollments = await prisma.sequenceEnrollment.findMany({
    where: { status: "active", sequence: { active: true } },
    include: {
      sequence: { include: { steps: { orderBy: { position: "asc" } } } },
      contact: { select: { id: true, lifecycle: true, lostReason: true, email: true } },
    },
  });

  let composed = 0;
  let sentAutomatically = 0;
  let stopped = 0;
  let waiting = 0;

  for (const enrollment of enrollments) {
    const replied = await repliedAfter(
      enrollment.contactId,
      enrollment.lastSentAt ?? enrollment.enrolledAt,
    );

    const verdict = nextStep(
      {
        lifecycle: toLifecycle(enrollment.contact.lifecycle),
        lostReason: enrollment.contact.lostReason,
        email: enrollment.contact.email,
      },
      { repliedAt: replied, lastSentAt: enrollment.lastSentAt, lastStep: enrollment.lastStep },
      enrollment.sequence.steps,
      now,
    );

    if (!verdict.ok) {
      if (stopsEnrollment(verdict.reason)) {
        await prisma.sequenceEnrollment.update({
          where: { id: enrollment.id },
          data: {
            status: verdict.reason === "finished" ? "done" : "stopped",
            // Le libellé est écrit **en clair** : c'est ce qu'on lira dans six
            // mois, et c'est aussi ce que compte le verrou du mode automatique
            // pour « cette séquence a-t-elle déjà fait répondre quelqu'un ».
            stopReason: BLOCK_LABELS[verdict.reason],
          },
        });
        stopped += 1;
      } else {
        waiting += 1;
      }
      continue;
    }

    // Déjà composé ce matin — le passage a été rejoué.
    const existing = await prisma.sequenceDeparture.findUnique({
      where: { enrollmentId_step: { enrollmentId: enrollment.id, step: verdict.step } },
    });
    if (existing !== null) continue;

    const step = enrollment.sequence.steps.find((entry) => entry.position === verdict.step);
    const draft = await draftEmail(enrollment.contactId, undefined, step?.brief);
    if (!draft.ok) {
      await prisma.sequenceDeparture.create({
        data: {
          enrollmentId: enrollment.id,
          step: verdict.step,
          day: dayKey(now),
          status: "failed",
          detail: draft.message,
        },
      });
      continue;
    }

    const departure = await prisma.sequenceDeparture.create({
      data: {
        enrollmentId: enrollment.id,
        step: verdict.step,
        day: dayKey(now),
        subject: draft.draft.subject,
        body: draft.draft.body,
      },
      select: { id: true },
    });
    composed += 1;

    // **Le mode automatique ne couvre jamais la première étape**, et il est
    // revérifié ici plutôt que cru sur parole : l'interrupteur exprime une
    // intention, les conditions expriment un fait, et un fait peut cesser
    // d'être vrai après qu'on a coché la case.
    const unlock = await unlockOf(enrollment.sequenceId);
    if (canSendAutomatically(verdict.step, enrollment.sequence.autoMode, unlock)) {
      const outcome = await sendDeparture(departure.id, true, now);
      if (outcome.ok) sentAutomatically += 1;
    }
  }

  return { skipped: null, composed, sentAutomatically, stopped, waiting };
}

async function unlockOf(sequenceId: string) {
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

export interface DepartureView {
  readonly id: string;
  readonly step: number;
  readonly status: string;
  readonly subject: string;
  readonly body: string;
  readonly detail: string;
  readonly sequenceName: string;
  readonly contactId: string;
  readonly contactName: string;
  readonly to: string;
  /**
   * Jours écoulés depuis la dernière interaction consignée, `null` s'il n'y en
   * a aucune.
   *
   * **C'est le garde-fou de la détection manuelle**, affiché sur chaque ligne :
   * « il y a 2 j » invite à ouvrir sa boîte avant de cliquer. Sans lui, la file
   * du lundi ressemble à celle du mardi, alors que deux jours de réponses
   * possibles la séparent de la dernière vérification.
   */
  readonly lastActivityDays: number | null;
  readonly lastActivityAt: Date | null;
}

/** La file du jour, telle qu'elle s'affiche. */
export async function listDepartures(now = new Date()): Promise<DepartureView[]> {
  const rows = await prisma.sequenceDeparture.findMany({
    where: { status: { in: ["pending", "failed"] } },
    orderBy: [{ createdAt: "asc" }],
    include: {
      enrollment: {
        include: {
          sequence: { select: { name: true } },
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      },
    },
  });

  const views: DepartureView[] = [];
  for (const row of rows) {
    const last = await prisma.activity.findFirst({
      where: { ...REAL_ACTIVITY, contactId: row.enrollment.contactId },
      orderBy: { date: "desc" },
      select: { date: true },
    });

    views.push({
      id: row.id,
      step: row.step,
      status: row.status,
      subject: row.subject,
      body: row.body,
      detail: row.detail,
      sequenceName: row.enrollment.sequence.name,
      contactId: row.enrollment.contact.id,
      contactName: contactTitle(row.enrollment.contact),
      to: row.enrollment.contact.email,
      lastActivityDays: last === null ? null : daysSince(last.date, now),
      lastActivityAt: last?.date ?? null,
    });
  }
  return views;
}

export type DepartureOutcome =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly message: string };

/**
 * Envoie un départ.
 *
 * L'ordre des garde-fous compte : **la règle du domaine d'abord, le débit
 * ensuite, l'envoi en dernier.** Vérifier le débit avant la règle ferait
 * refuser pour cause de plafond un message qui n'aurait de toute façon pas dû
 * partir, et le motif affiché serait faux.
 */
export async function sendDeparture(
  id: string,
  auto: boolean,
  now = new Date(),
): Promise<DepartureOutcome> {
  const departure = await prisma.sequenceDeparture.findUnique({
    where: { id },
    include: {
      enrollment: {
        include: {
          sequence: { select: { id: true, name: true, steps: true, autoMode: true } },
          contact: { select: { id: true, lifecycle: true, lostReason: true, email: true } },
        },
      },
    },
  });

  if (departure === null) return { ok: false, message: "Départ introuvable." };
  if (departure.status === "sent") return { ok: false, message: "Ce départ est déjà parti." };

  const enrollment = departure.enrollment;
  const replied = await repliedAfter(
    enrollment.contactId,
    enrollment.lastSentAt ?? enrollment.enrolledAt,
  );
  const verdict = nextStep(
    {
      lifecycle: toLifecycle(enrollment.contact.lifecycle),
      lostReason: enrollment.contact.lostReason,
      email: enrollment.contact.email,
    },
    { repliedAt: replied, lastSentAt: enrollment.lastSentAt, lastStep: enrollment.lastStep },
    enrollment.sequence.steps,
    now,
  );

  if (!verdict.ok || verdict.step !== departure.step) {
    const reason = verdict.ok
      ? "L'étape a changé depuis la composition."
      : BLOCK_LABELS[verdict.reason];

    await prisma.sequenceDeparture.update({
      where: { id },
      data: { status: "skipped", decidedAt: now, detail: reason },
    });
    if (!verdict.ok && stopsEnrollment(verdict.reason)) {
      await prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: verdict.reason === "finished" ? "done" : "stopped",
          stopReason: BLOCK_LABELS[verdict.reason],
        },
      });
    }
    return { ok: false, message: reason };
  }

  if (auto && !canSendAutomatically(verdict.step, enrollment.sequence.autoMode, await unlockOf(enrollment.sequenceId))) {
    return { ok: false, message: "Ce départ demande une validation à la main." };
  }

  const rate = await checkRate(now);
  if (!rate.ok) {
    // Ni envoyé ni perdu : le départ reste en attente et repart demain.
    await prisma.sequenceDeparture.update({ where: { id }, data: { detail: rate.reason } });
    return { ok: false, message: rate.reason };
  }

  const sent = await sendEmailToContact({
    contactId: enrollment.contactId,
    subject: departure.subject,
    body: departure.body,
    sequenceId: enrollment.sequence.id,
    sequenceName: enrollment.sequence.name,
    sequenceStep: departure.step,
  });

  if (!sent.ok) {
    await prisma.sequenceDeparture.update({
      where: { id },
      data: { status: "failed", decidedAt: now, detail: sent.message },
    });
    return { ok: false, message: sent.message };
  }

  await prisma.$transaction([
    prisma.sequenceDeparture.update({
      where: { id },
      data: { status: "sent", decidedAt: now, auto },
    }),
    prisma.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: { lastStep: departure.step, lastSentAt: now },
    }),
  ]);

  return {
    ok: true,
    message: `Étape ${departure.step} envoyée à ${sent.sent.contactName} (${sent.sent.to}).`,
  };
}

/**
 * Reporter d'un jour.
 *
 * Le départ est **supprimé**, pas déplacé : il sera recomposé demain matin à
 * partir de l'état de demain. Garder le brouillon d'aujourd'hui pour l'envoyer
 * demain reproduirait exactement le défaut que la composition du matin même
 * corrige.
 */
export async function postponeDeparture(id: string, now = new Date()): Promise<DepartureOutcome> {
  const departure = await prisma.sequenceDeparture.findUnique({
    where: { id },
    select: { status: true, enrollmentId: true },
  });
  if (departure === null) return { ok: false, message: "Départ introuvable." };
  if (departure.status === "sent") return { ok: false, message: "Ce départ est déjà parti." };

  await prisma.$transaction([
    prisma.sequenceDeparture.delete({ where: { id } }),
    // Le délai de l'étape court depuis le dernier envoi : décaler la date
    // d'inscription d'un jour évite qu'un report soit annulé dès demain par un
    // délai déjà échu, et fait que trois reports décalent bien de trois jours.
    prisma.sequenceEnrollment.update({
      where: { id: departure.enrollmentId },
      data: { lastSentAt: now },
    }),
  ]);

  return { ok: true, message: "Reporté à demain. Le brouillon sera réécrit avec l'état de demain." };
}

/** Retirer le contact de la séquence, définitivement. */
export async function removeFromSequence(id: string, now = new Date()): Promise<DepartureOutcome> {
  const departure = await prisma.sequenceDeparture.findUnique({
    where: { id },
    select: { enrollmentId: true, status: true },
  });
  if (departure === null) return { ok: false, message: "Départ introuvable." };

  await prisma.$transaction([
    prisma.sequenceDeparture.update({
      where: { id },
      data: { status: "skipped", decidedAt: now, detail: "Retiré de la séquence à la main" },
    }),
    prisma.sequenceEnrollment.update({
      where: { id: departure.enrollmentId },
      data: { status: "stopped", stopReason: "Retiré de la séquence à la main" },
    }),
  ]);

  return { ok: true, message: "Contact retiré de la séquence." };
}
