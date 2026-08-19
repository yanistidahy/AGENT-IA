import { describe, expect, it } from "vitest";
import {
  consistency,
  dailyStacks,
  delta,
  inPeriod,
  isWorkingDay,
  periodDays,
  previousPeriod,
  resolvePeriod,
  targetProgress,
  type ActivityLike,
} from "../performance";

/**
 * **« Ma performance » mesure la personne, pas le contact.**
 *
 * Ces tests fixent les trois décisions qui portent l'écran : la comparaison à
 * une période précédente honnête, la régularité comptée en jours ouvrés, et le
 * refus d'un « 4 sur 0 » quand aucun objectif n'est réglé.
 */

/** Un mardi après-midi. */
const NOW = new Date(2026, 7, 18, 15);

function activity(date: Date, type: ActivityLike["type"] = "call"): ActivityLike {
  return { date, type, outcome: null, owner: "Yanis" };
}

describe("les périodes", () => {
  it("« cette semaine » commence le lundi et inclut la journée en cours", () => {
    const period = resolvePeriod("semaine", NOW);
    expect(period.from.getTime()).toBe(new Date(2026, 7, 17).getTime());
    expect(inPeriod(NOW, period)).toBe(true);
    expect(periodDays(period, NOW)).toBe(2); // lundi et mardi
  });

  it("« aujourd'hui » couvre exactement une journée", () => {
    const period = resolvePeriod("jour", NOW);
    expect(periodDays(period, NOW)).toBe(1);
    expect(inPeriod(new Date(2026, 7, 18, 23, 59), period)).toBe(true);
    expect(inPeriod(new Date(2026, 7, 17, 23, 59), period)).toBe(false);
  });

  it("« 90 jours » est la seule fenêtre glissante", () => {
    const period = resolvePeriod("90j", NOW);
    expect(periodDays(period, NOW)).toBe(90);
  });

  it("une période libre invalide retombe sur la semaine plutôt que d'échouer", () => {
    // Un lien vieilli doit ouvrir l'écran, pas une page d'erreur.
    const period = resolvePeriod("libre", NOW, {
      from: new Date(2026, 7, 20),
      to: new Date(2026, 7, 10),
    });
    expect(period.kind).toBe("semaine");
  });

  it("une période libre couvre ses deux bornes", () => {
    const period = resolvePeriod("libre", NOW, {
      from: new Date(2026, 7, 3),
      to: new Date(2026, 7, 7),
    });
    expect(inPeriod(new Date(2026, 7, 3, 8), period)).toBe(true);
    expect(inPeriod(new Date(2026, 7, 7, 23), period)).toBe(true);
    expect(inPeriod(new Date(2026, 7, 8, 0, 1), period)).toBe(false);
  });
});

describe("la période de comparaison", () => {
  it("**une semaine entamée se compare à la semaine pleine d'avant**", () => {
    // Comparer deux jours de semaine à sept jours pleins ferait de chaque
    // lundi un effondrement — la légende de l'écran le dit.
    const previous = previousPeriod(resolvePeriod("semaine", NOW), NOW);
    expect(previous.from.getTime()).toBe(new Date(2026, 7, 10).getTime());
    expect(previous.to.getTime()).toBe(new Date(2026, 7, 17).getTime());
  });

  it("un mois se compare au mois calendaire précédent", () => {
    const previous = previousPeriod(resolvePeriod("mois", NOW), NOW);
    expect(previous.from.getTime()).toBe(new Date(2026, 6, 1).getTime());
    expect(previous.to.getTime()).toBe(new Date(2026, 7, 1).getTime());
  });

  it("une fenêtre glissante se compare à la fenêtre de même longueur qui la précède", () => {
    const period = resolvePeriod("90j", NOW);
    const previous = previousPeriod(period, NOW);
    expect(previous.to.getTime()).toBe(period.from.getTime());
    expect(periodDays(previous, new Date(2026, 7, 16))).toBeGreaterThan(0);
  });

  it("delta() donne la direction, jamais un pourcentage inventé", () => {
    expect(delta(23, 15)).toMatchObject({ diff: 8, direction: "up" });
    expect(delta(3, 9)).toMatchObject({ diff: -6, direction: "down" });
    expect(delta(4, 4).direction).toBe("flat");
  });
});

describe("l'activité par jour", () => {
  it("garde les jours vides à zéro — ce sont eux qu'on veut voir", () => {
    const period = resolvePeriod("libre", NOW, {
      from: new Date(2026, 7, 10),
      to: new Date(2026, 7, 14),
    });
    const stacks = dailyStacks(
      [activity(new Date(2026, 7, 10, 9)), activity(new Date(2026, 7, 12, 9), "email")],
      period,
      NOW,
    );
    expect(stacks).toHaveLength(5);
    expect(stacks.map((stack) => stack.total)).toEqual([1, 0, 1, 0, 0]);
    expect(stacks[2]?.counts.email).toBe(1);
  });

  it("empile tous les canaux, LinkedIn compris", () => {
    const day = new Date(2026, 7, 17, 10);
    const stacks = dailyStacks(
      [activity(day, "call"), activity(day, "linkedin"), activity(day, "note")],
      resolvePeriod("semaine", NOW),
      NOW,
    );
    expect(stacks[0]?.counts).toMatchObject({ call: 1, linkedin: 1, note: 1, email: 0 });
    expect(stacks[0]?.total).toBe(3);
  });
});

describe("la régularité", () => {
  // Deux semaines pleines : du lundi 3 août au vendredi 14 — 10 jours ouvrés.
  const period = resolvePeriod("libre", NOW, {
    from: new Date(2026, 7, 3),
    to: new Date(2026, 7, 14),
  });

  it("compte en jours ouvrés, pas en jours calendaires", () => {
    expect(isWorkingDay(new Date(2026, 7, 8))).toBe(false); // samedi
    expect(isWorkingDay(new Date(2026, 7, 10))).toBe(true); // lundi
    const result = consistency([], period, NOW);
    expect(result.workingDays).toBe(10);
    expect(result.activeDays).toBe(0);
  });

  it("un samedi travaillé ne compte pas comme jour actif", () => {
    // Le compter ferait « 11 actifs sur 10 ouvrés », un ratio qui ne veut
    // plus rien dire.
    const result = consistency([new Date(2026, 7, 8, 10)], period, NOW);
    expect(result.activeDays).toBe(0);
  });

  it("**le week-end ne casse pas une série**", () => {
    // Actif jeudi 6, vendredi 7, lundi 10 : trois jours ouvrés consécutifs.
    const dates = [new Date(2026, 7, 6, 9), new Date(2026, 7, 7, 9), new Date(2026, 7, 10, 9)];
    expect(consistency(dates, period, NOW).longestStreak).toBe(3);
  });

  it("un jour ouvré vide la casse", () => {
    const dates = [new Date(2026, 7, 6, 9), new Date(2026, 7, 10, 9)]; // vendredi 7 manque
    expect(consistency(dates, period, NOW).longestStreak).toBe(1);
  });

  it("la journée en cours sans activité ne casse pas la série en cours", () => {
    // Il est 15 h : la journée n'est pas finie. Une série qui tomberait à
    // zéro chaque matin ne mesurerait que l'heure de la lecture.
    const week = resolvePeriod("semaine", NOW); // lundi 17, mardi 18 (aujourd'hui)
    const active = consistency([new Date(2026, 7, 17, 9)], week, NOW);
    expect(active.currentStreak).toBe(1);
    // Et une activité aujourd'hui la prolonge bien.
    const both = consistency([new Date(2026, 7, 17, 9), new Date(2026, 7, 18, 9)], week, NOW);
    expect(both.currentStreak).toBe(2);
  });
});

describe("l'objectif hebdomadaire", () => {
  it("sans objectif réglé, aucune progression — jamais « 4 sur 0 »", () => {
    expect(targetProgress(4, 0)).toBeNull();
  });

  it("borne la part à 1 : dépassé veut dire atteint", () => {
    expect(targetProgress(26, 20)).toMatchObject({ done: 26, target: 20, share: 1 });
    expect(targetProgress(5, 20)?.share).toBe(0.25);
  });
});
