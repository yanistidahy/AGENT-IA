import { describe, expect, it } from "vitest";
import { createActivitySchema } from "../activity-schemas";
import { createTaskSchema, parseTasksQuery, updateTaskSchema } from "../task-schemas";
import { runSequenceSchema, updateSequenceSchema } from "../sequences";

const task = { title: "Relancer", due: "2026-09-01", owner: "Yanis" } as const;

describe("createTaskSchema", () => {
  it("accepte le minimum : intitulé, échéance, propriétaire", () => {
    const parsed = createTaskSchema.safeParse(task);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.due).toBeInstanceOf(Date);
  });

  it("refuse un intitulé vide", () => {
    const parsed = createTaskSchema.safeParse({ ...task, title: "  " });
    expect(parsed.error?.issues[0]?.message).toBe("Décrivez la tâche");
  });

  it("refuse une échéance illisible plutôt que de la ramener à aujourd'hui", () => {
    const parsed = createTaskSchema.safeParse({ ...task, due: "la semaine prochaine" });
    expect(parsed.error?.issues[0]?.message).toBe("Échéance invalide");
  });

  it("accepte un rattachement unique", () => {
    expect(createTaskSchema.safeParse({ ...task, dealId: "d1" }).success).toBe(true);
  });

  it("refuse deux rattachements à la fois", () => {
    const parsed = createTaskSchema.safeParse({ ...task, dealId: "d1", contactId: "c1" });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(
      "Une tâche ne peut être rattachée qu'à une seule fiche",
    );
  });

  it("ne compte pas un rattachement nul comme un rattachement", () => {
    expect(
      createTaskSchema.safeParse({ ...task, dealId: "d1", contactId: null }).success,
    ).toBe(true);
  });
});

describe("updateTaskSchema", () => {
  it("refuse une charge utile vide", () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
  });

  it("accepte la seule bascule de la coche", () => {
    expect(updateTaskSchema.safeParse({ done: true }).success).toBe(true);
  });
});

describe("parseTasksQuery", () => {
  it("écarte les filtres vides", () => {
    expect(parseTasksQuery({ owner: "", scope: "open" }).data).toEqual({ scope: "open" });
  });

  it("refuse une portée inconnue", () => {
    expect(parseTasksQuery({ scope: "urgent" }).success).toBe(false);
  });
});

const activity = { type: "call", date: "2026-08-01", owner: "Yanis", contactId: "c1" } as const;

describe("createActivitySchema", () => {
  it("accepte une interaction rattachée à une fiche", () => {
    expect(createActivitySchema.safeParse(activity).success).toBe(true);
  });

  it("refuse une interaction orpheline", () => {
    const parsed = createActivitySchema.safeParse({ ...activity, contactId: null });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(
      "Rattachez l'interaction à un contact, une société ou une affaire",
    );
  });

  it("refuse un type d'interaction hors liste", () => {
    expect(createActivitySchema.safeParse({ ...activity, type: "sms" }).success).toBe(false);
  });

  it("accepte une prochaine action complète", () => {
    const parsed = createActivitySchema.safeParse({
      ...activity,
      nextAction: { title: "Rappeler", due: "2026-08-08" },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.nextAction?.due).toBeInstanceOf(Date);
  });

  it("refuse une prochaine action sans échéance : la relance serait perdue", () => {
    const parsed = createActivitySchema.safeParse({
      ...activity,
      nextAction: { title: "Rappeler" },
    });
    expect(parsed.success).toBe(false);
  });

  it("refuse une prochaine action sans intitulé", () => {
    const parsed = createActivitySchema.safeParse({
      ...activity,
      nextAction: { title: "  ", due: "2026-08-08" },
    });
    expect(parsed.error?.issues[0]?.message).toBe("Décrivez la prochaine action");
  });

  it("accepte l'absence de prochaine action", () => {
    expect(
      createActivitySchema.safeParse({ ...activity, nextAction: null }).success,
    ).toBe(true);
  });
});

describe("séquences", () => {
  it("refuse un lancement sans cible", () => {
    const parsed = runSequenceSchema.safeParse({ owner: "Yanis", start: "2026-08-01" });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(
      "Choisissez un contact, une société ou une affaire",
    );
  });

  it("accepte un lancement sur une affaire", () => {
    const parsed = runSequenceSchema.safeParse({
      owner: "Yanis",
      start: "2026-08-01",
      dealId: "d1",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.start).toBeInstanceOf(Date);
  });

  it("refuse une étape à décalage négatif", () => {
    const parsed = updateSequenceSchema.safeParse({
      steps: [{ day: -1, channel: "email", label: "x" }],
    });
    expect(parsed.error?.issues[0]?.message).toBe("Le décalage ne peut être négatif");
  });

  it("refuse un canal inconnu", () => {
    const parsed = updateSequenceSchema.safeParse({
      steps: [{ day: 0, channel: "sms", label: "x" }],
    });
    expect(parsed.error?.issues[0]?.message).toBe("Canal inconnu");
  });

  it("accepte une séquence vidée de ses étapes", () => {
    expect(updateSequenceSchema.safeParse({ steps: [] }).success).toBe(true);
  });
});
