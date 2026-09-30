import { describe, expect, it } from "vitest";
import {
  describeChoice,
  describeCounts,
  describeGroupFilter,
  editedVariant,
  filterKeeps,
  firstVariantsOf,
  isWrittenVariant,
  parseGroupFilter,
  serializeGroupFilter,
  templateFor,
  threadSubjectFor,
  threadTemplate,
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
      subjectFromStep: false,
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
      subjectFromStep: false,
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

/* ------------------------------------------- l'objet du fil, par groupe ----- */

describe("threadSubjectFor — l'objet du fil se décide groupe par groupe", () => {
  const STEPS = [
    { position: 1, subject: "", body: "défaut 1" },
    { position: 2, subject: "", body: "défaut 2" },
  ];
  const FIRST: StepVariant[] = [
    { group: "direction", subject: "Démo pour {societe}", body: "version Direction" },
    // Une variante d'étape 1 **sans objet** : elle n'apporte rien au fil.
    { group: "marketing", subject: "", body: "version Marketing" },
  ];

  it("prend la variante d'étape 1 du MÊME groupe", () => {
    expect(threadSubjectFor(STEPS, 2, FIRST, "direction")).toBe("Démo pour {societe}");
  });

  it("retombe sur l'objet par défaut de l'étape 1 sans variante pour ce groupe", () => {
    const withDefault = [
      { position: 1, subject: "Objet par défaut", body: "b" },
      { position: 2, subject: "Un objet à elle", body: "b2" },
    ];
    expect(threadSubjectFor(withDefault, 2, FIRST, "commercial")).toBe("Objet par défaut");
    // Une variante d'étape 1 sans objet ne compte pas : c'est un repli, pas un choix.
    expect(threadSubjectFor(withDefault, 2, FIRST, "marketing")).toBe("Objet par défaut");
  });

  it("hors groupe, c'est l'objet par défaut de l'étape 1", () => {
    const withDefault = [
      { position: 1, subject: "Objet par défaut", body: "b" },
      { position: 2, subject: "Un objet à elle", body: "b2" },
    ];
    expect(threadSubjectFor(withDefault, 2, FIRST, null)).toBe("Objet par défaut");
  });

  /*
    Sur l'étape 1, le fil **est** l'objet de ce groupe : c'est lui qui part, et
    c'est lui que les relances hériteront. La cohérence des deux lectures est ce
    qui fait qu'aucune étape ne peut ouvrir une seconde conversation.
  */
  it("sur l'étape 1, le fil d'un groupe est l'objet de sa variante", () => {
    const withDefault = [{ position: 1, subject: "Objet par défaut", body: "b" }];
    expect(threadSubjectFor(withDefault, 1, FIRST, "direction")).toBe("Démo pour {societe}");
    expect(threadSubjectFor(withDefault, 1, FIRST, "commercial")).toBe("Objet par défaut");
  });

  /*
    Le défaut reproduit : sans les variantes de l'étape 1, la relance d'un groupe
    dont l'objet vit sur la variante n'avait **aucun** objet — donc un départ
    refusé à l'envoi par le contrôle de vide du jalon 96.
  */
  it("le défaut du jalon 101 : sans les variantes de l'étape 1, l'objet est vide", () => {
    expect(threadSubjectFor(STEPS, 2, [], "direction")).toBe("");
    expect(threadSubjectFor(STEPS, 2, FIRST, "direction")).not.toBe("");
  });
});

describe("threadTemplate — la relance porte l'objet du fil de chaque groupe", () => {
  const STEPS = [
    { position: 1, subject: "", body: "défaut 1" },
    { position: 2, subject: "", body: "défaut 2" },
  ];
  const FIRST: StepVariant[] = [
    { group: "direction", subject: "Démo pour {societe}", body: "version Direction" },
  ];

  it("l'objet du groupe atteint le texte composé", () => {
    const thread = threadTemplate(
      STEPS,
      2,
      [{ group: "direction", subject: "", body: "relance Direction" }],
      FIRST,
    );
    const chosen = templateFor(thread.step, thread.variants, "direction");
    expect(chosen.subject).toBe("Démo pour {societe}");
    expect(chosen.body).toBe("relance Direction");
  });

  it("un groupe qui porte l'objet du fil sans variante de relance en reçoit une", () => {
    const thread = threadTemplate(STEPS, 2, [], FIRST);
    const chosen = templateFor(thread.step, thread.variants, "direction");
    expect(chosen.subject, "le fil tient pour ce groupe").toBe("Démo pour {societe}");
    // Le corps, lui, retombe sur le défaut de l'étape : rien n'est inventé.
    expect(chosen.body).toBe("défaut 2");
  });

  it("un objet de variante de relance ne peut pas rouvrir un second fil", () => {
    const thread = threadTemplate(
      STEPS,
      2,
      [{ group: "direction", subject: "Un objet à elle", body: "relance" }],
      FIRST,
    );
    expect(templateFor(thread.step, thread.variants, "direction").subject).toBe(
      "Démo pour {societe}",
    );
  });

  it("un repli sur le défaut reste un repli, pour que l'aperçu le dise", () => {
    const withDefault = [
      { position: 1, subject: "Objet par défaut", body: "b" },
      { position: 2, subject: "", body: "b2" },
    ];
    const thread = threadTemplate(
      withDefault,
      2,
      [{ group: "commercial", subject: "", body: "relance Commercial" }],
      FIRST,
    );
    const chosen = templateFor(thread.step, thread.variants, "commercial");
    expect(chosen.subject).toBe("Objet par défaut");
    expect(chosen.subjectFromStep, "l'objet vient du défaut, et l'écran le dit").toBe(true);
  });

  it("l'étape 1 n'est pas touchée : ses variantes gardent leur objet", () => {
    const thread = threadTemplate(STEPS, 1, FIRST, FIRST);
    expect(templateFor(thread.step, thread.variants, "direction").subject).toBe(
      "Démo pour {societe}",
    );
  });
});

describe("firstVariantsOf", () => {
  it("lit les variantes de la plus petite position, et écarte un groupe inconnu", () => {
    const steps = [
      { position: 2, variants: [{ group: "direction", subject: "s2", body: "b2" }] },
      {
        position: 1,
        variants: [
          { group: "direction", subject: "s1", body: "b1" },
          { group: "inconnu", subject: "x", body: "y" },
        ],
      },
    ];
    expect(firstVariantsOf(steps)).toEqual([
      { group: "direction", subject: "s1", body: "b1" },
    ]);
  });

  it("rend une liste vide quand rien n'est chargé", () => {
    expect(firstVariantsOf([{ position: 1 }])).toEqual([]);
    expect(firstVariantsOf([])).toEqual([]);
  });
});
