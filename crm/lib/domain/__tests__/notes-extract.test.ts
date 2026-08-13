import { describe, expect, it } from "vitest";
import {
  countOtherPatterns,
  extractWebsiteFromNotes,
  findSiteLine,
} from "../notes-extract";

describe("findSiteLine", () => {
  it("extrait un domaine nu", () => {
    expect(findSiteLine("N° : 125\nSITE : www.nubiance.fr\nNotes : Email 1 envoyé")).toEqual({
      line: "SITE : www.nubiance.fr",
      value: "www.nubiance.fr",
    });
  });

  it("extrait une URL complète, y compris avec un chemin", () => {
    expect(findSiteLine("SITE : https://cuure.com/")).toEqual({
      line: "SITE : https://cuure.com/",
      value: "https://cuure.com/",
    });
  });

  it("reconnaît les variantes de ponctuation", () => {
    expect(findSiteLine("Site: copains-paris.com")?.value).toBe("copains-paris.com");
    expect(findSiteLine("SITE :copains-paris.com")?.value).toBe("copains-paris.com");
  });

  it("extrait le domaine d'une ligne titre + domaine", () => {
    const line = "SITE : DIJO ® : Probiotiques 100 % Naturels";
    expect(findSiteLine(line)?.value).toBeNull();

    // Le cas réel où un domaine suit un tiret dans le même style de ligne.
    expect(findSiteLine("SITE : Nandara : nandara.com")?.value).toBe("nandara.com");
  });

  it("rend null quand la ligne ne contient qu'un titre, sans domaine devinable", () => {
    const found = findSiteLine(
      "SITE : Flowi - Marque de produits sans gluten 100% gourmand – FLOWI",
    );
    expect(found).toEqual({
      line: "SITE : Flowi - Marque de produits sans gluten 100% gourmand – FLOWI",
      value: null,
    });
  });

  it("rend undefined quand aucune ligne SITE n'existe", () => {
    expect(findSiteLine("Notes : Contacter par mail")).toBeUndefined();
  });

  it("ignore le mot « site » ailleurs dans une phrase", () => {
    expect(findSiteLine("Notes : Contacté mais son site est wix-e-commerce")).toBeUndefined();
  });
});

describe("extractWebsiteFromNotes", () => {
  it("distingue les trois cas : absent, non résolu, résolu", () => {
    expect(extractWebsiteFromNotes("Notes : rien à voir")).toBeUndefined();
    expect(extractWebsiteFromNotes("SITE : Shopify")).toBeNull();
    expect(extractWebsiteFromNotes("SITE : numorning.com")).toEqual({
      value: "numorning.com",
      line: "SITE : numorning.com",
    });
  });
});

describe("countOtherPatterns", () => {
  it("compte les motifs structurés connus, sans rien extraire", () => {
    const notes = [
      "N° : 1\nRéponse ? : ⏳ En attente\nDate J+2 : 28/03/2026",
      "Canal : Téléphone\nNotes : rien",
      "Rien de structuré ici",
    ];
    expect(countOtherPatterns(notes)).toEqual({ canal: 1, reponse: 1, numero: 1 });
  });

  it("rend des zéros sur une liste sans motif", () => {
    expect(countOtherPatterns(["une note ordinaire"])).toEqual({
      canal: 0,
      reponse: 0,
      numero: 0,
    });
  });
});
