import { describe, expect, it } from "vitest";
import {
  firstTouchDelay,
  median,
  poolAging,
  qualificationBySource,
  reminderDiscipline,
  responseByChannel,
  weeklyRhythm,
  weekStart,
} from "../prospecting";
import { noShowRate, stageFlow, velocityDays } from "../sales-flow";
import {
  draftFromContact,
  entersQualified,
  outcomeQualifies,
  validAmount,
} from "../qualification";
import type { StageLike } from "../types";

const MONDAY = new Date(2026, 7, 10); // lundi 10 août 2026

describe("semaines", () => {
  it("commencent le lundi, dimanche compris", () => {
    expect(weekStart(new Date(2026, 7, 10)).getDate()).toBe(10);
    expect(weekStart(new Date(2026, 7, 14)).getDate()).toBe(10);
    // Dimanche appartient à la semaine qui vient de s'écouler, pas à la
    // suivante : `getDay()` rend 0 et le naïf le ferait basculer d'une semaine.
    expect(weekStart(new Date(2026, 7, 16)).getDate()).toBe(10);
    expect(weekStart(new Date(2026, 7, 17)).getDate()).toBe(17);
  });
});

describe("rythme", () => {
  const activities = [
    { date: new Date(2026, 7, 11), type: "call" as const, outcome: "no-answer" },
    { date: new Date(2026, 7, 12), type: "call" as const, outcome: "interested" },
    { date: new Date(2026, 7, 12), type: "email" as const, outcome: "" },
    { date: new Date(2026, 6, 28), type: "email" as const, outcome: "" },
  ];

  it("rend une case par semaine, la plus ancienne d'abord", () => {
    const weeks = weeklyRhythm(activities, 4, MONDAY);
    expect(weeks).toHaveLength(4);
    expect(weeks[3]?.total).toBe(3);
  });

  /**
   * Une semaine sans prospection est une information, pas une absence de
   * donnée : l'omettre ferait un trou dans la courbe au lieu d'un creux.
   */
  it("garde les semaines vides à zéro", () => {
    const weeks = weeklyRhythm(activities, 4, MONDAY);
    expect(weeks.filter((week) => week.total === 0).length).toBeGreaterThan(0);
  });

  it("ventile par type", () => {
    const weeks = weeklyRhythm(activities, 4, MONDAY);
    expect(weeks[3]?.byType.call).toBe(2);
    expect(weeks[3]?.byType.email).toBe(1);
  });
});

describe("taux de réponse par canal", () => {
  const activities = [
    { date: MONDAY, type: "call" as const, outcome: "interested" },
    { date: MONDAY, type: "call" as const, outcome: "no-answer" },
    { date: MONDAY, type: "email" as const, outcome: "" },
    { date: MONDAY, type: "email" as const, outcome: "" },
    { date: MONDAY, type: "email" as const, outcome: "no-answer" },
  ];

  it("ne compte que les échanges dont l'issue est connue", () => {
    const rows = responseByChannel(activities);
    const call = rows.find((row) => row.channel === "call");
    expect(call?.known).toBe(2);
    expect(call?.rate).toBe(50);
  });

  /**
   * Le point qui compte : trois emails dont deux sans issue renseignée ne font
   * pas 33 % de réponse. Le dénominateur est ce qu'on sait, pas ce qu'on a fait.
   */
  it("ne prend pas une saisie manquante pour un échec", () => {
    const email = responseByChannel(activities).find((row) => row.channel === "email");
    expect(email?.total).toBe(3);
    expect(email?.known).toBe(1);
    expect(email?.rate).toBe(0);
  });

  it("rend null quand aucune issue n'est renseignée", () => {
    const rows = responseByChannel([
      { date: MONDAY, type: "meeting" as const, outcome: "" },
    ]);
    expect(rows[0]?.rate).toBeNull();
  });
});

describe("délai avant premier contact", () => {
  it("prend la médiane, pas la moyenne", () => {
    const rows = [
      { createdAt: new Date(2026, 7, 1), firstActivityAt: new Date(2026, 7, 2) },
      { createdAt: new Date(2026, 7, 1), firstActivityAt: new Date(2026, 7, 3) },
      { createdAt: new Date(2026, 0, 1), firstActivityAt: new Date(2026, 7, 1) },
    ];
    // Moyenne ≈ 71 j, médiane 2 j : la médiane décrit ce qui se passe
    // d'habitude, la moyenne décrit la seule fiche oubliée.
    expect(firstTouchDelay(rows, MONDAY).medianDays).toBe(2);
  });

  it("compte l'arriéré à part, avec son ancienneté", () => {
    const result = firstTouchDelay(
      [
        { createdAt: new Date(2026, 7, 1), firstActivityAt: null },
        { createdAt: new Date(2026, 5, 1), firstActivityAt: null },
      ],
      MONDAY,
    );
    expect(result.untouched).toBe(2);
    expect(result.medianDays).toBeNull();
    expect(result.untouchedMedianAgeDays).not.toBeNull();
  });
});

describe("discipline de relance", () => {
  it("ne compte comme tenue qu'une relance terminée à temps", () => {
    const weeks = reminderDiscipline(
      [
        { due: new Date(2026, 7, 11), done: true, doneAt: new Date(2026, 7, 11) },
        { due: new Date(2026, 7, 12), done: true, doneAt: new Date(2026, 7, 14) },
        { due: new Date(2026, 7, 3), done: false, doneAt: null },
      ],
      2,
      new Date(2026, 7, 14),
    );
    const total = weeks.reduce(
      (sum, week) => ({ h: sum.h + week.honoured, m: sum.m + week.missed }),
      { h: 0, m: 0 },
    );
    expect(total.h).toBe(1);
    expect(total.m).toBe(2);
  });

  it("ne juge pas une relance encore à venir", () => {
    const weeks = reminderDiscipline(
      [{ due: new Date(2026, 7, 14), done: false, doneAt: null }],
      1,
      new Date(2026, 7, 11),
    );
    expect(weeks[0]?.honoured).toBe(0);
    expect(weeks[0]?.missed).toBe(0);
  });
});

describe("vieillissement du vivier", () => {
  it("répartit sans perdre personne", () => {
    const brackets = poolAging([1, 8, 40, 100, 400, 400]);
    expect(brackets.reduce((sum, bracket) => sum + bracket.count, 0)).toBe(6);
    expect(brackets[4]?.count).toBe(2);
  });
});

describe("qualification par source", () => {
  it("classe par nombre de qualifiés puis par volume", () => {
    const rows = qualificationBySource([
      { source: "Salon", qualified: true },
      { source: "Salon", qualified: false },
      { source: "LinkedIn", qualified: false },
      { source: "", qualified: false },
    ]);
    expect(rows[0]?.source).toBe("Salon");
    expect(rows[0]?.rate).toBe(50);
    expect(rows.find((row) => row.source === "(sans source)")?.rate).toBe(0);
  });
});

describe("médiane", () => {
  it("rend null sur une liste vide plutôt que zéro", () => {
    expect(median([])).toBeNull();
    expect(median([4])).toBe(4);
    expect(median([1, 3])).toBe(2);
  });
});

/* ----------------------------------------------------------- parcours */

const STAGES: readonly StageLike[] = [
  { id: "s1", name: "Qualifié", color: "#000", prob: 15, position: 0 },
  { id: "s3", name: "Démo planifiée", color: "#000", prob: 30, position: 1 },
  { id: "s7", name: "Démo réalisée", color: "#000", prob: 50, position: 2 },
];

describe("parcours par étape", () => {
  const visits = [
    { dealId: "d1", stageId: "s1", enteredAt: new Date(2026, 7, 1) },
    { dealId: "d1", stageId: "s3", enteredAt: new Date(2026, 7, 5) },
    { dealId: "d1", stageId: "s7", enteredAt: new Date(2026, 7, 9) },
    { dealId: "d2", stageId: "s1", enteredAt: new Date(2026, 7, 2) },
  ];

  it("compte les entrées et les passages effectifs", () => {
    const flows = stageFlow(visits, STAGES, MONDAY);
    expect(flows[0]?.entered).toBe(2);
    expect(flows[0]?.advanced).toBe(1);
    expect(flows[0]?.conversion).toBe(50);
  });

  /**
   * Une affaire revenue en arrière est bien passée par l'étape suivante : juger
   * sur l'étape *actuelle* sous-estimerait la conversion à chaque recul.
   */
  it("retient l'étape la plus avancée atteinte, pas l'actuelle", () => {
    const back = [...visits, { dealId: "d1", stageId: "s1", enteredAt: new Date(2026, 7, 10) }];
    const flows = stageFlow(back, STAGES, MONDAY);
    expect(flows[1]?.advanced).toBe(1);
  });

  it("ne compte pas deux fois un aller-retour", () => {
    const back = [...visits, { dealId: "d1", stageId: "s1", enteredAt: new Date(2026, 7, 10) }];
    expect(stageFlow(back, STAGES, MONDAY)[0]?.entered).toBe(2);
  });

  /**
   * Le passage en cours mesurerait « depuis quand », pas « combien de temps ».
   * L'inclure tirerait toutes les durées vers le bas au fil des jours.
   */
  it("ne mesure que les passages terminés", () => {
    const flows = stageFlow(visits, STAGES, MONDAY);
    expect(flows[0]?.measured).toBe(1);
    expect(flows[0]?.medianDays).toBe(4);
    expect(flows[2]?.measured).toBe(0);
    expect(flows[2]?.medianDays).toBeNull();
  });

  it("rend null plutôt que zéro sur une étape jamais atteinte", () => {
    expect(stageFlow([], STAGES, MONDAY)[0]?.conversion).toBeNull();
  });
});

describe("taux de lapin", () => {
  it("compte ceux qui ne sont pas venus", () => {
    const flows = stageFlow(
      [
        { dealId: "d1", stageId: "s3", enteredAt: new Date(2026, 7, 1) },
        { dealId: "d2", stageId: "s3", enteredAt: new Date(2026, 7, 2) },
        { dealId: "d1", stageId: "s7", enteredAt: new Date(2026, 7, 4) },
      ],
      STAGES,
      MONDAY,
    );
    expect(noShowRate(flows, "Démo planifiée", "Démo réalisée")).toEqual({
      planned: 2,
      held: 1,
      rate: 50,
    });
  });

  it("rend null sans démo planifiée, et null si l'étape n'existe pas", () => {
    const flows = stageFlow([], STAGES, MONDAY);
    expect(noShowRate(flows, "Démo planifiée", "Démo réalisée")?.rate).toBeNull();
    expect(noShowRate(flows, "Inexistante", "Démo réalisée")).toBeNull();
  });
});

describe("vélocité", () => {
  it("ne mesure que les affaires gagnées", () => {
    const result = velocityDays([
      { createdAt: new Date(2026, 6, 1), closedAt: new Date(2026, 6, 21), status: "won" },
      { createdAt: new Date(2026, 6, 1), closedAt: new Date(2026, 6, 5), status: "lost" },
      { createdAt: new Date(2026, 6, 1), closedAt: null, status: "open" },
    ]);
    expect(result.measured).toBe(1);
    expect(result.medianDays).toBe(20);
  });
});

/* ------------------------------------------------------ qualification */

describe("qualification", () => {
  it("ne déclenche qu'à l'entrée dans Qualifié", () => {
    expect(entersQualified("Prospect", "Qualifié")).toBe(true);
    expect(entersQualified(null, "Qualifié")).toBe(true);
    // Sans cette condition, chaque enregistrement d'une fiche déjà qualifiée
    // fabriquerait une affaire de plus.
    expect(entersQualified("Qualifié", "Qualifié")).toBe(false);
    expect(entersQualified("Prospect", "Client")).toBe(false);
  });

  it("reconnaît les issues qui valent engagement", () => {
    expect(outcomeQualifies("meeting")).toBe(true);
    expect(outcomeQualifies("interested")).toBe(true);
    expect(outcomeQualifies("no-answer")).toBe(false);
    expect(outcomeQualifies("later")).toBe(false);
  });

  it("refuse un montant nul, négatif ou absent", () => {
    expect(validAmount(0)).toBe(false);
    expect(validAmount(-10)).toBe(false);
    expect(validAmount(Number.NaN)).toBe(false);
    expect(validAmount("6480")).toBe(false);
    expect(validAmount(6480)).toBe(true);
  });

  it("pré-remplit l'affaire depuis la fiche", () => {
    const draft = draftFromContact(
      {
        contactId: "c1",
        contactName: "Nadia Berger",
        companyId: "co1",
        companyName: "Nutrivia",
        owner: "Yanis",
        amount: 6480,
        offer: "Assistant IA Pro",
      },
      new Date(2026, 7, 10),
    );
    expect(draft.name).toBe("Assistant IA Pro — Nutrivia");
    expect(draft.expectedClose.getMonth()).toBe(8);
    expect(draft.contactId).toBe("c1");
  });

  it("retombe sur la personne quand il n'y a pas de société", () => {
    const draft = draftFromContact(
      {
        contactId: "c1",
        contactName: "Nadia Berger",
        companyId: null,
        companyName: null,
        owner: "Yanis",
        amount: 100,
        offer: "Pilote",
      },
      MONDAY,
    );
    expect(draft.name).toBe("Pilote — Nadia Berger");
  });
});
