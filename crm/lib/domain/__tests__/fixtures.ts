import { DAY_MS } from "../dates";
import type {
  ContactLike,
  DealLike,
  PilotageSettings,
  SequenceLike,
  StageLike,
  TaskLike,
} from "../types";

/** Instant de référence fixe : les tests ne dépendent pas de l'horloge. */
export const NOW = new Date("2025-06-15T12:00:00.000Z");

export function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY_MS);
}

export function inDays(n: number): Date {
  return new Date(NOW.getTime() + n * DAY_MS);
}

/** Les 6 étapes du prototype, avec leurs probabilités d'origine. */
export const STAGES: StageLike[] = [
  { id: "s1", name: "Nouveau lead", color: "#94A9A4", prob: 10, position: 0 },
  { id: "s2", name: "Contacté", color: "#2C7BE5", prob: 25, position: 1 },
  { id: "s3", name: "Démo planifiée", color: "#6D5AE6", prob: 45, position: 2 },
  { id: "s4", name: "Proposition envoyée", color: "#D99323", prob: 65, position: 3 },
  { id: "s5", name: "Négociation", color: "#E8503F", prob: 85, position: 4 },
  { id: "s6", name: "Gagné", color: "#0FA88F", prob: 100, position: 5 },
];

export const SETTINGS: PilotageSettings = {
  staleDays: 7,
  coldDays: 14,
  objectifMensuel: 15000,
};

export function makeDeal(overrides: Partial<DealLike> = {}): DealLike {
  return {
    id: "d1",
    name: "Assistant IA — Test",
    amount: 10000,
    stageId: "s4",
    status: "open",
    prob: null,
    owner: "Yanis",
    createdAt: daysAgo(30),
    expectedClose: inDays(10),
    lastActivityAt: daysAgo(1),
    closedAt: null,
    ...overrides,
  };
}

export function makeTask(overrides: Partial<TaskLike> = {}): TaskLike {
  return {
    id: "t1",
    title: "Relancer Sophie",
    due: inDays(1),
    done: false,
    priority: "normale",
    owner: "Yanis",
    ...overrides,
  };
}

export function makeContact(overrides: Partial<ContactLike> = {}): ContactLike {
  return {
    id: "p1",
    firstName: "Sophie",
    lastName: "Meunier",
    lifecycle: "Prospect",
    source: "LinkedIn",
    owner: "Yanis",
    createdAt: daysAgo(20),
    nextReminder: null,
    ...overrides,
  };
}

export function makeSequence(overrides: Partial<SequenceLike> = {}): SequenceLike {
  return {
    id: "q1",
    name: "Nurturing lead froid",
    trigger: "Lead sans réponse depuis 14 jours",
    active: true,
    steps: [
      { day: 0, channel: "email", label: "Email de reprise" },
      { day: 3, channel: "linkedin", label: "Message LinkedIn avec le cas client" },
      { day: 8, channel: "call", label: "Appel court : diagnostic 15 min" },
    ],
    ...overrides,
  };
}
