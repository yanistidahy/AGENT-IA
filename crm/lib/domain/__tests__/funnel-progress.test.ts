import { describe, expect, it } from "vitest";
import { buildFunnel, conversionRate, neverApproached } from "../funnel";
import { dayProgress, ringDash, tomorrowLabel } from "../progress";
import { describeDelta } from "../kpi-delta";

describe("entonnoir", () => {
  const data = { total: 139, contacted: 77, thisWeek: 31, answered: 4, deals: 0 };

  it("enchaîne les cinq bandes et leurs taux de passage", () => {
    const bands = buildFunnel(data);
    expect(bands.map((band) => band.value)).toEqual([139, 77, 31, 4, 0]);
    expect(bands[0]?.rate).toBeNull();
    expect(bands[1]?.rate).toBe(55);
    expect(bands[4]?.rate).toBe(0);
  });

  /**
   * Le point qui compte : un taux sur zéro n'est pas zéro pour cent. Zéro pour
   * cent affirme un échec de conversion ; ici il n'y a rien à convertir.
   */
  it("refuse d'inventer un taux quand la bande de départ est vide", () => {
    expect(conversionRate(0, 0)).toBeNull();
    expect(conversionRate(0, 5)).toBeNull();
    const empty = buildFunnel({ total: 0, contacted: 0, thisWeek: 0, answered: 0, deals: 0 });
    expect(empty.every((band) => band.rate === null || band.rate === 0)).toBe(true);
  });

  it("garde une largeur visible à la bande vide — c'est celle qu'il faut voir", () => {
    const bands = buildFunnel(data);
    expect(bands[4]?.value).toBe(0);
    expect(bands[4]?.share).toBeGreaterThan(0);
  });

  it("chaque bande mène quelque part", () => {
    for (const band of buildFunnel(data)) {
      expect(band.href, band.key).toMatch(/^\/(contacts|affaires)\?/);
    }
  });

  it("nomme la fuite du haut de l'entonnoir", () => {
    expect(neverApproached(data)).toBe(62);
    // Jamais négatif, même si les deux comptes se croisent au fil d'un import.
    expect(neverApproached({ ...data, contacted: 200 })).toBe(0);
  });
});

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

describe("comparaison des indicateurs", () => {
  it("dit le sens, pas le signe", () => {
    expect(describeDelta(31, 19, "semaine dernière")?.text).toBe("+12 vs semaine dernière");
    expect(describeDelta(31, 19, "semaine dernière")?.tone).toBe("good");
    // Le même « + » sur une mesure qu'on veut voir baisser est une mauvaise
    // nouvelle : la couleur suit l'intention, jamais l'arithmétique.
    expect(describeDelta(31, 19, "semaine dernière", false)?.tone).toBe("bad");
  });

  it("ne compare rien quand il n'y a rien à comparer", () => {
    expect(describeDelta(31, null, "semaine dernière")).toBeNull();
  });

  it("nomme la stabilité plutôt que d'afficher « +0 »", () => {
    const flat = describeDelta(7, 7, "semaine dernière");
    expect(flat?.tone).toBe("flat");
    expect(flat?.text).toBe("stable vs semaine dernière");
  });
});
