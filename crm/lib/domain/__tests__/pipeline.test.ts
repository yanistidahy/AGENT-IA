import { describe, expect, it } from "vitest";
import {
  averageDealSize,
  dealHeat,
  dealProb,
  openDeals,
  pipelineValue,
  resolveStage,
  stuckDeals,
  weighted,
  weightedValue,
} from "../pipeline";
import { NOW, SETTINGS, STAGES, daysAgo, makeDeal } from "./fixtures";

describe("dealProb", () => {
  it("retient la probabilité de l'étape quand l'affaire n'en porte pas", () => {
    const deal = makeDeal({ stageId: "s4", prob: null });
    expect(dealProb(deal, resolveStage(STAGES, "s4"))).toBe(65);
  });

  it("laisse la probabilité de l'affaire surcharger celle de l'étape", () => {
    const deal = makeDeal({ stageId: "s4", prob: 20 });
    expect(dealProb(deal, resolveStage(STAGES, "s4"))).toBe(20);
  });

  it("accepte une surcharge à 0 sans retomber sur l'étape", () => {
    const deal = makeDeal({ stageId: "s5", prob: 0 });
    expect(dealProb(deal, resolveStage(STAGES, "s5"))).toBe(0);
  });

  it("renvoie 0 quand l'étape référencée n'existe plus", () => {
    const deal = makeDeal({ stageId: "supprimée", prob: null });
    expect(dealProb(deal, resolveStage(STAGES, "supprimée"))).toBe(0);
  });
});

describe("weightedValue", () => {
  it("applique montant × probabilité / 100", () => {
    const deal = makeDeal({ amount: 6480, stageId: "s4", prob: null });
    expect(weightedValue(deal, resolveStage(STAGES, "s4"))).toBeCloseTo(4212);
  });
});

describe("pipelineValue et weighted", () => {
  const deals = [
    makeDeal({ id: "a", amount: 10000, stageId: "s2", status: "open" }),
    makeDeal({ id: "b", amount: 20000, stageId: "s5", status: "open" }),
    makeDeal({ id: "c", amount: 99000, stageId: "s6", status: "won" }),
    makeDeal({ id: "d", amount: 50000, stageId: "s4", status: "lost" }),
  ];

  it("ne compte que les affaires en cours", () => {
    expect(openDeals(deals)).toHaveLength(2);
    expect(pipelineValue(deals)).toBe(30000);
  });

  it("pondère chaque affaire par la probabilité de son étape", () => {
    // 10 000 × 25 % + 20 000 × 85 % = 2 500 + 17 000
    expect(weighted(deals, STAGES)).toBe(19500);
  });

  it("renvoie 0 sur un pipeline vide", () => {
    expect(pipelineValue([])).toBe(0);
    expect(weighted([], STAGES)).toBe(0);
  });
});

describe("dealHeat", () => {
  it("est active en deçà du seuil tiède", () => {
    expect(dealHeat(makeDeal({ lastActivityAt: daysAgo(6) }), SETTINGS, NOW)).toBe("hot");
  });

  it("bascule tiède pile au seuil staleDays", () => {
    expect(dealHeat(makeDeal({ lastActivityAt: daysAgo(7) }), SETTINGS, NOW)).toBe("warm");
  });

  it("reste tiède juste avant le seuil froid", () => {
    expect(dealHeat(makeDeal({ lastActivityAt: daysAgo(13) }), SETTINGS, NOW)).toBe("warm");
  });

  it("bascule froide pile au seuil coldDays", () => {
    expect(dealHeat(makeDeal({ lastActivityAt: daysAgo(14) }), SETTINGS, NOW)).toBe("cold");
  });

  it("retombe sur la date de création quand il n'y a aucune activité", () => {
    const deal = makeDeal({ lastActivityAt: null, createdAt: daysAgo(30) });
    expect(dealHeat(deal, SETTINGS, NOW)).toBe("cold");
  });

  it("suit les seuils configurés, pas des constantes en dur", () => {
    const large = { staleDays: 30, coldDays: 60, objectifMensuel: 15000 };
    expect(dealHeat(makeDeal({ lastActivityAt: daysAgo(20) }), large, NOW)).toBe("hot");
  });
});

describe("stuckDeals", () => {
  it("écarte les affaires actives et les affaires clôturées, et trie par montant", () => {
    const deals = [
      makeDeal({ id: "active", amount: 90000, lastActivityAt: daysAgo(1) }),
      makeDeal({ id: "tiède", amount: 5000, lastActivityAt: daysAgo(8) }),
      makeDeal({ id: "froide", amount: 40000, lastActivityAt: daysAgo(30) }),
      makeDeal({ id: "gagnée", amount: 80000, status: "won", lastActivityAt: daysAgo(30) }),
    ];
    expect(stuckDeals(deals, SETTINGS, NOW).map((d) => d.id)).toEqual(["froide", "tiède"]);
  });
});

describe("averageDealSize", () => {
  it("renvoie 0 sans affaire plutôt que NaN", () => {
    expect(averageDealSize([])).toBe(0);
  });

  it("moyenne les montants", () => {
    const deals = [makeDeal({ amount: 1000 }), makeDeal({ amount: 3000 })];
    expect(averageDealSize(deals)).toBe(2000);
  });
});
