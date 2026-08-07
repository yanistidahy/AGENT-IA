import { describe, expect, it } from "vitest";
import {
  closeDatePassedAlerts,
  coldDealAlerts,
  contactReminderAlerts,
  getAlerts,
  postWinCheckinAlerts,
  staleDealAlerts,
  taskOverdueAlerts,
} from "../alerts";
import {
  NOW,
  SETTINGS,
  STAGES,
  daysAgo,
  inDays,
  makeContact,
  makeDeal,
  makeTask,
} from "./fixtures";

describe("1 — tâches en retard", () => {
  it("ne retient que les tâches non terminées dont l'échéance est passée", () => {
    const tasks = [
      makeTask({ id: "retard", due: daysAgo(3) }),
      makeTask({ id: "aujourdhui", due: NOW }),
      makeTask({ id: "future", due: inDays(2) }),
      makeTask({ id: "faite", due: daysAgo(9), done: true }),
    ];
    const alerts = taskOverdueAlerts(tasks, NOW);
    expect(alerts.map((a) => a.targetId)).toEqual(["retard"]);
    expect(alerts[0]?.title).toBe("Tâche en retard de 3 j");
    expect(alerts[0]?.level).toBe("hi");
  });
});

describe("2 et 3 — affaires froides et tièdes", () => {
  const deals = [
    makeDeal({ id: "active", lastActivityAt: daysAgo(2) }),
    makeDeal({ id: "tiède", lastActivityAt: daysAgo(9) }),
    makeDeal({ id: "froide", lastActivityAt: daysAgo(20) }),
    makeDeal({ id: "gagnée", status: "won", lastActivityAt: daysAgo(20) }),
  ];

  it("classe les affaires froides en priorité haute", () => {
    const alerts = coldDealAlerts(deals, STAGES, SETTINGS, NOW);
    expect(alerts.map((a) => a.targetId)).toEqual(["froide"]);
    expect(alerts[0]?.level).toBe("hi");
    expect(alerts[0]?.detail).toContain("Proposition envoyée");
  });

  it("classe les affaires tièdes en priorité moyenne", () => {
    const alerts = staleDealAlerts(deals, STAGES, SETTINGS, NOW);
    expect(alerts.map((a) => a.targetId)).toEqual(["tiède"]);
    expect(alerts[0]?.level).toBe("md");
  });

  it("n'émet jamais les deux alertes pour la même affaire", () => {
    const froide = [makeDeal({ id: "x", lastActivityAt: daysAgo(20) })];
    expect(coldDealAlerts(froide, STAGES, SETTINGS, NOW)).toHaveLength(1);
    expect(staleDealAlerts(froide, STAGES, SETTINGS, NOW)).toHaveLength(0);
  });
});

describe("4 — clôture prévue dépassée", () => {
  it("signale les affaires en cours dont la date est passée", () => {
    const deals = [
      makeDeal({ id: "dépassée", expectedClose: daysAgo(5) }),
      makeDeal({ id: "à venir", expectedClose: inDays(5) }),
      makeDeal({ id: "gagnée", status: "won", expectedClose: daysAgo(5) }),
    ];
    const alerts = closeDatePassedAlerts(deals, NOW);
    expect(alerts.map((a) => a.targetId)).toEqual(["dépassée"]);
  });

  it("ignore les affaires sans date de clôture", () => {
    const deals = [makeDeal({ id: "sans-date", expectedClose: null })];
    expect(closeDatePassedAlerts(deals, NOW)).toHaveLength(0);
  });
});

describe("5 — rappels de contact", () => {
  it("déclenche le jour même et les jours suivants", () => {
    const contacts = [
      makeContact({ id: "dû", nextReminder: daysAgo(2) }),
      makeContact({ id: "aujourdhui", nextReminder: NOW }),
      makeContact({ id: "futur", nextReminder: inDays(3) }),
      makeContact({ id: "aucun", nextReminder: null }),
    ];
    const ids = contactReminderAlerts(contacts, NOW).map((a) => a.targetId);
    expect(ids).toEqual(["dû", "aujourdhui"]);
  });
});

describe("6 — check-in 30 jours après un gain", () => {
  it("s'ouvre à 30 jours et se referme à 40", () => {
    const deals = [
      makeDeal({ id: "j29", status: "won", closedAt: daysAgo(29) }),
      makeDeal({ id: "j30", status: "won", closedAt: daysAgo(30) }),
      makeDeal({ id: "j39", status: "won", closedAt: daysAgo(39) }),
      makeDeal({ id: "j40", status: "won", closedAt: daysAgo(40) }),
      makeDeal({ id: "perdue", status: "lost", closedAt: daysAgo(32) }),
    ];
    expect(postWinCheckinAlerts(deals, NOW).map((a) => a.targetId)).toEqual(["j30", "j39"]);
  });
});

describe("getAlerts", () => {
  it("trie par urgence : hi, puis md, puis low", () => {
    const alerts = getAlerts({
      tasks: [makeTask({ id: "t", due: daysAgo(1) })],
      deals: [
        makeDeal({ id: "froide", lastActivityAt: daysAgo(20), expectedClose: inDays(5) }),
        makeDeal({ id: "gagnée", status: "won", closedAt: daysAgo(31) }),
      ],
      stages: STAGES,
      contacts: [makeContact({ id: "c", nextReminder: daysAgo(1) })],
      settings: SETTINGS,
      now: NOW,
    });

    expect(alerts.map((a) => a.level)).toEqual(["hi", "hi", "md", "low"]);
  });

  it("ne renvoie rien quand tout est à jour", () => {
    const alerts = getAlerts({
      tasks: [makeTask({ due: inDays(3) })],
      deals: [makeDeal({ lastActivityAt: daysAgo(1), expectedClose: inDays(20) })],
      stages: STAGES,
      contacts: [makeContact({ nextReminder: null })],
      settings: SETTINGS,
      now: NOW,
    });
    expect(alerts).toHaveLength(0);
  });

  it("émet clôture dépassée et affaire froide pour une même affaire", () => {
    const alerts = getAlerts({
      tasks: [],
      deals: [makeDeal({ id: "x", lastActivityAt: daysAgo(20), expectedClose: daysAgo(3) })],
      stages: STAGES,
      contacts: [],
      settings: SETTINGS,
      now: NOW,
    });
    expect(alerts.map((a) => a.kind)).toEqual(["deal-cold", "close-date-passed"]);
  });
});
