import { describe, expect, it } from "vitest";
import { backupSchema, BACKUP_VERSION } from "../backup";
import { parsePeriod } from "../reports";
import { updateListSchema, updateSettingsSchema, updateStagesSchema } from "../settings";
import { toStaleSort } from "../../../components/dashboard/stale-contacts";

describe("updateSettingsSchema", () => {
  it("refuse une charge utile vide", () => {
    expect(updateSettingsSchema.safeParse({}).success).toBe(false);
  });

  it("refuse un seuil « tiède » supérieur ou égal au seuil « froid »", () => {
    const parsed = updateSettingsSchema.safeParse({ staleDays: 20, coldDays: 14 });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(
      "Le seuil « tiède » doit être inférieur au seuil « froid »",
    );
  });

  it("accepte une modification d'un seul seuil — l'invariant est revalidé côté service", () => {
    expect(updateSettingsSchema.safeParse({ coldDays: 21 }).success).toBe(true);
  });

  it("refuse un objectif négatif et un seuil nul", () => {
    expect(updateSettingsSchema.safeParse({ objectifMensuel: -1 }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ staleDays: 0 }).success).toBe(false);
  });
});

describe("updateStagesSchema", () => {
  const stage = { name: "Découverte", color: "#0FA88F", prob: 20 };

  it("accepte une étape complète", () => {
    expect(updateStagesSchema.safeParse({ stages: [stage] }).success).toBe(true);
  });

  it("refuse un pipeline vide", () => {
    const parsed = updateStagesSchema.safeParse({ stages: [] });
    expect(parsed.error?.issues[0]?.message).toBe(
      "Le pipeline doit garder au moins une étape",
    );
  });

  it("refuse une couleur qui n'est pas au format #RRGGBB", () => {
    const parsed = updateStagesSchema.safeParse({ stages: [{ ...stage, color: "vert" }] });
    expect(parsed.error?.issues[0]?.message).toBe("Couleur au format #RRGGBB");
  });

  it("refuse une probabilité hors de 0–100", () => {
    expect(updateStagesSchema.safeParse({ stages: [{ ...stage, prob: 140 }] }).success).toBe(
      false,
    );
  });
});

describe("updateListSchema", () => {
  it("refuse une liste inconnue", () => {
    const parsed = updateListSchema.safeParse({ kind: "couleurs", values: [] });
    expect(parsed.error?.issues[0]?.message).toBe("Liste inconnue");
  });

  it("accepte une liste vidée", () => {
    expect(updateListSchema.safeParse({ kind: "owners", values: [] }).success).toBe(true);
  });
});

describe("parsePeriod", () => {
  it("lit « all » comme « depuis le début »", () => {
    expect(parsePeriod("all")).toBeNull();
  });

  it("accepte les trois fenêtres proposées", () => {
    expect(parsePeriod("30")).toBe(30);
    expect(parsePeriod("365")).toBe(365);
  });

  it("retombe sur 90 jours pour une valeur absente ou fantaisiste", () => {
    expect(parsePeriod(undefined)).toBe(90);
    expect(parsePeriod("42")).toBe(90);
  });
});

describe("toStaleSort", () => {
  it("retombe sur le tri par fraîcheur", () => {
    expect(toStaleSort(undefined)).toBe("staleness");
    expect(toStaleSort("karma")).toBe("staleness");
  });

  it("accepte les tris connus", () => {
    expect(toStaleSort("name")).toBe("name");
    expect(toStaleSort("lifecycle")).toBe("lifecycle");
  });
});

describe("backupSchema", () => {
  const empty = {
    version: BACKUP_VERSION,
    stages: [],
    companies: [],
    contacts: [],
    deals: [],
    activities: [],
    tasks: [],
    settingsLists: [],
    sequences: [],
    sequenceSteps: [],
  };

  it("accepte une sauvegarde vide mais bien formée", () => {
    expect(backupSchema.safeParse(empty).success).toBe(true);
  });

  it("refuse un fichier qui n'est pas une sauvegarde", () => {
    expect(backupSchema.safeParse({ hello: "world" }).success).toBe(false);
  });

  /**
   * Le point qui compte : JSON n'a pas de type date. Sans conversion, la
   * restauration écrirait des chaînes là où Prisma attend des `Date`.
   */
  it("reconvertit les dates ISO en objets Date", () => {
    const parsed = backupSchema.safeParse({
      ...empty,
      companies: [
        {
          id: "c1",
          name: "ACME",
          createdAt: "2026-01-05T10:00:00.000Z",
        },
      ],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.companies[0]?.createdAt).toBeInstanceOf(Date);
    expect(parsed.data?.companies[0]?.createdAt.getUTCFullYear()).toBe(2026);
  });

  it("refuse une date illisible plutôt que de la remplacer", () => {
    const parsed = backupSchema.safeParse({
      ...empty,
      companies: [{ id: "c1", name: "ACME", createdAt: "hier" }],
    });
    expect(parsed.success).toBe(false);
  });
});
