import { describe, expect, it } from "vitest";
import { lastMonthKeys, monthKey } from "../dates";
import {
  averageWonDeal,
  conversionRate,
  cycle,
  forecast,
  funnel,
  lostDeals,
  retention,
  revenue,
  revenueByMonth,
  winRate,
  wonDeals,
} from "../kpis";
import { NOW, STAGES, daysAgo, inDays, makeContact, makeDeal } from "./fixtures";

describe("wonDeals / lostDeals et la fenêtre de période", () => {
  const deals = [
    makeDeal({ id: "récente", status: "won", closedAt: daysAgo(10) }),
    makeDeal({ id: "ancienne", status: "won", closedAt: daysAgo(200) }),
    makeDeal({ id: "perdue", status: "lost", closedAt: daysAgo(10) }),
    makeDeal({ id: "ouverte", status: "open", closedAt: null }),
  ];

  it("filtre sur la fenêtre demandée", () => {
    expect(wonDeals(deals, 90, NOW).map((d) => d.id)).toEqual(["récente"]);
  });

  it("prend tout l'historique quand la période est nulle", () => {
    expect(wonDeals(deals, null, NOW).map((d) => d.id)).toEqual(["récente", "ancienne"]);
  });

  it("sépare gagnées et perdues", () => {
    expect(lostDeals(deals, 90, NOW).map((d) => d.id)).toEqual(["perdue"]);
  });
});

describe("winRate", () => {
  it("calcule gagnées / (gagnées + perdues)", () => {
    const won = [makeDeal(), makeDeal(), makeDeal()];
    const lost = [makeDeal()];
    expect(winRate(won, lost)).toBe(75);
  });

  it("renvoie 0 quand rien n'est clôturé, sans division par zéro", () => {
    expect(winRate([], [])).toBe(0);
  });

  it("renvoie 100 quand rien n'est perdu", () => {
    expect(winRate([makeDeal()], [])).toBe(100);
  });
});

describe("cycle", () => {
  it("moyenne les durées création → signature", () => {
    const won = [
      makeDeal({ createdAt: daysAgo(90), closedAt: daysAgo(60) }),
      makeDeal({ createdAt: daysAgo(50), closedAt: daysAgo(40) }),
    ];
    expect(cycle(won)).toBe(20);
  });

  it("renvoie 0 sans affaire gagnée", () => {
    expect(cycle([])).toBe(0);
  });

  it("ignore les affaires sans date de clôture", () => {
    const won = [
      makeDeal({ createdAt: daysAgo(40), closedAt: daysAgo(20) }),
      makeDeal({ createdAt: daysAgo(40), closedAt: null }),
    ];
    expect(cycle(won)).toBe(20);
  });
});

describe("revenue et panier moyen", () => {
  it("somme les montants", () => {
    expect(revenue([makeDeal({ amount: 6480 }), makeDeal({ amount: 3480 })])).toBe(9960);
  });

  it("renvoie 0 sans affaire gagnée plutôt que NaN", () => {
    expect(averageWonDeal([])).toBe(0);
  });

  it("moyenne les affaires gagnées", () => {
    expect(averageWonDeal([makeDeal({ amount: 6480 }), makeDeal({ amount: 3480 })])).toBe(4980);
  });
});

describe("funnel", () => {
  const deals = [
    makeDeal({ id: "d1", stageId: "s1", amount: 1000 }),
    makeDeal({ id: "d2", stageId: "s3", amount: 2000 }),
    makeDeal({ id: "d3", stageId: "s5", amount: 4000 }),
    makeDeal({ id: "d4", stageId: "s6", amount: 8000, status: "won", closedAt: daysAgo(5) }),
  ];

  it("compte les affaires ayant atteint chaque étape", () => {
    expect(funnel(deals, STAGES).map((row) => row.count)).toEqual([4, 3, 3, 2, 2, 1]);
  });

  it("calcule le taux de passage depuis l'étape précédente", () => {
    const rates = funnel(deals, STAGES).map((row) => row.rate);
    expect(rates).toEqual([null, 75, 100, 67, 100, 50]);
  });

  it("cumule les montants atteints", () => {
    const first = funnel(deals, STAGES)[0];
    expect(first?.amount).toBe(15000);
  });

  it("respecte l'ordre des positions, pas l'ordre du tableau", () => {
    const shuffled = [...STAGES].reverse();
    expect(funnel(deals, shuffled).map((row) => row.label)).toEqual(
      STAGES.map((stage) => stage.name),
    );
  });

  it("ne casse pas sur un pipeline vide", () => {
    expect(funnel([], STAGES).every((row) => row.count === 0)).toBe(true);
  });
});

describe("forecast", () => {
  it("pondère les affaires en cours par mois de clôture prévue", () => {
    const month = monthKey(inDays(10));
    const deals = [
      makeDeal({ id: "a", amount: 10000, stageId: "s5", expectedClose: inDays(10) }),
      makeDeal({ id: "b", amount: 10000, stageId: "s2", expectedClose: inDays(10) }),
    ];
    // 10 000 × 85 % + 10 000 × 25 % = 8 500 + 2 500
    expect(forecast(deals, STAGES, [month])).toEqual([{ month, value: 11000 }]);
  });

  it("exclut les affaires clôturées : une affaire gagnée est du CA, pas une prévision", () => {
    const month = monthKey(inDays(10));
    const deals = [
      makeDeal({ amount: 10000, stageId: "s5", status: "won", expectedClose: inDays(10) }),
    ];
    expect(forecast(deals, STAGES, [month])).toEqual([{ month, value: 0 }]);
  });

  it("ignore les affaires sans date de clôture prévue", () => {
    const month = monthKey(NOW);
    const deals = [makeDeal({ amount: 10000, stageId: "s5", expectedClose: null })];
    expect(forecast(deals, STAGES, [month])).toEqual([{ month, value: 0 }]);
  });
});

describe("revenueByMonth", () => {
  it("ventile le CA signé sur les mois demandés", () => {
    const months = lastMonthKeys(NOW, 3);
    const deals = [
      makeDeal({ amount: 5000, status: "won", closedAt: NOW }),
      makeDeal({ amount: 3000, status: "open", closedAt: null }),
    ];
    const points = revenueByMonth(deals, months);
    expect(points).toHaveLength(3);
    expect(points[2]).toEqual({ month: monthKey(NOW), value: 5000 });
  });
});

describe("conversionRate", () => {
  it("mesure la part des contacts sortis du statut Lead", () => {
    const contacts = [
      makeContact({ lifecycle: "Lead", createdAt: daysAgo(5) }),
      makeContact({ lifecycle: "Prospect", createdAt: daysAgo(5) }),
      makeContact({ lifecycle: "Client", createdAt: daysAgo(5) }),
      makeContact({ lifecycle: "Lead", createdAt: daysAgo(5) }),
    ];
    expect(conversionRate(contacts, 90, NOW)).toBe(50);
  });

  it("renvoie 0 sans contact sur la période", () => {
    expect(conversionRate([], 90, NOW)).toBe(0);
  });
});

describe("retention", () => {
  it("rapporte les clients actifs au total actifs + anciens", () => {
    const contacts = [
      makeContact({ lifecycle: "Client" }),
      makeContact({ lifecycle: "Client" }),
      makeContact({ lifecycle: "Client" }),
      makeContact({ lifecycle: "Ancien Client" }),
      makeContact({ lifecycle: "Lead" }),
    ];
    expect(retention(contacts)).toBe(75);
  });

  it("renvoie 100 % quand aucun client n'est encore parti", () => {
    expect(retention([makeContact({ lifecycle: "Lead" })])).toBe(100);
  });
});
