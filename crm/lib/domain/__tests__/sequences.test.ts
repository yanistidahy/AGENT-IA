import { describe, expect, it } from "vitest";
import { daysBetween } from "../dates";
import { generateSequenceTasks } from "../sequences";
import { taskBucket, taskTarget } from "../tasks";
import { NOW, daysAgo, inDays, makeSequence, makeTask } from "./fixtures";

describe("generateSequenceTasks", () => {
  it("crée une tâche par étape, décalée du bon nombre de jours", () => {
    const tasks = generateSequenceTasks(makeSequence(), NOW, {
      owner: "Yanis",
      dealId: "d1",
    });

    expect(tasks).toHaveLength(3);
    expect(tasks.map((task) => daysBetween(NOW, task.due))).toEqual([0, 3, 8]);
    expect(tasks.map((task) => task.title)).toEqual([
      "Email de reprise",
      "Message LinkedIn avec le cas client",
      "Appel court : diagnostic 15 min",
    ]);
  });

  it("rattache toutes les tâches à la même cible", () => {
    const tasks = generateSequenceTasks(makeSequence(), NOW, {
      owner: "Associé",
      contactId: "p4",
    });

    expect(tasks.every((task) => task.contactId === "p4")).toBe(true);
    expect(tasks.every((task) => task.dealId === null)).toBe(true);
    expect(tasks.every((task) => task.owner === "Associé")).toBe(true);
  });

  it("ne produit rien quand la séquence est en pause", () => {
    const paused = makeSequence({ active: false });
    expect(generateSequenceTasks(paused, NOW, { owner: "Yanis" })).toEqual([]);
  });

  it("trie les étapes par échéance même si elles sont saisies dans le désordre", () => {
    const messy = makeSequence({
      steps: [
        { day: 9, channel: "email", label: "Clôture" },
        { day: 0, channel: "email", label: "Ouverture" },
        { day: 4, channel: "call", label: "Relance" },
      ],
    });
    const titles = generateSequenceTasks(messy, NOW, { owner: "Yanis" }).map((t) => t.title);
    expect(titles).toEqual(["Ouverture", "Relance", "Clôture"]);
  });

  it("applique la priorité demandée, sinon « normale »", () => {
    const [defaultTask] = generateSequenceTasks(makeSequence(), NOW, { owner: "Yanis" });
    expect(defaultTask?.priority).toBe("normale");

    const [urgent] = generateSequenceTasks(makeSequence(), NOW, {
      owner: "Yanis",
      priority: "haute",
    });
    expect(urgent?.priority).toBe("haute");
  });
});

describe("taskTarget", () => {
  it("privilégie l'affaire, rattachement le plus spécifique", () => {
    expect(taskTarget({ dealId: "d1", contactId: "p1", companyId: "c1" })).toEqual({
      type: "deal",
      id: "d1",
    });
  });

  it("retombe sur le contact puis sur la société", () => {
    expect(taskTarget({ dealId: null, contactId: "p1", companyId: "c1" })).toEqual({
      type: "contact",
      id: "p1",
    });
    expect(taskTarget({ dealId: null, contactId: null, companyId: "c1" })).toEqual({
      type: "company",
      id: "c1",
    });
  });

  it("renvoie null pour une tâche libre", () => {
    expect(taskTarget({ dealId: null, contactId: null, companyId: null })).toBeNull();
  });
});

describe("taskBucket", () => {
  it("range chaque tâche dans le bon groupe", () => {
    expect(taskBucket(makeTask({ due: daysAgo(2) }), NOW)).toBe("En retard");
    expect(taskBucket(makeTask({ due: NOW }), NOW)).toBe("Aujourd'hui");
    expect(taskBucket(makeTask({ due: inDays(4) }), NOW)).toBe("Cette semaine");
    expect(taskBucket(makeTask({ due: inDays(30) }), NOW)).toBe("Plus tard");
    expect(taskBucket(makeTask({ due: daysAgo(2), done: true }), NOW)).toBe("Terminées");
  });
});
