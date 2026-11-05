import { describe, expect, it } from "vitest";
import { dayProgress, ringDash, tomorrowLabel } from "../progress";

describe("avancement du jour", () => {
  it("avance à mesure qu'on traite", () => {
    const start = dayProgress(0, 10, 10);
    expect(start.ratio).toBe(0);
    const middle = dayProgress(4, 6, 10);
    expect(middle.ratio).toBeCloseTo(0.4);
    expect(middle.complete).toBe(false);
  });

  /**
   * Le dénominateur ne recule jamais : sans cela, la file rétrécissant à chaque
   * élément traité, l'anneau resterait immobile toute la journée.
   */
  it("ne laisse pas le total descendre sous ce qui est fait plus ce qui reste", () => {
    expect(dayProgress(8, 5, 10).planned).toBe(13);
    expect(dayProgress(8, 2, 10).planned).toBe(10);
  });

  it("distingue une journée finie d'une journée vide", () => {
    const finished = dayProgress(7, 0, 7);
    expect(finished.complete).toBe(true);
    expect(finished.ratio).toBe(1);

    // Rien à faire n'est pas un accomplissement : zéro sur zéro ne vaut pas 100 %.
    const nothing = dayProgress(0, 0, 0);
    expect(nothing.empty).toBe(true);
    expect(nothing.complete).toBe(false);
    expect(nothing.ratio).toBe(0);
  });

  it("dessine un anneau plein quand tout est fait", () => {
    const full = ringDash(1, 26);
    expect(full.offset).toBeCloseTo(0);
    const empty = ringDash(0, 26);
    expect(empty.offset).toBeCloseTo(empty.circumference);
    // Un ratio aberrant ne doit pas produire un tracé négatif.
    expect(ringDash(4, 26).offset).toBeCloseTo(0);
  });

  it("annonce demain, au pluriel juste", () => {
    expect(tomorrowLabel(0)).toContain("Rien de programmé");
    expect(tomorrowLabel(1)).toBe("1 relance demain.");
    expect(tomorrowLabel(4)).toBe("4 relances demain.");
  });
});
