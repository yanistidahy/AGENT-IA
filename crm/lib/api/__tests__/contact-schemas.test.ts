import { describe, expect, it } from "vitest";
import {
  createContactSchema,
  parseContactsQuery,
  updateContactSchema,
} from "../contact-schemas";
import { parseCompaniesQuery, updateCompanySchema } from "../company-schemas";

const base = { firstName: "Marie", lastName: "Durand", lifecycle: "Lead" } as const;

describe("createContactSchema", () => {
  it("accepte le minimum : prénom, nom, cycle de vie", () => {
    const parsed = createContactSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it("refuse un prénom vide, avec un message lisible", () => {
    const parsed = createContactSchema.safeParse({ ...base, firstName: "  " });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("Le prénom est obligatoire");
  });

  it("refuse un cycle de vie hors liste", () => {
    expect(createContactSchema.safeParse({ ...base, lifecycle: "VIP" }).success).toBe(false);
  });

  it("accepte une adresse électronique absente ou vide", () => {
    expect(createContactSchema.safeParse({ ...base, email: "" }).success).toBe(true);
    expect(createContactSchema.safeParse(base).success).toBe(true);
  });

  it("refuse une adresse électronique manifestement fausse", () => {
    const parsed = createContactSchema.safeParse({ ...base, email: "marie(at)acme" });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("Adresse électronique invalide");
  });

  it("transforme une date lisible et refuse une date illisible", () => {
    const ok = createContactSchema.safeParse({ ...base, lastContact: "2026-03-01" });
    expect(ok.data?.lastContact).toBeInstanceOf(Date);

    const ko = createContactSchema.safeParse({ ...base, lastContact: "hier" });
    expect(ko.success).toBe(false);
  });

  it("lit une date vide comme un effacement, pas comme une erreur", () => {
    const parsed = createContactSchema.safeParse({ ...base, nextReminder: "" });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.nextReminder).toBeNull();
  });
});

describe("updateContactSchema", () => {
  it("refuse une charge utile vide", () => {
    expect(updateContactSchema.safeParse({}).success).toBe(false);
  });

  it("autorise l'omission mais pas l'effacement du nom", () => {
    expect(updateContactSchema.safeParse({ phone: "06" }).success).toBe(true);
    expect(updateContactSchema.safeParse({ lastName: "" }).success).toBe(false);
  });

  it("distingue « société à null » de « société absente »", () => {
    const cleared = updateContactSchema.safeParse({ companyId: null });
    expect(cleared.data?.companyId).toBeNull();

    const untouched = updateContactSchema.safeParse({ phone: "06" });
    expect(untouched.data && "companyId" in untouched.data).toBe(false);
  });
});

describe("parseContactsQuery", () => {
  it("écarte les filtres vides plutôt que de filtrer sur la chaîne vide", () => {
    const parsed = parseContactsQuery({ q: "  ", owner: "Yanis" });
    expect(parsed.success).toBe(true);
    expect(parsed.data).toEqual({ owner: "Yanis" });
  });

  it("accepte « all » comme cycle de vie", () => {
    expect(parseContactsQuery({ lifecycle: "all" }).success).toBe(true);
  });

  it("refuse une clé de tri inconnue", () => {
    expect(parseContactsQuery({ sort: "karma" }).success).toBe(false);
  });

  it("lit aussi des URLSearchParams", () => {
    const parsed = parseContactsQuery(new URLSearchParams("q=durand&dir=desc"));
    expect(parsed.data).toEqual({ q: "durand", dir: "desc" });
  });
});

describe("sociétés", () => {
  it("refuse une mise à jour vide", () => {
    expect(updateCompanySchema.safeParse({}).success).toBe(false);
  });

  it("refuse un nom effacé", () => {
    expect(updateCompanySchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("nettoie les filtres de la liste", () => {
    expect(parseCompaniesQuery({ q: "", industry: "SaaS" }).data).toEqual({ industry: "SaaS" });
  });
});

describe("société créée à la volée", () => {
  it("accepte un nom de société au lieu d'un identifiant", () => {
    const parsed = createContactSchema.safeParse({ ...base, companyName: "Zénith Labs" });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.companyName).toBe("Zénith Labs");
  });

  it("refuse un nom de société vide plutôt que d'en créer une sans nom", () => {
    expect(createContactSchema.safeParse({ ...base, companyName: "   " }).success).toBe(false);
  });

  it("tolère les deux champs : le service tranche en faveur du nom saisi", () => {
    const parsed = createContactSchema.safeParse({
      ...base,
      companyId: "co1",
      companyName: "Nouvelle",
    });
    expect(parsed.success).toBe(true);
  });

  it("accepte aussi un nom de société sur une affaire", async () => {
    const { createDealSchema } = await import("../deal-schemas");
    const parsed = createDealSchema.safeParse({
      name: "Bot SAV",
      amount: 6480,
      stageId: "s1",
      owner: "Yanis",
      companyName: "Atelier MV",
    });
    expect(parsed.success).toBe(true);
  });
});

describe("filtres de relance", () => {
  it("accepte les trois filtres de statut", () => {
    for (const value of ["due", "silent", "never"]) {
      expect(parseContactsQuery({ followUp: value }).success, value).toBe(true);
    }
  });

  it("refuse un statut qui n'est pas proposé en filtre", () => {
    expect(parseContactsQuery({ followUp: "waiting" }).success).toBe(false);
  });

  it("accepte les tris dérivés", () => {
    expect(parseContactsQuery({ sort: "followUp" }).success).toBe(true);
    expect(parseContactsQuery({ sort: "nextReminder" }).success).toBe(true);
  });
});
