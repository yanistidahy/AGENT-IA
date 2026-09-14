import { describe, expect, it } from "vitest";
import { demoTarget, demoTargetRule, subjectRule, enforceSubjectBrand, describeDemoSource } from "../demo-target";

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

describe("l'objet nomme la marque", () => {
  it("la consigne existe, et elle nomme la marque", () => {
    // Elle manquait : le prompt décrivait le corps ligne à ligne et ne disait
    // rien de l'objet, qui n'était demandé qu'en clé du JSON attendu.
    const rule = subjectRule("Dermoplant");
    expect(rule).toContain("Une démonstration préparée pour Dermoplant");
    expect(rule).toContain("Jamais « votre boutique »");
  });

  it("sans marque connue, elle interdit d'en inventer une", () => {
    expect(subjectRule("")).toContain("N'en invente pas");
    expect(subjectRule("  ")).not.toContain("Une démonstration préparée pour");
  });

  it("la formule générique est remplacée par la marque", () => {
    expect(
      enforceSubjectBrand("Une démonstration préparée pour votre boutique", "Dermoplant"),
    ).toBe("Une démonstration préparée pour Dermoplant");
    expect(enforceSubjectBrand("Un aperçu pour votre site", "Dermoplant")).toBe(
      "Un aperçu pour Dermoplant",
    );
  });

  it("un objet qui nomme déjà la marque n'est pas réécrit", () => {
    const already = "Dermoplant : une démonstration préparée";
    expect(enforceSubjectBrand(already, "Dermoplant")).toBe(already);
    expect(enforceSubjectBrand(already, "dermoplant")).toBe(already);
  });

  it("sans marque, rien n'est réécrit — on n'invente pas", () => {
    const generic = "Une démonstration préparée pour votre boutique";
    expect(enforceSubjectBrand(generic, "")).toBe(generic);
  });

  it("un objet qui parle d'autre chose est laissé tel quel", () => {
    const relance = "Notre échange de jeudi";
    expect(enforceSubjectBrand(relance, "Dermoplant")).toBe(relance);
  });
});

describe("ce que la file annonce comme source", () => {
  it("distingue les trois états, qui appellent trois gestes différents", () => {
    expect(describeDemoSource({ kind: "site", value: "dermoplant.fr" })).toBe(
      "site dermoplant.fr",
    );
    expect(describeDemoSource({ kind: "brand", value: "Dermoplant" })).toBe(
      "aucun site, marque « Dermoplant »",
    );
    expect(describeDemoSource({ kind: "none", value: "" })).toBe("ni site ni société liée");
  });
});
