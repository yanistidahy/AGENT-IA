import { describe, expect, it } from "vitest";
import {
  autoKey,
  DEFAULT_REMINDER_DELAYS,
  isAutoKind,
  proposedReminder,
  reminderTask,
  stageTask,
  staleDealTask,
} from "../automation";
import { addDays, startOfDay } from "../dates";

const now = new Date("2026-08-08T14:30:00Z");

describe("autoKey", () => {
  /**
   * L'unicité de la clé *est* la protection anti-doublon. Ces tests fixent la
   * granularité de chaque règle, parce que c'est elle qui décide ce que
   * « rejouer le même déclencheur » veut dire.
   */
  it("un seul rappel par contact, quelle que soit la date", () => {
    expect(autoKey("reminder", "c1")).toBe("reminder:c1");
    expect(autoKey("reminder", "c1")).toBe(autoKey("reminder", "c1"));
  });

  it("une action d'étape par couple affaire + étape", () => {
    expect(autoKey("stage", "d1", "s4")).toBe("stage:d1:s4");
    expect(autoKey("stage", "d1", "s4")).not.toBe(autoKey("stage", "d1", "s5"));
  });

  it("un réveil par affaire", () => {
    expect(autoKey("stale", "d1")).toBe("stale:d1");
  });

  it("se relit pour savoir de quelle règle vient une tâche", () => {
    expect(isAutoKind("reminder:c1", "reminder")).toBe(true);
    expect(isAutoKind("stage:d1:s4", "reminder")).toBe(false);
  });
});

describe("reminderTask", () => {
  const due = new Date("2026-08-15T00:00:00Z");
  const task = reminderTask({
    contactId: "c1",
    contactName: "Marie Durand",
    owner: "Yanis",
    due,
  });

  it("nomme la personne, pas un identifiant", () => {
    expect(task.title).toBe("Relancer Marie Durand");
  });

  it("est rattachée au contact et à rien d'autre", () => {
    expect(task.contactId).toBe("c1");
    expect(task.companyId).toBeNull();
    expect(task.dealId).toBeNull();
  });

  it("reprend l'échéance saisie, sans la décaler", () => {
    expect(task.due).toEqual(due);
  });

  it("garde la même clé quand la date change : la tâche se déplace", () => {
    const moved = reminderTask({
      contactId: "c1",
      contactName: "Marie Durand",
      owner: "Yanis",
      due: addDays(due, 10),
    });
    expect(moved.autoKey).toBe(task.autoKey);
  });
});

describe("stageTask", () => {
  const base = {
    dealId: "d1",
    dealName: "Bot SAV",
    stageId: "s4",
    stageLabel: "Relancer sur la proposition",
    stageDays: 4,
    owner: "Yanis",
    from: now,
  };

  it("date l'action au délai configuré de l'étape", () => {
    const task = stageTask(base);
    expect(task?.due).toEqual(startOfDay(addDays(now, 4)));
  });

  it("nomme l'affaire dans le titre : /taches ne montre pas le contexte", () => {
    expect(stageTask(base)?.title).toBe("Relancer sur la proposition — Bot SAV");
  });

  it("ne propose rien quand l'étape ne déclare pas d'action", () => {
    expect(stageTask({ ...base, stageLabel: "" })).toBeNull();
    expect(stageTask({ ...base, stageLabel: "   " })).toBeNull();
  });

  it("distingue deux étapes de la même affaire", () => {
    const a = stageTask(base);
    const b = stageTask({ ...base, stageId: "s5", stageLabel: "Relancer la négo" });
    expect(a?.autoKey).not.toBe(b?.autoKey);
  });
});

describe("staleDealTask", () => {
  it("est due immédiatement et prioritaire : l'affaire stagne déjà", () => {
    const task = staleDealTask({ dealId: "d1", dealName: "Bot SAV", owner: "Yanis", from: now });
    expect(task.due).toEqual(startOfDay(now));
    expect(task.priority).toBe("haute");
  });
});

describe("proposedReminder", () => {
  const delays = DEFAULT_REMINDER_DELAYS;

  it("propose selon le type d'interaction", () => {
    const cases: ReadonlyArray<["call" | "email" | "demo" | "meeting" | "note", number]> = [
      ["call", 7],
      ["email", 4],
      ["demo", 2],
      ["meeting", 3],
      ["note", 7],
    ];
    for (const [type, days] of cases) {
      const proposal = proposedReminder({
        type,
        interactionDate: now,
        existingReminder: null,
        delays,
      });
      expect(proposal, type).toEqual(startOfDay(addDays(now, days)));
    }
  });

  it("suit les délais configurés plutôt qu'une constante", () => {
    const proposal = proposedReminder({
      type: "call",
      interactionDate: now,
      existingReminder: null,
      delays: { ...delays, call: 21 },
    });
    expect(proposal).toEqual(startOfDay(addDays(now, 21)));
  });

  /**
   * Le cas qui distingue une proposition utile d'une intrusion : le contact a
   * déjà une relance plus lointaine, décidée volontairement. Avancer cette date
   * sans le dire reviendrait à décider à la place de l'utilisateur.
   */
  it("ne propose rien si une relance plus lointaine existe déjà", () => {
    expect(
      proposedReminder({
        type: "call",
        interactionDate: now,
        existingReminder: addDays(now, 30),
        delays,
      }),
    ).toBeNull();
  });

  it("propose quand la relance existante est plus proche que la proposition", () => {
    const proposal = proposedReminder({
      type: "call",
      interactionDate: now,
      existingReminder: addDays(now, 2),
      delays,
    });
    expect(proposal).toEqual(startOfDay(addDays(now, 7)));
  });

  it("propose quand la relance existante est déjà passée", () => {
    const proposal = proposedReminder({
      type: "email",
      interactionDate: now,
      existingReminder: addDays(now, -5),
      delays,
    });
    expect(proposal).toEqual(startOfDay(addDays(now, 4)));
  });
});
