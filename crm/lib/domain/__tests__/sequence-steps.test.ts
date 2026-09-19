import { describe, expect, it } from "vitest";
import {
  connectorLabel,
  describeTiming,
  moveStep,
  stepDays,
  stepPreview,
} from "../sequence-steps";

describe("le rythme d'une séquence", () => {
  const steps = [
    { delayDays: 0, brief: "présenter" },
    { delayDays: 4, brief: "relancer" },
    { delayDays: 7, brief: "clore" },
  ];

  it("cumule les délais depuis l'inscription", () => {
    expect(stepDays(steps).map((entry) => entry.day)).toEqual([0, 4, 11]);
  });

  it("la première étape part le jour de l'inscription, quoi qu'on saisisse", () => {
    // Le moteur l'impose ; un écran qui promettrait J+9 mentirait.
    expect(stepDays([{ delayDays: 9 }])[0]).toEqual({ delayDays: 0, day: 0 });
  });

  it("un délai négatif ne fait pas reculer la séquence", () => {
    expect(stepDays([{ delayDays: 0 }, { delayDays: -3 }]).map((e) => e.day)).toEqual([0, 0]);
  });

  it("le connecteur dit les jours, et zéro se dit en toutes lettres", () => {
    expect(connectorLabel(4)).toBe("J+4");
    expect(connectorLabel(0)).toBe("le même jour");
  });

  it("chaque bloc dit quand il part, et depuis quelle étape", () => {
    const timings = stepDays(steps);
    expect(describeTiming(0, timings[0]!)).toBe("Part le jour de l'inscription");
    expect(describeTiming(1, timings[1]!)).toBe(
      "Part 4 jours après l'étape 1 · jour 4 de la séquence",
    );
    expect(describeTiming(2, timings[2]!)).toBe(
      "Part 7 jours après l'étape 2 · jour 11 de la séquence",
    );
  });
});

describe("l'aperçu d'une étape", () => {
  it("rend la première ligne non vide", () => {
    expect(stepPreview("\n  rappeler la démo\nautre chose").text).toBe("rappeler la démo");
  });

  it("tronque plutôt que de rendre toute la consigne", () => {
    const preview = stepPreview("a".repeat(300));
    expect(preview.text.length).toBeLessThanOrEqual(90);
    expect(preview.text.endsWith("…")).toBe(true);
  });

  it("une consigne vide dit que l'étape n'écrira rien", () => {
    // C'est la cause de silence la plus fréquente d'une campagne neuve
    // (jalon 56), et elle doit se voir sans ouvrir le bloc.
    const preview = stepPreview("   ");
    expect(preview.empty).toBe(true);
    expect(preview.text).toMatch(/n'écrira rien/);
  });
});

describe("réordonner", () => {
  const steps = [
    { delayDays: 0, brief: "un" },
    { delayDays: 4, brief: "deux" },
    { delayDays: 7, brief: "trois" },
  ];

  it("déplace le message, pas le rythme", () => {
    const moved = moveStep(steps, 2, -1);
    expect(moved.map((s) => s.brief)).toEqual(["un", "trois", "deux"]);
    // Les délais restent attachés à leur rang : monter un message ne redéfinit
    // pas toute la cadence, et la première étape ne peut pas hériter d'un J+4
    // que le moteur ramènerait à zéro en silence.
    expect(moved.map((s) => s.delayDays)).toEqual([0, 4, 7]);
  });

  it("monter la première ou descendre la dernière ne change rien", () => {
    expect(moveStep(steps, 0, -1)).toEqual(steps);
    expect(moveStep(steps, 2, 1)).toEqual(steps);
  });

  it("retirer une étape renumérote les suivantes par construction", () => {
    // La numérotation est l'indice : il n'y a aucun état à recalculer, donc
    // aucun « Étape 1, Étape 3 » possible.
    const left = steps.filter((_, index) => index !== 1);
    expect(left.map((_, index) => `Étape ${index + 1}`)).toEqual(["Étape 1", "Étape 2"]);
    expect(left.map((s) => s.brief)).toEqual(["un", "trois"]);
  });
});
