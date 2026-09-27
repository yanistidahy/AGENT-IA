import { describe, expect, it } from "vitest";
import {
  describeChoice,
  describeCounts,
  describeGroupFilter,
  editedVariant,
  filterKeeps,
  isWrittenVariant,
  parseGroupFilter,
  serializeGroupFilter,
  templateFor,
  unclassifiedWarning,
  type StepVariant,
} from "../step-variants";
import { STEP_ONE_SEEDS } from "../step-variant-seeds";

const DEFAULT_STEP = { subject: "Défaut", body: "Message par défaut." };

const VARIANTS: StepVariant[] = [
  { group: "direction", subject: "Pour la direction", body: "ROI." },
  { group: "marketing", subject: "Pour le marketing", body: "Conversion." },
  // Écrite à blanc : elle ne doit compter pour rien.
  { group: "commercial", subject: "  ", body: "" },
];

describe("le texte qui partira, et d'où il vient", () => {
  it("un groupe qui a sa variante la reçoit", () => {
    expect(templateFor(DEFAULT_STEP, VARIANTS, "direction")).toEqual({
      subject: "Pour la direction",
      body: "ROI.",
      variantOf: "direction",
    });
  });

  it("un groupe sans variante reçoit le message par défaut", () => {
    expect(templateFor(DEFAULT_STEP, VARIANTS, "autre").variantOf).toBeNull();
    expect(templateFor(DEFAULT_STEP, VARIANTS, "autre").subject).toBe("Défaut");
  });

  it("une variante vide vaut absence de variante, jamais un message vide", () => {
    expect(isWrittenVariant({ subject: "  ", body: "" })).toBe(false);
    expect(templateFor(DEFAULT_STEP, VARIANTS, "commercial").subject).toBe("Défaut");
  });

  it("une fiche jamais classée reçoit le défaut, pas la variante « Autre »", () => {
    expect(templateFor(DEFAULT_STEP, VARIANTS, null).variantOf).toBeNull();
  });

  it("aucune variante du tout : le comportement d'avant les groupes", () => {
    expect(templateFor(DEFAULT_STEP, [], "direction")).toEqual({
      ...DEFAULT_STEP,
      variantOf: null,
    });
  });

  it("l'aperçu dit lequel des cinq textes il montre", () => {
    expect(describeChoice(templateFor(DEFAULT_STEP, VARIANTS, "direction"))).toBe(
      "variante « Direction »",
    );
    expect(describeChoice(templateFor(DEFAULT_STEP, VARIANTS, "autre"))).toBe(
      "message par défaut de l'étape",
    );
  });

  it("modifier n'est pas envoyer : un groupe sans variante s'édite à vide", () => {
    // Retomber sur le défaut ici ferait écrire dans le défaut en croyant écrire
    // une variante.
    expect(editedVariant(VARIANTS, "autre")).toEqual({ subject: "", body: "" });
    expect(editedVariant(VARIANTS, "direction").subject).toBe("Pour la direction");
  });
});

describe("le filtre de groupes d'une campagne", () => {
  it("vide veut dire tous : les campagnes existantes ne perdent personne", () => {
    expect(parseGroupFilter("")).toEqual([]);
    expect(filterKeeps("", "autre", "auto")).toBe(true);
    expect(filterKeeps("", "direction", "auto")).toBe(true);
    expect(describeGroupFilter("")).toBe("Tous les groupes");
  });

  it("une valeur inconnue est ignorée, elle ne vide pas le filtre", () => {
    expect(parseGroupFilter("direction,legacy")).toEqual(["direction"]);
    expect(filterKeeps("direction,legacy", "marketing", "auto")).toBe(false);
  });

  it("les quatre groupes cochés s'écrivent « tous »", () => {
    expect(serializeGroupFilter(["direction", "marketing", "commercial", "autre"])).toBe("");
    expect(serializeGroupFilter(["commercial", "direction"])).toBe("direction,commercial");
  });

  it("une fiche jamais classée n'est retenue par aucun groupe", () => {
    expect(filterKeeps("autre", "autre", "none")).toBe(false);
    expect(filterKeeps("autre", "autre", "auto")).toBe(true);
  });
});

describe("les compteurs affichés avant d'envoyer", () => {
  it("comptent chaque groupe, et « Non classé » à part", () => {
    expect(
      describeCounts({
        byGroup: { direction: 14, marketing: 9, commercial: 3, autre: 6 },
        unclassified: 2,
      }),
    ).toBe("Direction 14 · Marketing & digital 9 · Commercial 3 · Autre 6 · Non classé 2");
  });

  it("n'énumèrent pas les zéros", () => {
    expect(
      describeCounts({
        byGroup: { direction: 1, marketing: 0, commercial: 0, autre: 0 },
        unclassified: 0,
      }),
    ).toBe("Direction 1");
  });

  it("l'avertissement ne sonne que s'il y a des fiches non classées", () => {
    expect(unclassifiedWarning(0)).toBe("");
    expect(unclassifiedWarning(150)).toBe("150 contacts jamais classés : recalculez les groupes");
  });
});

describe("les variantes pré-remplies suivent les règles du discours", () => {
  const written = Object.values(STEP_ONE_SEEDS).filter(isWrittenVariant);

  it("trois angles, un par groupe qui en mérite un", () => {
    expect(written).toHaveLength(3);
    // « Autre » n'est pas un métier : lui écrire un angle commun serait deviner.
    expect(isWrittenVariant(STEP_ONE_SEEDS.autre)).toBe(false);
  });

  for (const [group, seed] of Object.entries(STEP_ONE_SEEDS)) {
    if (!isWrittenVariant(seed)) continue;
    it(`« ${group} » : conseiller de vente, aucun prix, aucun tiret long`, () => {
      const text = `${seed.subject}\n${seed.body}`.toLowerCase();
      expect(text).not.toContain("chatbot");
      expect(text).not.toContain("personal shopper");
      expect(text).not.toContain("€");
      expect(text).not.toContain("%");
      expect(`${seed.subject}${seed.body}`).not.toMatch(/[–—]/);
      // Ne présume jamais d'une équipe (jalon 57).
      expect(text).not.toContain("votre équipe");
    });
  }

  it("le marketing porte sa phrase supprimable, et elle est dans le texte", () => {
    const seed = STEP_ONE_SEEDS.marketing;
    expect(seed.optionalSentence).toBeDefined();
    expect(seed.body).toContain(seed.optionalSentence ?? "");
  });

  it("les trois angles sont réellement différents", () => {
    const bodies = written.map((seed) => seed.body);
    expect(new Set(bodies).size).toBe(bodies.length);
  });
});
