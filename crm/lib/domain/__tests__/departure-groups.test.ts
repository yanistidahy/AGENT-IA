import { describe, expect, it } from "vitest";
import {
  describeGroup,
  groupDepartures,
  groupTitle,
  stepLabel,
  type GroupableDeparture,
} from "../departure-groups";

function row(over: Partial<GroupableDeparture> & { id: string }): GroupableDeparture {
  return {
    campaignName: "",
    sequenceName: "",
    step: 1,
    status: "pending",
    ...over,
  };
}

describe("le nom d'un groupe", () => {
  it("prend la campagne quand il y en a une", () => {
    expect(groupTitle(row({ id: "a", campaignName: "SAV", sequenceName: "seq" }))).toBe("SAV");
  });

  it("retombe sur la séquence, qui a toujours un nom", () => {
    // Les séquences d'avant le jalon 54 n'ont pas de campagne.
    expect(groupTitle(row({ id: "a", sequenceName: "Prospection froide" }))).toBe(
      "Prospection froide",
    );
  });

  it("nomme l'absence plutôt que de rendre un titre vide", () => {
    // Un en-tête vide se lit comme un défaut d'affichage.
    expect(groupTitle(row({ id: "a" }))).toBe("Sans campagne");
  });

  it("ignore les espaces de bord", () => {
    expect(groupTitle(row({ id: "a", campaignName: "  SAV  " }))).toBe("SAV");
  });
});

describe("le groupement", () => {
  it("conserve l'ordre reçu, et l'ordre des groupes suit leur première ligne", () => {
    /*
      Le service trie déjà la file : re-trier ici inventerait un second ordre,
      et c'est toujours le second qui finit par contredire l'écran.
    */
    const groups = groupDepartures([
      row({ id: "1", campaignName: "B" }),
      row({ id: "2", campaignName: "A" }),
      row({ id: "3", campaignName: "B" }),
    ]);
    expect(groups.map((group) => group.title)).toEqual(["B", "A"]);
    expect(groups[0]?.rows.map((entry) => entry.id)).toEqual(["1", "3"]);
  });

  it("ne rend aucun groupe sur une file vide", () => {
    expect(groupDepartures([])).toEqual([]);
  });

  it("réunit sous un seul groupe deux séquences d'une même campagne", () => {
    const groups = groupDepartures([
      row({ id: "1", campaignName: "SAV", sequenceName: "x" }),
      row({ id: "2", campaignName: "SAV", sequenceName: "y" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.rows).toHaveLength(2);
  });
});

describe("ce que l'en-tête annonce", () => {
  it("compte les brouillons non composés à part", () => {
    // Les additionner ferait annoncer « 5 à valider » là où deux ne partiront pas.
    expect(
      describeGroup([
        row({ id: "1" }),
        row({ id: "2" }),
        row({ id: "3", status: "failed" }),
        row({ id: "4", status: "failed" }),
      ]),
    ).toBe("2 à valider · 2 non composés");
  });

  it("ne parle pas d'échec quand il n'y en a pas", () => {
    expect(describeGroup([row({ id: "1" })])).toBe("1 à valider");
  });

  it("accorde le singulier", () => {
    expect(describeGroup([row({ id: "1", status: "failed" })])).toBe("0 à valider · 1 non composé");
  });
});

describe("l'étape, dite comme une position", () => {
  it("situe l'étape dans la suite", () => {
    expect(stepLabel(2, 3)).toBe("étape 2 sur 3");
  });

  it("se contente du numéro quand le total est inconnu", () => {
    // Un « sur 0 » se lirait comme une séquence vide.
    expect(stepLabel(2, 0)).toBe("étape 2");
  });
});
