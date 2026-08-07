import { daysSince } from "./dates";
import { money } from "../format";
import { daysSinceLastTouch, openDeals, resolveStage } from "./pipeline";
import {
  ALERT_LEVELS,
  type Alert,
  type ContactLike,
  type DealLike,
  type PilotageSettings,
  type StageLike,
  type TaskLike,
} from "./types";

interface AlertInput {
  readonly tasks: readonly TaskLike[];
  readonly deals: readonly DealLike[];
  readonly stages: readonly StageLike[];
  readonly contacts: readonly ContactLike[];
  readonly settings: PilotageSettings;
  readonly now: Date;
}

/** 1 — Tâche non terminée dont l'échéance est dépassée. */
export function taskOverdueAlerts(
  tasks: readonly TaskLike[],
  now: Date,
): Alert[] {
  return tasks
    .filter((task) => !task.done && daysSince(task.due, now) > 0)
    .map((task) => ({
      kind: "task-overdue" as const,
      level: "hi" as const,
      title: `Tâche en retard de ${daysSince(task.due, now)} j`,
      detail: task.title,
      targetType: "task" as const,
      targetId: task.id,
    }));
}

/** 2 — Affaire en cours sans contact depuis `coldDays` jours ou plus. */
export function coldDealAlerts(
  deals: readonly DealLike[],
  stages: readonly StageLike[],
  settings: PilotageSettings,
  now: Date,
): Alert[] {
  return openDeals(deals)
    .filter((deal) => daysSinceLastTouch(deal, now) >= settings.coldDays)
    .map((deal) => {
      const stage = resolveStage(stages, deal.stageId);
      return {
        kind: "deal-cold" as const,
        level: "hi" as const,
        title: `${deal.name} — sans contact depuis ${daysSinceLastTouch(deal, now)} j`,
        detail: `${money(deal.amount)} à risque · étape « ${stage?.name ?? "inconnue"} »`,
        targetType: "deal" as const,
        targetId: deal.id,
      };
    });
}

/** 3 — Affaire en cours silencieuse entre `staleDays` et `coldDays` jours. */
export function staleDealAlerts(
  deals: readonly DealLike[],
  stages: readonly StageLike[],
  settings: PilotageSettings,
  now: Date,
): Alert[] {
  return openDeals(deals)
    .filter((deal) => {
      const elapsed = daysSinceLastTouch(deal, now);
      return elapsed >= settings.staleDays && elapsed < settings.coldDays;
    })
    .map((deal) => {
      const stage = resolveStage(stages, deal.stageId);
      return {
        kind: "deal-stale" as const,
        level: "md" as const,
        title: `${deal.name} — silencieuse depuis ${daysSinceLastTouch(deal, now)} j`,
        detail: `Étape « ${stage?.name ?? "inconnue"} » · ${money(deal.amount)}`,
        targetType: "deal" as const,
        targetId: deal.id,
      };
    });
}

/**
 * 4 — Affaire en cours dont la date de clôture prévue est passée.
 *
 * Écart assumé avec le prototype : celui-ci n'écarte pas les affaires sans date
 * de clôture, et `new Date(null)` y vaut l'époque Unix, ce qui déclenche l'alerte
 * pour toute affaire sans date. Ici, `expectedClose === null` ne produit rien.
 */
export function closeDatePassedAlerts(
  deals: readonly DealLike[],
  now: Date,
): Alert[] {
  return openDeals(deals)
    .filter((deal) => deal.expectedClose !== null && daysSince(deal.expectedClose, now) > 0)
    .map((deal) => ({
      kind: "close-date-passed" as const,
      level: "md" as const,
      title: `${deal.name} — clôture dépassée`,
      detail: "Reporter la date ou clôturer l'affaire.",
      targetType: "deal" as const,
      targetId: deal.id,
    }));
}

/** 5 — Contact dont le rappel programmé est dû. */
export function contactReminderAlerts(
  contacts: readonly ContactLike[],
  now: Date,
): Alert[] {
  return contacts
    .filter(
      (contact) =>
        contact.nextReminder !== null && daysSince(contact.nextReminder, now) >= 0,
    )
    .map((contact) => ({
      kind: "contact-reminder" as const,
      level: "md" as const,
      title: `Rappel : ${contact.firstName} ${contact.lastName}`,
      detail: "Rappel programmé arrivé à échéance.",
      targetType: "contact" as const,
      targetId: contact.id,
    }));
}

/** 6 — Affaire gagnée entre 30 et 39 jours : la séquence post-vente est due. */
export function postWinCheckinAlerts(
  deals: readonly DealLike[],
  now: Date,
): Alert[] {
  return deals
    .filter((deal) => {
      if (deal.status !== "won" || deal.closedAt === null) return false;
      const elapsed = daysSince(deal.closedAt, now);
      return elapsed >= 30 && elapsed < 40;
    })
    .map((deal) => ({
      kind: "post-win-checkin" as const,
      level: "low" as const,
      title: `Check-in 30 jours — ${deal.name}`,
      detail: "La séquence post-vente est due.",
      targetType: "deal" as const,
      targetId: deal.id,
    }));
}

/**
 * Les six générateurs, concaténés puis triés par urgence (hi, md, low).
 * Le tri est stable : à niveau égal, l'ordre des générateurs est conservé.
 */
export function getAlerts(input: AlertInput): Alert[] {
  const { tasks, deals, stages, contacts, settings, now } = input;

  const all: Alert[] = [
    ...taskOverdueAlerts(tasks, now),
    ...coldDealAlerts(deals, stages, settings, now),
    ...staleDealAlerts(deals, stages, settings, now),
    ...closeDatePassedAlerts(deals, now),
    ...contactReminderAlerts(contacts, now),
    ...postWinCheckinAlerts(deals, now),
  ];

  return all.sort(
    (a, b) => ALERT_LEVELS.indexOf(a.level) - ALERT_LEVELS.indexOf(b.level),
  );
}
