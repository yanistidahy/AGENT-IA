import { describe, expect, it } from "vitest";
import { renderSubject } from "../merge-tags";
import {
  describeChoice,
  describeSubjectPlan,
  describeCounts,
  describeGroupFilter,
  editedVariant,
  filterKeeps,
  firstVariantsOf,
  isWrittenVariant,
  parseGroupFilter,
  serializeGroupFilter,
  templateFor,
  renderSubjectPlan,
  subjectForGroup,
  threadTemplate,
  unclassifiedWarning,
  type StepSubjectSource,
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

/* ------------------------------- l'objet d'une étape, et son mode ----------- */

/** `renderSubject` du domaine, passée au décideur comme en production. */
const render = (template: string, values: Parameters<typeof renderSubject>[1]) =>
  renderSubject(template, values);

const VALUES = {
  prenom: "Nina",
  nom: "Direction",
  fonction: "Fondatrice",
  societe: "Maison Lune",
  site: "maisonlune.test",
  notresite: "auraflowai.fr",
  video: "",
};

describe("subjectForGroup — l'objet d'une étape, pour un groupe", () => {
  const FIRST_VARIANTS = [
    { group: "direction" as const, subject: "Démo pour {societe}", body: "v1" },
    // Une variante d'étape 1 **sans objet** : elle n'apporte rien au fil.
    { group: "marketing" as const, subject: "", body: "v1 marketing" },
  ];
  const STEPS: (StepSubjectSource & { readonly body: string })[] = [
    { position: 1, subject: "Objet par défaut", body: "b1", variants: FIRST_VARIANTS },
    { position: 2, subject: "Objet à elle", body: "b2" },
    { position: 3, subject: "Dernier message pour {societe}", body: "b3" },
  ];

  it("l'étape 1 porte son propre objet, variante du groupe d'abord", () => {
    expect(subjectForGroup(STEPS, 1, "direction").template).toBe("Démo pour {societe}");
    expect(subjectForGroup(STEPS, 1, "commercial").template).toBe("Objet par défaut");
  });

  it("une relance en mode « Garder » ignore l'objet qu'elle porte", () => {
    const plan = subjectForGroup(STEPS, 2, "direction");
    expect(plan.mode).toBe("thread");
    expect(plan.template, "jamais « Objet à elle »").toBe("Démo pour {societe}");
    expect(subjectForGroup(STEPS, 2, "commercial").template).toBe("Objet par défaut");
  });

  it("une relance en mode « Objet personnalisé » porte le sien", () => {
    const steps = [...STEPS];
    steps[2] = { ...STEPS[2]!, subjectMode: "custom" };
    const plan = subjectForGroup(steps, 3, "commercial");
    expect(plan.mode).toBe("custom");
    expect(plan.template).toBe("Dernier message pour {societe}");
    // Et le fil reste disponible comme repli.
    expect(plan.fallback).toBe("Objet par défaut");
  });

  it("une variante de relance personnalisée l'emporte sur le défaut de l'étape", () => {
    const steps = [...STEPS];
    steps[2] = {
      ...STEPS[2]!,
      subjectMode: "custom",
      variants: [{ group: "direction" as const, subject: "Un mot, {prenom}", body: "b" }],
    };
    expect(subjectForGroup(steps, 3, "direction").template).toBe("Un mot, {prenom}");
    // Un groupe sans variante prend l'objet personnalisé **de l'étape**.
    expect(subjectForGroup(steps, 3, "commercial").template).toBe("Dernier message pour {societe}");
  });

  it("un objet personnalisé vide comme gabarit n'est pas un choix : on garde le fil", () => {
    const steps = [...STEPS];
    steps[1] = { ...STEPS[1]!, subject: "", subjectMode: "custom" };
    expect(subjectForGroup(steps, 2, "direction").template).toBe("Démo pour {societe}");
  });

  it("un mode inconnu vaut « Garder » : jamais une conversation de plus", () => {
    const steps = [...STEPS];
    steps[1] = { ...STEPS[1]!, subjectMode: "n'importe quoi" };
    expect(subjectForGroup(steps, 2, null).template).toBe("Objet par défaut");
  });

  it("en mode « Garder », le repli est l'objet retenu : il n'y a rien à rattraper", () => {
    const plan = subjectForGroup(STEPS, 2, "direction");
    expect(plan.fallback).toBe(plan.template);
  });
});

describe("renderSubjectPlan — jamais d'objet vide", () => {
  const STEPS = [
    { position: 1, subject: "Démo pour {societe}", body: "b1" },
    // Un objet personnalisé qui ne porte qu'un prénom : non vide comme gabarit,
    // **vide une fois rendu** pour une fiche sans prénom.
    { position: 2, subject: "{prenom}", subjectMode: "custom", body: "b2" },
  ];

  it("rend l'objet personnalisé quand il donne quelque chose", () => {
    const rendered = renderSubjectPlan(subjectForGroup(STEPS, 2, null), VALUES, render);
    expect(rendered.subject).toBe("Nina");
    expect(rendered.usedFallback).toBe(false);
  });

  it("retombe sur l'objet du fil quand le rendu est vide, et le dit", () => {
    const rendered = renderSubjectPlan(
      subjectForGroup(STEPS, 2, null),
      { ...VALUES, prenom: "" },
      render,
    );
    expect(rendered.subject, "jamais un Subject: vide").toBe("Démo pour Maison Lune");
    expect(rendered.usedFallback, "et l'aperçu peut le nommer").toBe(true);
  });

  it("ne prétend pas replier quand le fil est vide lui aussi", () => {
    const steps = [
      { position: 1, subject: "", body: "b1" },
      { position: 2, subject: "{prenom}", subjectMode: "custom", body: "b2" },
    ];
    const rendered = renderSubjectPlan(
      subjectForGroup(steps, 2, null),
      { ...VALUES, prenom: "" },
      render,
    );
    expect(rendered.subject).toBe("");
    expect(rendered.usedFallback).toBe(false);
  });
});

describe("threadTemplate — l'empreinte et l'aperçu voient le même objet", () => {
  const FIRST = [{ group: "direction" as const, subject: "Démo pour {societe}", body: "v1" }];
  const STEPS: (StepSubjectSource & { readonly body: string })[] = [
    { position: 1, subject: "", body: "défaut 1", variants: FIRST },
    { position: 2, subject: "", body: "Corps par défaut de l'étape 2." },
  ];

  it("l'objet du groupe atteint le gabarit composé", () => {
    const thread = threadTemplate(STEPS, 2, [
      { group: "direction", subject: "", body: "relance Direction" },
    ]);
    const chosen = templateFor(thread.step, thread.variants, "direction");
    expect(chosen.subject).toBe("Démo pour {societe}");
    expect(chosen.body).toBe("relance Direction");
  });

  /*
    **Mesuré, et c'est le point que le rapport du jalon 103 laissait ambigu :**
    la variante synthétisée porte un corps vide, et `templateFor` retombe alors
    sur le corps **par défaut de l'étape**. Le départ n'est donc jamais vide.
  */
  it("un groupe sans variante de relance reçoit le corps par défaut de l'étape", () => {
    const thread = threadTemplate(STEPS, 2, []);
    expect(thread.variants).toEqual([
      { group: "direction", subject: "Démo pour {societe}", body: "" },
    ]);
    const chosen = templateFor(thread.step, thread.variants, "direction");
    expect(chosen.subject).toBe("Démo pour {societe}");
    expect(chosen.body, "le corps vient de l'étape, jamais vide").toBe(
      "Corps par défaut de l'étape 2.",
    );
  });

  it("un objet personnalisé entre dans le gabarit, donc dans l'empreinte", () => {
    const steps = [...STEPS];
    steps[1] = { ...STEPS[1]!, subject: "Nouvelle conversation", subjectMode: "custom" };
    const thread = threadTemplate(steps, 2, []);
    expect(thread.step.subject).toBe("Nouvelle conversation");
  });

  it("l'étape 1 n'est pas touchée : ses variantes gardent leur objet", () => {
    const thread = threadTemplate(STEPS, 1, FIRST);
    expect(templateFor(thread.step, thread.variants, "direction").subject).toBe(
      "Démo pour {societe}",
    );
  });
});

describe("firstVariantsOf", () => {
  it("lit les variantes de la plus petite position, et écarte un groupe inconnu", () => {
    const steps = [
      { position: 2, subject: "", variants: [{ group: "direction", subject: "s2", body: "b2" }] },
      {
        position: 1,
        subject: "",
        variants: [
          { group: "direction", subject: "s1", body: "b1" },
          { group: "inconnu", subject: "x", body: "y" },
        ],
      },
    ];
    expect(firstVariantsOf(steps)).toEqual([{ group: "direction", subject: "s1", body: "b1" }]);
  });

  it("rend une liste vide quand rien n'est chargé", () => {
    expect(firstVariantsOf([{ position: 1, subject: "" }])).toEqual([]);
    expect(firstVariantsOf([])).toEqual([]);
  });
});

describe("describeSubjectPlan — un repli ne passe jamais pour un choix", () => {
  const STEPS = [
    { position: 1, subject: "Démo", body: "b1" },
    { position: 2, subject: "Perso", subjectMode: "custom", body: "b2" },
  ];

  it("nomme le mode, la variante et le repli", () => {
    expect(describeSubjectPlan(subjectForGroup(STEPS, 1, null), null, false)).toBe(
      "objet de l'étape 1",
    );
    expect(describeSubjectPlan(subjectForGroup(STEPS, 2, null), null, false)).toBe(
      "objet personnalisé de cette étape",
    );
    expect(describeSubjectPlan(subjectForGroup(STEPS, 2, null), "direction", true)).toContain(
      "rendait une chaîne vide",
    );
  });
});
