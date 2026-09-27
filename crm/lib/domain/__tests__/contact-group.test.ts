import { describe, expect, it } from "vitest";
import {
  CONTACT_GROUPS,
  ambiguousTitles,
  classifyTitle,
  groupLabel,
  groupOfTitle,
  type ContactGroup,
} from "../contact-group";

/**
 * **Trente-six intitulés réels, et chacun tombe où il est documenté.**
 *
 * La table est la spécification : elle se relit d'un coup d'œil, et une règle
 * qui changerait ferait tomber la ligne concernée en la nommant. Les cas qui
 * ont décidé de la conception sont marqués en commentaire.
 */

const CASES: readonly [string, ContactGroup][] = [
  // — le spécifique l'emporte sur la séniorité, c'est la règle qui décide —
  ["Directeur marketing", "marketing"],
  ["Directrice marketing et communication", "marketing"],
  ["Directrice commerciale", "commercial"],
  ["Directeur commercial France", "commercial"],
  ["Head of Sales", "commercial"],
  ["Co-fondatrice & CMO", "marketing"],
  ["Co-founder & Head of Growth", "marketing"],

  // — Direction : la séniorité, plus les deux expressions spécifiques —
  ["Directeur général", "direction"],
  ["Directrice générale", "direction"],
  ["Fondateur", "direction"],
  ["Co-fondateur", "direction"],
  ["Cofondatrice", "direction"],
  ["Founder", "direction"],
  ["CEO", "direction"],
  ["CEO & Founder", "direction"],
  ["COO", "direction"],
  ["PDG", "direction"],
  ["Président", "direction"],
  ["Gérante", "direction"],
  ["Dirigeant", "direction"],
  ["Chief of Staff", "direction"],

  // — Marketing & digital —
  ["Responsable marketing", "marketing"],
  ["Brand Manager", "marketing"],
  ["Chargée de communication", "marketing"],
  ["Responsable e-commerce", "marketing"],
  ["E-commerce Manager", "marketing"],
  ["Growth Manager", "marketing"],
  ["Social Media Manager", "marketing"],
  ["Community Manager", "marketing"],
  ["Responsable CRM", "marketing"],
  ["Traffic manager acquisition", "marketing"],
  ["Responsable marketplace", "marketing"],
  ["Digital Manager", "marketing"],

  // — Commercial —
  ["Business Developer", "commercial"],
  ["Account Manager", "commercial"],
  ["Responsable des ventes", "commercial"],
  ["Responsable wholesale", "commercial"],
  ["Développement commercial", "commercial"],
  ["ADV", "commercial"],
  ["Responsable ADV", "commercial"],

  // — Autre : ce qu'aucun mot-clé ne couvre, jamais le plus ressemblant —
  ["Coordinatrice logistique", "autre"],
  /*
    **« Advertising manager » va en Autre, et c'est le cas qui prouve la règle.**
    La liste de mots-clés validée ne porte pas « advertising » (ni « publicité ») :
    le classer en Marketing demanderait de le deviner, et le seul mot-clé qui
    pourrait l'attraper est « adv » — c'est-à-dire par sous-chaîne, exactement ce
    qui est interdit. Il reste donc non reconnu plutôt que mal rangé, et
    « advertising » est un mot-clé à ajouter si l'usage le réclame.
  */
  ["Advertising manager", "autre"],
  ["Responsable logistique", "autre"],
  ["Office Manager", "autre"],
  ["Responsable SAV", "autre"],
  ["Chef de produit", "autre"],
  ["Assistante de direction", "autre"],
  ["", "autre"],
  ["   ", "autre"],
];

describe("chaque intitulé tombe dans son groupe documenté", () => {
  for (const [title, expected] of CASES) {
    it(`« ${title === "" ? "(vide)" : title} » → ${expected}`, () => {
      expect(groupOfTitle(title)).toBe(expected);
    });
  }

  it("couvre les quatre groupes, sinon la table ne prouverait rien", () => {
    const covered = new Set(CASES.map(([, group]) => group));
    for (const group of CONTACT_GROUPS) expect(covered.has(group)).toBe(true);
  });
});

describe("les mots entiers, jamais les sous-chaînes", () => {
  it("« coordinatrice » ne contient pas « coo »", () => {
    expect(groupOfTitle("Coordinatrice logistique")).toBe("autre");
    expect(classifyTitle("Coordinatrice logistique").matched).toBe("");
  });

  it("« advertising » ne contient pas « adv »", () => {
    const verdict = classifyTitle("Advertising manager");
    expect(verdict.matched).not.toBe("adv");
    expect(verdict.group).not.toBe("commercial");
  });

  it("« directeur » seul ne suffit pas pour Direction", () => {
    expect(groupOfTitle("Directeur de la logistique")).toBe("autre");
  });

  it("les accents et la casse n'ont aucun effet", () => {
    expect(groupOfTitle("DIRECTRICE GÉNÉRALE")).toBe("direction");
    expect(groupOfTitle("directrice generale")).toBe("direction");
  });
});

describe("le départage est documenté et signalé", () => {
  it("à précision égale, Commercial passe devant Marketing", () => {
    const verdict = classifyTitle("Sales & Marketing Manager");
    expect(verdict.group).toBe("commercial");
    expect(verdict.ambiguous).toBe(true);
  });

  it("un intitulé départagé est listé pour relecture", () => {
    expect(ambiguousTitles(["Sales & Marketing Manager", "Directeur marketing"])).toEqual([
      "Sales & Marketing Manager",
    ]);
  });

  it("une correspondance plus longue n'est pas une ambiguïté", () => {
    // « developpement commercial » (2 mots) bat « marketing » (1 mot).
    const verdict = classifyTitle("Développement commercial et marketing");
    expect(verdict.group).toBe("commercial");
    expect(verdict.ambiguous).toBe(false);
  });
});

describe("« jamais classé » n'est pas « Autre »", () => {
  it("le libellé distingue les deux", () => {
    expect(groupLabel("autre", "none")).toBe("Non classé");
    expect(groupLabel("autre", "auto")).toBe("Autre");
    expect(groupLabel("marketing", "manual")).toBe("Marketing & digital");
  });

  it("une valeur inconnue en base retombe sur Autre, jamais sur une erreur", () => {
    expect(groupLabel("legacy", "auto")).toBe("Autre");
  });
});
