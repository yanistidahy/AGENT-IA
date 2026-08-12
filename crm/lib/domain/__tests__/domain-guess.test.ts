import { describe, expect, it } from "vitest";
import {
  emailDomain,
  isFreeProvider,
  nameSlug,
  proposeDomain,
} from "../domain-guess";

describe("emailDomain", () => {
  it("rend le domaine en minuscules", () => {
    expect(emailDomain("Louise.Marie@NailMatic.com")).toBe("nailmatic.com");
  });

  it("refuse ce qui n'est pas une adresse", () => {
    expect(emailDomain("")).toBeNull();
    expect(emailDomain("pas-une-adresse")).toBeNull();
    // Vue dans la feuille : deux adresses collées, seconde tronquée.
    expect(emailDomain("lmeridji@labomaicom")).toBeNull();
  });
});

describe("isFreeProvider", () => {
  it("reconnaît les messageries grand public", () => {
    expect(isFreeProvider("gmail.com")).toBe(true);
    expect(isFreeProvider("YAHOO.FR")).toBe(true);
    expect(isFreeProvider("nailmatic.com")).toBe(false);
  });
});

describe("nameSlug", () => {
  it("colle les mots et retire les accents", () => {
    expect(nameSlug("Comme Avant")).toBe("commeavant");
    expect(nameSlug("Nébuleuse bijoux")).toBe("nebuleusebijoux");
    expect(nameSlug("Le sourcil")).toBe("lesourcil");
    expect(nameSlug("Yacon & Co")).toBe("yaconco");
  });

  it("retire les mots génériques, sauf s'il ne reste rien", () => {
    expect(nameSlug("Agence nateev")).toBe("nateev");
    expect(nameSlug("Agence")).toBe("agence");
  });

  it("rend null quand il ne reste rien d'exploitable", () => {
    expect(nameSlug("")).toBeNull();
    expect(nameSlug("—")).toBeNull();
    expect(nameSlug("66")).toBeNull();
  });
});

describe("proposeDomain", () => {
  it("préfère toujours une adresse professionnelle au nom", () => {
    const proposal = proposeDomain("Numorning", ["mathilde@numorning.com"]);
    expect(proposal).toEqual({
      value: "numorning.com",
      rule: "email",
      confidence: "high",
      because: "adresse professionnelle déjà saisie sur 1 fiche(s) de cette société",
    });
  });

  it("ignore les messageries grand public et retombe sur le nom", () => {
    const proposal = proposeDomain("Jolly Mama", ["margaux.cannoni@gmail.com"]);
    expect(proposal?.rule).toBe("name");
    expect(proposal?.value).toBe("jollymama.com");
    expect(proposal?.confidence).toBe("low");
  });

  it("baisse la confiance quand les contacts portent deux domaines différents", () => {
    const proposal = proposeDomain("Naali", ["n.tayach@naali.fr", "k.boucenna@naali.fr", "x@autre.com"]);
    expect(proposal?.value).toBe("naali.fr");
    expect(proposal?.confidence).toBe("low");
    expect(proposal?.because).toContain("2 domaines différents");
  });

  it("est déterministe à égalité de fréquence", () => {
    const emails = ["a@zeta.com", "b@alpha.com"];
    expect(proposeDomain("X", emails)?.value).toBe("alpha.com");
    expect(proposeDomain("X", [...emails].reverse())?.value).toBe("alpha.com");
  });

  it("propose quand même le domaine d'une adresse manifestement fausse", () => {
    // « Absolution » porte un contact en @teledyne.com dans la feuille source.
    // La règle ne peut pas le savoir — c'est exactement pourquoi chaque ligne
    // se relit une par une plutôt que de s'appliquer en masse.
    const proposal = proposeDomain("Absolution", ["isabelle.carron@teledyne.com"]);
    expect(proposal?.value).toBe("teledyne.com");
    expect(proposal?.rule).toBe("email");
  });

  it("rend null quand il n'y a ni adresse ni nom exploitable", () => {
    expect(proposeDomain("", [])).toBeNull();
    expect(proposeDomain("", ["x@gmail.com"])).toBeNull();
  });
});
