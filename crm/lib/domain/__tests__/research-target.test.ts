import { describe, expect, it } from "vitest";
import {
  describeTarget,
  normalizeSite,
  resolveResearchTarget,
  storedTarget,
} from "../research-target";

const target = (over: Partial<Parameters<typeof resolveResearchTarget>[0]> = {}) =>
  resolveResearchTarget({ website: "", companyDomain: "", emails: [], ...over });

describe("l'ordre des sources est l'ordre de certitude", () => {
  it("un site saisi sur la fiche l'emporte sur tout le reste", () => {
    const found = target({
      website: "https://boutique.fr",
      companyDomain: "societe.fr",
      emails: ["roxana@dermoplant.com"],
    });
    expect(found).toEqual({
      url: "https://boutique.fr/",
      host: "boutique.fr",
      source: "contact-site",
    });
  });

  it("à défaut, le domaine de la société", () => {
    const found = target({ companyDomain: "societe.fr", emails: ["roxana@dermoplant.com"] });
    expect(found?.source).toBe("company-domain");
    expect(found?.host).toBe("societe.fr");
  });

  it("à défaut, le domaine de l'adresse — lu, pas deviné", () => {
    // `roxana.beraud@dermoplant.com` **dit** que le site est dermoplant.com.
    // Ce n'est pas la supposition du jalon 25, qui fabriquait un domaine à
    // partir du nom de la marque.
    const found = target({ emails: ["roxana.beraud@dermoplant.com"] });
    expect(found).toEqual({
      url: "https://dermoplant.com/",
      host: "dermoplant.com",
      source: "email",
    });
  });

  it("un champ saisi n'est jamais corrigé par une déduction", () => {
    // Même quand les deux se contredisent : corriger une valeur saisie à partir
    // d'une déduction serait décider à la place de l'utilisateur (jalon 8).
    expect(target({ companyDomain: "ancien.fr", emails: ["x@nouveau.fr"] })?.host).toBe(
      "ancien.fr",
    );
  });
});

describe("les messageries grand public ne désignent aucune société", () => {
  it("une adresse gmail ne produit aucune cible", () => {
    // Documenter `gmail.com` serait absurde, et le repli générique est la bonne
    // réponse : c'est la fiche qu'il faut compléter.
    expect(target({ emails: ["roxana@gmail.com"] })).toBeNull();
  });

  it("chaque famille de fournisseur est couverte", () => {
    for (const address of [
      "a@orange.fr",
      "a@wanadoo.fr",
      "a@free.fr",
      "a@sfr.fr",
      "a@laposte.net",
      "a@icloud.com",
      "a@protonmail.com",
      "a@hotmail.fr",
      "a@outlook.com",
      "a@yahoo.fr",
      "a@neuf.fr",
      "a@gmx.net",
      "a@mail.com",
      "a@qq.com",
    ]) {
      expect(target({ emails: [address] })).toBeNull();
    }
  });

  it("la première adresse professionnelle gagne, les gratuites sont enjambées", () => {
    expect(target({ emails: ["a@gmail.com", "b@dermoplant.com"] })?.host).toBe("dermoplant.com");
  });
});

describe("ce qui n'est pas une adresse n'en devient pas une", () => {
  it("un titre de page ou un nom de plateforme est refusé", () => {
    // Les 59 fiches du jalon 24 dont la colonne SITE portait « Shopify ».
    expect(normalizeSite("Shopify")).toBeNull();
    expect(normalizeSite("Argalys Essentiels")).toBeNull();
    expect(normalizeSite("")).toBeNull();
  });

  it("le www. disparaît de l'affichage, pas de l'adresse lue", () => {
    expect(normalizeSite("www.nubiance.fr")?.host).toBe("nubiance.fr");
  });

  it("une adresse tronquée ne produit pas de cible", () => {
    expect(target({ emails: ["roxana@", "sans-arobase"] })).toBeNull();
  });
});

describe("la provenance se lit à l'écran", () => {
  it("elle nomme la source entre parenthèses", () => {
    const found = target({ emails: ["roxana@dermoplant.com"] });
    expect(found === null ? "" : describeTarget(found)).toBe(
      "dermoplant.com (déduit de l'adresse email)",
    );
    const typed = target({ website: "dermoplant.com" });
    expect(typed === null ? "" : describeTarget(typed)).toBe("dermoplant.com (fiche)");
  });

  it("une recherche antérieure au jalon 75 ne prétend aucune source", () => {
    // Afficher « fiche » par défaut ferait passer une inconnue pour un fait.
    expect(storedTarget("", "")).toBeNull();
    expect(storedTarget("dermoplant.com", "")).toBeNull();
    expect(storedTarget("dermoplant.com", "email")?.source).toBe("email");
  });
});
