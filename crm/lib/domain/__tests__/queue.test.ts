import { describe, expect, it } from "vitest";
import {
  batchActions,
  blockedBy,
  buildSections,
  moveCursor,
  parseQueueId,
  selectionLabel,
  visibleOrder,
  type QueueGroup,
  type QueueRowLike,
} from "../queue";

/**
 * Les trois règles de la file, testées sans navigateur : le regroupement, ce
 * qu'une action groupée accepte, et où va le curseur.
 */
function row(
  id: string,
  overrides: Partial<QueueRowLike> = {},
): QueueRowLike {
  const group: QueueGroup = overrides.group ?? "reminders";
  return {
    id,
    group,
    company: null,
    contactId: group === "reminders" ? `c-${id}` : null,
    taskId: group === "tasks" ? `t-${id}` : null,
    dealId: group === "deals" ? `d-${id}` : null,
    ...overrides,
  };
}

describe("identifiants de ligne", () => {
  it("se relisent sans ambiguïté", () => {
    expect(parseQueueId("reminder-abc")).toEqual({ kind: "reminder", ref: "abc" });
    expect(parseQueueId("task-xyz")).toEqual({ kind: "task", ref: "xyz" });
    // Un cuid peut contenir des tirets : seule la première coupure compte.
    expect(parseQueueId("deal-a-b-c")).toEqual({ kind: "deal", ref: "a-b-c" });
  });

  it("refusent ce qu'ils ne savent pas lire", () => {
    for (const value of ["", "abc", "contact-1", "-1", "reminder-"]) {
      expect(parseQueueId(value), value).toBeNull();
    }
  });
});

describe("regroupement", () => {
  it("regroupe à partir de deux lignes d'une même société", () => {
    const sections = buildSections([
      row("a", { company: "Atelier Nord" }),
      row("b", { company: "Atelier Nord" }),
      row("c", { company: "Seul" }),
    ]);

    const clusters = sections[0]?.clusters ?? [];
    expect(clusters).toHaveLength(2);
    expect(clusters[0]?.clustered).toBe(true);
    expect(clusters[0]?.rows).toHaveLength(2);
    // Seule de sa société : pas d'en-tête « (1) » pour rien.
    expect(clusters[1]?.clustered).toBe(false);
  });

  it("ne regroupe jamais les fiches sans société", () => {
    const sections = buildSections([row("a"), row("b"), row("c")]);
    expect(sections[0]?.clusters.every((cluster) => !cluster.clustered)).toBe(true);
  });

  /**
   * L'ordre d'urgence est décidé par la lecture ; le regroupement ne doit pas
   * le rejouer. Un tri alphabétique ferait remonter « Atelier » devant une
   * relance en retard de trois semaines.
   */
  it("conserve l'ordre d'apparition des sociétés", () => {
    const sections = buildSections([
      row("a", { company: "Zèbre" }),
      row("b", { company: "Zèbre" }),
      row("c", { company: "Alpha" }),
      row("d", { company: "Alpha" }),
    ]);
    expect(sections[0]?.clusters.map((cluster) => cluster.company)).toEqual(["Zèbre", "Alpha"]);
  });

  it("sépare les sections et omet les vides", () => {
    const sections = buildSections([row("a"), row("b", { group: "deals" })]);
    expect(sections.map((section) => section.group)).toEqual(["reminders", "deals"]);
  });
});

describe("ordre visible et curseur", () => {
  const sections = buildSections([
    row("a", { company: "Nord" }),
    row("b", { company: "Nord" }),
    row("c"),
  ]);

  it("enjambe les groupes repliés", () => {
    expect(visibleOrder(sections, new Set())).toEqual(["a", "b", "c"]);
    expect(visibleOrder(sections, new Set(["reminders:Nord"]))).toEqual(["c"]);
  });

  it("ne boucle pas aux extrémités", () => {
    const order = ["a", "b", "c"];
    expect(moveCursor(order, null, 1)).toBe("a");
    expect(moveCursor(order, "a", -1)).toBe("a");
    expect(moveCursor(order, "c", 1)).toBe("c");
    expect(moveCursor(order, "b", 1)).toBe("c");
  });

  it("retombe sur une extrémité quand le curseur a disparu", () => {
    // La ligne pointée vient d'être traitée : le curseur ne doit pas se perdre.
    expect(moveCursor(["a", "b"], "disparue", 1)).toBe("a");
    expect(moveCursor([], "a", 1)).toBeNull();
  });
});

describe("actions groupées", () => {
  it("n'offre une action que si toute la sélection la supporte", () => {
    const contacts = [row("a"), row("b")];
    expect(batchActions(contacts)).toContain("lost");
    expect(batchActions(contacts)).toContain("sequence");

    // Une affaire se glisse dans la sélection : « perdu » et « séquence »
    // disparaissent plutôt que de ne traiter que la moitié des lignes.
    const mixed = [...contacts, row("c", { group: "deals" })];
    expect(batchActions(mixed)).not.toContain("lost");
    expect(batchActions(mixed)).not.toContain("postpone-3");
  });

  it("compte ce qui bloque, pour pouvoir l'expliquer", () => {
    const mixed = [row("a"), row("b", { group: "deals" }), row("c", { group: "deals" })];
    expect(blockedBy(mixed, "lost")).toBe(2);
    expect(blockedBy(mixed, "postpone-3")).toBe(2);
  });

  it("n'offre rien sur une sélection vide", () => {
    expect(batchActions([])).toEqual([]);
  });

  it("accorde le libellé de sélection", () => {
    expect(selectionLabel(1)).toBe("1 sélectionné");
    expect(selectionLabel(6)).toBe("6 sélectionnés");
  });
});
