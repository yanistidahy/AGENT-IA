import { describe, expect, it } from "vitest";
import {
  DEAL_LOST_REASONS,
  canReopen,
  planLoss,
  planReopen,
} from "../deal-loss";
import { DO_NOT_CONTACT, LOST_REASONS } from "../lost";

const NOW = new Date("2026-08-27T10:00:00Z");

describe("les motifs de perte d'une affaire", () => {
  it("reprennent le vocabulaire de la fiche contact", () => {
    for (const reason of LOST_REASONS) {
      if (reason === DO_NOT_CONTACT) continue;
      expect(DEAL_LOST_REASONS).toContain(reason);
    }
  });

  it("**excluent l'opposition au démarchage**", () => {
    // Le porter ici l'afficherait sans le respecter : `optedOut()` lit
    // `Contact.lostReason`, jamais l'affaire. Les séquences continueraient
    // d'écrire à quelqu'un que l'écran dit opposé.
    expect(DEAL_LOST_REASONS).not.toContain(DO_NOT_CONTACT);
  });

  it("ne perdent aucun autre motif en route", () => {
    expect(DEAL_LOST_REASONS).toHaveLength(LOST_REASONS.length - 1);
  });
});

describe("planLoss", () => {
  it("clôt l'affaire en portant le motif dans la note", () => {
    expect(planLoss("Budget", NOW)).toEqual({
      status: "lost",
      closedAt: NOW,
      lastActivityAt: NOW,
      lostReason: "Budget",
      note: "Affaire marquée perdue — motif : Budget",
    });
  });

  it("accepte un motif libre, espaces de bord retirés", () => {
    const plan = planLoss("  parti chez un intégrateur  ", NOW);
    expect(plan.lostReason).toBe("parti chez un intégrateur");
    expect(plan.note).toContain("parti chez un intégrateur");
  });

  it("accepte l'absence de motif sans écrire un tiret ni « undefined »", () => {
    const plan = planLoss("   ", NOW);
    expect(plan.lostReason).toBe("");
    expect(plan.note).toBe("Affaire marquée perdue");
  });

  it("ne rend aucune étape : perdre fait sortir, pas avancer", () => {
    // C'est ce qui rend la réouverture exacte sans colonne « étape d'avant ».
    expect(planLoss("Budget", NOW)).not.toHaveProperty("stageId");
  });
});

describe("planReopen", () => {
  it("efface le motif de la colonne et le garde dans la note", () => {
    const plan = planReopen("Concurrent", NOW);
    expect(plan.status).toBe("open");
    expect(plan.closedAt).toBeNull();
    expect(plan.lostReason).toBe("");
    expect(plan.note).toBe("Affaire rouverte (était perdue — motif : Concurrent)");
  });

  it("reste lisible quand l'affaire n'avait pas de motif", () => {
    expect(planReopen("", NOW).note).toBe("Affaire rouverte");
  });
});

describe("canReopen", () => {
  it("vaut pour une affaire close, dans les deux sens", () => {
    expect(canReopen("lost")).toBe(true);
    expect(canReopen("won")).toBe(true);
  });

  it("ne vaut pas pour une affaire en cours", () => {
    expect(canReopen("open")).toBe(false);
  });
});
