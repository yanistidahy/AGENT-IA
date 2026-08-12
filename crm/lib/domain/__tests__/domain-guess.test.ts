import { describe, expect, it } from "vitest";
import {
  describeBulkOutcome,
  domainLabel,
  emailDomain,
  isFreeProvider,
  isSuspicious,
  nameSimilarity,
  nameSlug,
  proposeDomain,
  SUSPICIOUS_BELOW,
  type SkipReason,
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

describe("domainLabel", () => {
  it("garde la marque, retire www, extension et ponctuation", () => {
    expect(domainLabel("www.nubiance.fr")).toBe("nubiance");
    expect(domainLabel("march-lab.com")).toBe("marchlab");
    expect(domainLabel("https://cuure.com/")).toBe("cuure");
    expect(domainLabel("pomad.paris")).toBe("pomad");
  });
});

describe("nameSimilarity", () => {
  it("vaut 1 quand l'un contient l'autre", () => {
    expect(nameSimilarity("Numorning", "numorning.com")).toBe(1);
    expect(nameSimilarity("Agence nateev", "nateev.fr")).toBe(1);
    expect(nameSimilarity("23 beauty paris", "23beauty.paris")).toBe(1);
    // Le nom ne porte que des chiffres : la normalisation les garde.
    expect(nameSimilarity("66-30", "https://66-30.com/fr/")).toBe(1);
  });

  it("tombe à zéro sur les adresses manifestement erronées de la feuille", () => {
    expect(nameSimilarity("Absolution", "teledyne.com")).toBe(0);
    expect(nameSimilarity("Spring", "teledyne.com")).toBe(0);
  });

  it("reste élevée sur une faute de frappe dans le nom", () => {
    expect(nameSimilarity("Omnie", "omie.fr")).toBeGreaterThan(SUSPICIOUS_BELOW);
    expect(nameSimilarity("Roseaparis", "rosaeparis.com")).toBeGreaterThan(SUSPICIOUS_BELOW);
  });

  it("est symétrique et bornée", () => {
    const a = nameSimilarity("Glamelina", "glamellinacosmetics.com");
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThanOrEqual(1);
    expect(nameSimilarity("", "x.com")).toBe(0);
    expect(nameSimilarity("X", "")).toBe(0);
  });
});

describe("isSuspicious", () => {
  it("signale ce qui ne ressemble pas au nom, et rien d'autre", () => {
    expect(isSuspicious("Absolution", "teledyne.com")).toBe(true);
    expect(isSuspicious("Sisi la paillette", "u-paris.fr")).toBe(true);
    expect(isSuspicious("Capiplante", "capiplante.fr")).toBe(false);
    expect(isSuspicious("Laboratoire mademoiselle", "mademoisellecosmetique.com")).toBe(false);
  });
});

describe("describeBulkOutcome", () => {
  it("dit exactement ce qui s'est passé", () => {
    expect(describeBulkOutcome(84, Array<SkipReason>(4).fill("filled"))).toBe(
      "84 domaines écrits · 4 ignorés (déjà renseignés)",
    );
  });

  it("accorde le singulier", () => {
    expect(describeBulkOutcome(1, ["filled"])).toBe("1 domaine écrit · 1 ignoré (déjà renseigné)");
  });

  it("omet la partie « ignorés » quand il n'y en a aucun", () => {
    expect(describeBulkOutcome(88, [])).toBe("88 domaines écrits");
    expect(describeBulkOutcome(0, [])).toBe("0 domaines écrits");
  });

  it("accorde chaque raison sur son propre compte", () => {
    expect(describeBulkOutcome(2, ["filled", "filled", "changed"])).toBe(
      "2 domaines écrits · 3 ignorés (déjà renseignés, la proposition a changé)",
    );
  });

  it("nomme le refus des suppositions", () => {
    expect(describeBulkOutcome(0, ["notDeduced", "notDeduced"])).toBe(
      "0 domaines écrits · 2 ignorés (ne sont plus des déductions)",
    );
  });
});
