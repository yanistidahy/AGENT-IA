import { describe, expect, it } from "vitest";
import { demoTarget, demoTargetRule } from "../demo-target";

const base = { website: "", companyDomain: "", companyName: "" };

describe("ce que la phrase de démonstration doit nommer", () => {
  it("le site du contact, en priorité", () => {
    expect(
      demoTarget({ ...base, website: "cuure.com", companyDomain: "autre.fr" }),
    ).toEqual({ kind: "site", value: "cuure.com" });
  });

  it("le domaine de la société, à défaut", () => {
    expect(demoTarget({ ...base, companyDomain: "numorning.com" })).toEqual({
      kind: "site",
      value: "numorning.com",
    });
  });

  it("dépouillé du schéma et du slash final — on cite, on ne colle pas", () => {
    expect(demoTarget({ ...base, website: "https://www.cuure.com/" }).value).toBe(
      "cuure.com",
    );
  });

  it("**le nom de la marque quand aucun site n'est connu**", () => {
    // Le cas qui compte : sans ce repli, le modèle fabrique une adresse
    // plausible qui appartient à quelqu'un d'autre.
    expect(demoTarget({ ...base, companyName: "Maison Vertu" })).toEqual({
      kind: "brand",
      value: "Maison Vertu",
    });
  });

  it("rien du tout quand la fiche est nue", () => {
    expect(demoTarget(base)).toEqual({ kind: "none", value: "" });
  });
});

describe("ce qui ressemble à un site sans en être un", () => {
  /**
   * Les 59 fiches du jalon 24 : la colonne SITE de la feuille portait le titre
   * de la page, pas son adresse. Les citer comme une URL serait le mensonge
   * exact que ce module existe pour empêcher.
   */
  it("un titre de page n'est pas une adresse", () => {
    expect(demoTarget({ ...base, website: "Shopify", companyName: "Argalys" })).toEqual({
      kind: "brand",
      value: "Argalys",
    });
  });

  it("une phrase non plus", () => {
    expect(
      demoTarget({ ...base, website: "Vitamines et compléments | Argalys", companyName: "Argalys" }).kind,
    ).toBe("brand");
  });

  it("mais un domaine avec un chemin reste un domaine", () => {
    expect(demoTarget({ ...base, website: "cuure.com/collections" }).kind).toBe("site");
  });
});

describe("la consigne donnée à Alex", () => {
  it("nomme le site, et interdit d'en écrire un autre", () => {
    const rule = demoTargetRule(demoTarget({ ...base, website: "cuure.com" }));
    expect(rule).toContain("cuure.com");
    expect(rule).toContain("N'écris aucune autre adresse");
  });

  it("**interdit explicitement de déduire une adresse du nom**", () => {
    const rule = demoTargetRule(demoTarget({ ...base, companyName: "Maison Vertu" }));
    expect(rule).toContain("aucune adresse");
    expect(rule).toContain("Maison Vertu");
    expect(rule).toMatch(/n'en déduis pas une du nom/i);
  });

  it("reste utilisable même sans marque", () => {
    expect(demoTargetRule(demoTarget(base))).toContain("votre boutique");
  });
});
