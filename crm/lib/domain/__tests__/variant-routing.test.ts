import { describe, expect, it } from "vitest";
import {
  describeRouting,
  describeSubjectSource,
  effectiveSubject,
  OTHER_ROUTINGS,
  routedGroup,
  ROUTING_LABELS,
  templateFor,
  toOtherRouting,
  type StepVariant,
} from "../step-variants";
import { droppedSentences, missingSentenceValues, renderTemplate } from "../merge-tags";

/**
 * **Le routage d'« Autre », l'objet qui ne peut pas être vide, et la phrase
 * retirée qui se voit.**
 *
 * Les trois tiennent à la même exigence : ce que l'écran annonce est exactement
 * ce qui partira. Un routage recalculé ailleurs, un objet vide passé en silence
 * ou une phrase supprimée sans être dite sont trois façons d'envoyer autre
 * chose que ce qu'on a relu.
 */

const STEP = { subject: "Objet par défaut", body: "Message par défaut." };

const VARIANTS: StepVariant[] = [
  { group: "direction", subject: "Pour la direction", body: "ROI." },
  // **Une variante sans objet, et c'est le cas fréquent** : l'objet est souvent
  // le même pour les quatre groupes.
  { group: "marketing", subject: "", body: "Conversion." },
];

describe("le routage d'« Autre » et des fiches non classées", () => {
  it("« Message par défaut » reproduit le comportement d'avant le réglage", () => {
    /*
      Les deux branches diffèrent, et c'est exactement ce qui préserve le passé :
      une fiche « Autre » gardait sa variante « Autre » quand une campagne en
      avait écrit une, une fiche jamais classée recevait le défaut de l'étape.
      Les fondre en un seul `null` aurait privé de sa variante toute campagne
      existante qui en a écrit une.
    */
    expect(routedGroup("autre", "auto", "default")).toBe("autre");
    expect(routedGroup("autre", "none", "default")).toBeNull();
    // Aucune variante « Autre » ici : le repli ordinaire rend donc le défaut.
    expect(templateFor(STEP, VARIANTS, routedGroup("autre", "auto", "default"))).toEqual({
      ...STEP,
      variantOf: null,
      subjectFromStep: false,
    });
    // Et si une campagne en a écrit une, elle la garde.
    const withAutre: StepVariant[] = [...VARIANTS, { group: "autre", subject: "A", body: "B" }];
    expect(
      templateFor(STEP, withAutre, routedGroup("autre", "auto", "default")).variantOf,
    ).toBe("autre");
    expect(
      templateFor(STEP, withAutre, routedGroup("autre", "none", "default")).variantOf,
    ).toBeNull();
  });

  it("une fiche « Autre » et une fiche jamais classée sont routées ensemble", () => {
    // Dans les deux cas personne n'a d'angle à leur servir : c'est la campagne
    // qui tranche, pas notre retard de classement.
    expect(routedGroup("autre", "auto", "direction")).toBe("direction");
    expect(routedGroup("autre", "manual", "marketing")).toBe("marketing");
    expect(routedGroup("autre", "none", "direction")).toBe("direction");
    expect(routedGroup("direction", "none", "commercial")).toBe("commercial");
  });

  it("un groupe lu sur la fiche n'est jamais routé ailleurs", () => {
    for (const routing of OTHER_ROUTINGS) {
      expect(routedGroup("direction", "auto", routing)).toBe("direction");
      expect(routedGroup("marketing", "manual", routing)).toBe("marketing");
      expect(routedGroup("commercial", "auto", routing)).toBe("commercial");
    }
  });

  it("une valeur inconnue retombe sur le défaut, elle ne devient pas une panne", () => {
    expect(toOtherRouting("legacy")).toBe("default");
    expect(toOtherRouting("")).toBe("default");
    expect(toOtherRouting("commercial")).toBe("commercial");
  });

  it("les compteurs disent le routage, et se taisent quand personne n'est concerné", () => {
    expect(describeRouting({ autre: 6, unclassified: 2 }, "direction")).toBe(
      "Autre 6 · Non classé 2 → reçoivent Direction",
    );
    expect(describeRouting({ autre: 6, unclassified: 0 }, "direction")).toBe(
      "Autre 6 → reçoivent Direction",
    );
    expect(describeRouting({ autre: 6, unclassified: 0 }, "default")).toBe(
      "Autre 6 → reçoivent le message par défaut de l'étape",
    );
    expect(describeRouting({ autre: 0, unclassified: 0 }, "direction")).toBe("");
  });

  it("chaque routage porte un libellé, sans quoi un bouton sortirait vide", () => {
    for (const routing of OTHER_ROUTINGS) {
      expect(ROUTING_LABELS[routing].trim()).not.toBe("");
    }
  });
});

describe("jamais d'objet vide", () => {
  it("une variante sans objet retombe explicitement sur celui de l'étape", () => {
    const chosen = templateFor(STEP, VARIANTS, "marketing");
    expect(chosen.body).toBe("Conversion.");
    expect(chosen.subject).toBe("Objet par défaut");
    expect(chosen.subjectFromStep).toBe(true);
  });

  it("l'aperçu dit quel objet partira, et d'où il vient", () => {
    expect(describeSubjectSource(templateFor(STEP, VARIANTS, "marketing"))).toBe(
      "objet du message par défaut (la variante « Marketing & digital » n'en porte pas)",
    );
    expect(describeSubjectSource(templateFor(STEP, VARIANTS, "direction"))).toBe(
      "objet de la variante « Direction »",
    );
    expect(describeSubjectSource(templateFor(STEP, VARIANTS, null))).toBe(
      "objet du message par défaut",
    );
  });

  it("aucun objet nulle part : c'est le seul cas refusé", () => {
    expect(effectiveSubject({ subject: "  ", body: "x" }, { subject: " ", body: "y" })).toBeNull();
    expect(effectiveSubject({ subject: "Défaut", body: "x" }, { subject: " ", body: "y" })).toBe(
      "Défaut",
    );
    expect(effectiveSubject({ subject: " ", body: "x" }, { subject: "À moi", body: "y" })).toBe(
      "À moi",
    );
    expect(effectiveSubject({ subject: " ", body: "x" }, undefined)).toBeNull();
  });

  it("un objet vide ne peut donc jamais atteindre le rendu", () => {
    // La garantie qui compte : quelle que soit la variante choisie, l'objet
    // rendu n'est vide que si l'étape elle-même n'en porte pas — et ce cas est
    // refusé à l'enregistrement.
    for (const group of [null, "direction", "marketing", "commercial", "autre"] as const) {
      expect(templateFor(STEP, VARIANTS, group).subject.trim()).not.toBe("");
    }
  });
});

describe("la phrase retirée se voit", () => {
  const BODY =
    "Bonjour {prenom},\n\nEn regardant {societe}, j'ai remarqué votre gamme. " +
    "Mais il y a une partie du trafic qui se perd.";

  const NO_COMPANY = {
    prenom: "Clement",
    nom: "Daniel",
    fonction: "Fondateur",
    societe: "",
    site: "exemple.fr",
    video: "",
  };

  it("elle est nommée, et la phrase est rendue telle qu'elle est écrite", () => {
    const dropped = droppedSentences(BODY, NO_COMPANY);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]?.label).toBe("société absente");
    expect(dropped[0]?.sentence).toBe("En regardant {societe}, j'ai remarqué votre gamme.");
  });

  it("ce qu'elle annonce est exactement ce que le rendu retire", () => {
    // La garantie qui rend l'avertissement utile : même découpage que
    // `dropSentencesWith`, donc aucune phrase annoncée qui survivrait, et
    // aucune phrase disparue en silence.
    const rendered = renderTemplate(BODY, NO_COMPANY);
    for (const entry of droppedSentences(BODY, NO_COMPANY)) {
      const words = entry.sentence.replace(/\{[a-z]+\}/g, "").trim();
      expect(rendered).not.toContain(words);
    }
    expect(rendered).toContain("Mais il y a une partie du trafic qui se perd.");
  });

  it("`{marque}` est ramenée à `{societe}` avant tout", () => {
    const dropped = droppedSentences("On suit {marque} depuis un moment.", NO_COMPANY);
    expect(dropped).toHaveLength(1);
    expect(dropped[0]?.tag).toBe("{societe}");
  });

  it("rien n'est annoncé quand toutes les valeurs sont là", () => {
    expect(
      droppedSentences(BODY, { ...NO_COMPANY, societe: "Maison Vertu" }),
    ).toHaveLength(0);
  });

  it("le panneau de campagne nomme la valeur qui manque, pas la balise", () => {
    expect(missingSentenceValues(BODY, NO_COMPANY)).toEqual(["société"]);
    expect(missingSentenceValues(BODY, { ...NO_COMPANY, societe: "X", site: "" })).toEqual([]);
    expect(
      missingSentenceValues("Sur {site}, {fonction} compte.", {
        ...NO_COMPANY,
        site: "",
        fonction: "",
      }),
      // L'ordre est celui de la table, pas celui du gabarit : deux lignes du
      // panneau ne doivent pas changer de place d'un texte à l'autre.
    ).toEqual(["fonction", "site"]);
  });
});
