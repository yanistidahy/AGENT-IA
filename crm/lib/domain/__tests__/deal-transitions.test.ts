import { describe, expect, it } from "vitest";
import { isWinStage, planClose, planStageMove } from "../deal-transitions";
import { NOW, STAGES, daysAgo, makeDeal } from "./fixtures";

function stage(id: string) {
  const found = STAGES.find((s) => s.id === id);
  if (found === undefined) throw new Error(`étape ${id} absente des fixtures`);
  return found;
}

describe("isWinStage", () => {
  it("ne reconnaît que l'étape à 100 %", () => {
    expect(isWinStage(stage("s6"))).toBe(true);
    expect(isWinStage(stage("s5"))).toBe(false);
  });
});

describe("planStageMove", () => {
  it("gagne l'affaire et date la clôture en arrivant sur l'étape à 100 %", () => {
    const deal = makeDeal({ stageId: "s5", status: "open" });
    const plan = planStageMove(deal, stage("s5"), stage("s6"), NOW);

    expect(plan.status).toBe("won");
    expect(plan.closedAt).toEqual(NOW);
    expect(plan.stageId).toBe("s6");
  });

  it("remet en cours un déplacement vers une étape intermédiaire", () => {
    const deal = makeDeal({ stageId: "s2", status: "open" });
    const plan = planStageMove(deal, stage("s2"), stage("s4"), NOW);

    expect(plan.status).toBe("open");
    expect(plan.closedAt).toBeNull();
  });

  it("efface closedAt en rouvrant une affaire gagnée", () => {
    const won = makeDeal({ stageId: "s6", status: "won", closedAt: daysAgo(10) });
    const plan = planStageMove(won, stage("s6"), stage("s5"), NOW);

    expect(plan.status).toBe("open");
    expect(plan.closedAt).toBeNull();
  });

  it("laisse une affaire perdue perdue, sans toucher à sa date de clôture", () => {
    const closedAt = daysAgo(30);
    const lost = makeDeal({ stageId: "s4", status: "lost", closedAt });
    const plan = planStageMove(lost, stage("s4"), stage("s2"), NOW);

    expect(plan.status).toBe("lost");
    expect(plan.closedAt).toEqual(closedAt);
  });

  it("gagne malgré tout une affaire perdue déplacée sur l'étape à 100 %", () => {
    const lost = makeDeal({ status: "lost", closedAt: daysAgo(30) });
    const plan = planStageMove(lost, stage("s4"), stage("s6"), NOW);

    expect(plan.status).toBe("won");
    expect(plan.closedAt).toEqual(NOW);
  });

  it("rafraîchit toujours la date de dernière activité", () => {
    const stale = makeDeal({ lastActivityAt: daysAgo(40) });
    expect(planStageMove(stale, stage("s4"), stage("s5"), NOW).lastActivityAt).toEqual(NOW);
  });

  it("consigne le libellé des deux étapes dans la note système", () => {
    const plan = planStageMove(makeDeal(), stage("s3"), stage("s4"), NOW);
    expect(plan.note).toBe("Étape modifiée : Démo planifiée → Proposition envoyée");
  });

  it("reste lisible quand l'étape d'origine a été supprimée", () => {
    const plan = planStageMove(makeDeal(), undefined, stage("s4"), NOW);
    expect(plan.note).toBe("Étape modifiée : inconnue → Proposition envoyée");
  });
});

describe("planClose", () => {
  it("date la clôture et nomme l'action", () => {
    expect(planClose("lost", NOW)).toEqual({
      status: "lost",
      closedAt: NOW,
      lastActivityAt: NOW,
      note: "Affaire marquée perdue",
    });
    expect(planClose("won", NOW).note).toBe("Affaire marquée gagnée");
  });
});
