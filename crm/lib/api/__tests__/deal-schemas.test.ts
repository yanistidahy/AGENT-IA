import { describe, expect, it } from "vitest";
import {
  createDealSchema,
  moveStageSchema,
  parseDealsQuery,
  updateDealSchema,
} from "../deal-schemas";

const VALID = {
  name: "Assistant IA — Nordik Home",
  amount: 9180,
  stageId: "s4",
  owner: "Yanis",
};

describe("createDealSchema", () => {
  it("accepte la charge utile minimale", () => {
    const result = createDealSchema.safeParse(VALID);
    expect(result.success).toBe(true);
  });

  it("refuse un nom vide ou fait uniquement d'espaces", () => {
    expect(createDealSchema.safeParse({ ...VALID, name: "" }).success).toBe(false);
    expect(createDealSchema.safeParse({ ...VALID, name: "   " }).success).toBe(false);
  });

  it("coupe les espaces autour du nom", () => {
    const result = createDealSchema.safeParse({ ...VALID, name: "  Nordik  " });
    expect(result.success && result.data.name).toBe("Nordik");
  });

  it("refuse un montant négatif ou décimal", () => {
    expect(createDealSchema.safeParse({ ...VALID, amount: -1 }).success).toBe(false);
    expect(createDealSchema.safeParse({ ...VALID, amount: 12.5 }).success).toBe(false);
  });

  it("borne la probabilité à 0–100 et accepte null", () => {
    expect(createDealSchema.safeParse({ ...VALID, prob: 101 }).success).toBe(false);
    expect(createDealSchema.safeParse({ ...VALID, prob: -5 }).success).toBe(false);
    expect(createDealSchema.safeParse({ ...VALID, prob: null }).success).toBe(true);
  });

  it("convertit une date ISO en objet Date", () => {
    const result = createDealSchema.safeParse({ ...VALID, expectedClose: "2026-09-30" });
    expect(result.success && result.data.expectedClose instanceof Date).toBe(true);
  });

  it("traite la chaîne vide comme une absence de date", () => {
    const result = createDealSchema.safeParse({ ...VALID, expectedClose: "" });
    expect(result.success && result.data.expectedClose).toBeNull();
  });

  it("refuse une date illisible plutôt que de la ramener silencieusement à null", () => {
    const result = createDealSchema.safeParse({ ...VALID, expectedClose: "pas une date" });
    expect(result.success).toBe(false);
    expect(result.success === false && result.error.issues[0]?.message).toBe("Date invalide");
  });

  it("nomme le champ fautif pour l'afficher sous la bonne entrée", () => {
    const result = createDealSchema.safeParse({ ...VALID, name: "" });
    expect(result.success === false && result.error.issues[0]?.path).toEqual(["name"]);
  });
});

describe("updateDealSchema", () => {
  it("accepte une mise à jour d'un seul champ", () => {
    expect(updateDealSchema.safeParse({ amount: 5000 }).success).toBe(true);
  });

  it("refuse une charge utile vide", () => {
    expect(updateDealSchema.safeParse({}).success).toBe(false);
  });

  it("distingue « champ absent » de « champ à null »", () => {
    const cleared = updateDealSchema.safeParse({ expectedClose: null });
    expect(cleared.success && cleared.data.expectedClose).toBeNull();

    const untouched = updateDealSchema.safeParse({ amount: 1 });
    expect(untouched.success && "expectedClose" in untouched.data).toBe(false);
  });

  it("n'autorise pas à vider un champ obligatoire", () => {
    expect(updateDealSchema.safeParse({ name: "" }).success).toBe(false);
    expect(updateDealSchema.safeParse({ owner: "  " }).success).toBe(false);
  });

  it("n'accepte que les statuts connus", () => {
    expect(updateDealSchema.safeParse({ status: "won" }).success).toBe(true);
    expect(updateDealSchema.safeParse({ status: "archived" }).success).toBe(false);
  });
});

describe("moveStageSchema", () => {
  it("exige une étape cible non vide", () => {
    expect(moveStageSchema.safeParse({ stageId: "s6" }).success).toBe(true);
    expect(moveStageSchema.safeParse({ stageId: "" }).success).toBe(false);
    expect(moveStageSchema.safeParse({}).success).toBe(false);
  });
});

describe("parseDealsQuery", () => {
  it("ignore les paramètres vides — un filtre vidé n'est pas un filtre", () => {
    const result = parseDealsQuery(new URLSearchParams("status=open&owner=&q="));
    expect(result.success && result.data).toEqual({ status: "open" });
  });

  it("accepte le statut « all »", () => {
    const result = parseDealsQuery({ status: "all" });
    expect(result.success && result.data.status).toBe("all");
  });

  it("rejette un statut ou un tri inconnu", () => {
    expect(parseDealsQuery({ status: "pending" }).success).toBe(false);
    expect(parseDealsQuery({ sort: "montant" }).success).toBe(false);
  });

  it("coupe les espaces des valeurs conservées", () => {
    const result = parseDealsQuery({ owner: "  Yanis  " });
    expect(result.success && result.data.owner).toBe("Yanis");
  });
});
