import { describe, expect, it } from "vitest";
import {
  MERGE_TAGS,
  renderSubject,
  renderTemplate,
  toStepMode,
  unknownTags,
  unresolvedTags,
  type MergeValues,
} from "../merge-tags";
import { repairGreeting } from "../contact-identity";

const full: MergeValues = {
  prenom: "Roxana",
  societe: "Dermoplant",
  site: "dermoplant.fr",
  video: "Voir la démonstration en vidéo",
};

describe("toStepMode", () => {
  it("retombe sur Alex pour toute valeur inconnue", () => {
    expect(toStepMode("manual")).toBe("manual");
    expect(toStepMode("alex")).toBe("alex");
    expect(toStepMode("")).toBe("alex");
    expect(toStepMode("manuel")).toBe("alex");
  });
});

describe("renderTemplate", () => {
  const body =
    "Bonjour {prenom},\n\nEn regardant {societe}, une part des questions se ressemble.\n\nJ'ai préparé une démonstration sur {site}. Dites-moi si vous voulez la voir.\n\nBien à vous,";

  it("remplace les trois balises quand tout est connu", () => {
    const out = renderTemplate(body, full);
    expect(out).toContain("Bonjour Roxana,");
    expect(out).toContain("En regardant Dermoplant,");
    expect(out).toContain("une démonstration sur dermoplant.fr.");
    expect(out).not.toMatch(/[{}]/);
  });

  it("sans site : la phrase qui le cite est retirée, le reste survit", () => {
    const out = renderTemplate(body, { ...full, site: "" });
    expect(out).not.toContain("{site}");
    expect(out).not.toContain("démonstration");
    // La phrase voisine du même paragraphe reste : on ne coupe pas au-delà.
    expect(out).toContain("Dites-moi si vous voulez la voir.");
    expect(out).toContain("En regardant Dermoplant,");
  });

  it("sans société : la phrase qui la nomme est retirée", () => {
    const out = renderTemplate(body, { ...full, societe: "" });
    expect(out).not.toContain("{societe}");
    expect(out).not.toContain("En regardant");
    expect(out).toContain("dermoplant.fr");
  });

  it("sans prénom : l'appel ne pend pas, et aucun nom n'est inventé", () => {
    const out = repairGreeting(renderTemplate(body, { ...full, prenom: "" }), {
      firstName: "",
      lastName: "",
      email: "contact@dermoplant.fr",
      instagram: "",
      company: { name: "Dermoplant" },
    });
    expect(out.split("\n")[0]).toBe("Bonjour,");
    expect(out).not.toContain("Bonjour ,");
    expect(out).not.toContain("Dermoplant,\n");
  });

  it("sans vidéo : la phrase qui l'annonce disparaît proprement", () => {
    /*
      La demande était explicite : « jamais un lien mort, jamais du texte
      {video} littéral ». La phrase entière part, comme pour `{site}` — un
      « Voici une courte vidéo :  » laisserait un deux-points suspendu, et le
      destinataire lirait une fusion ratée.
    */
    const template =
      "Bonjour {prenom},\n\nVoici une courte vidéo : {video}. Elle dure deux minutes.";
    const out = renderTemplate(template, { ...full, video: "" });
    expect(out).not.toContain("{video}");
    expect(out).not.toContain("Voici une courte vidéo");
    expect(out).not.toContain(":");
    // La phrase voisine survit : on ne coupe pas au-delà de celle qui portait
    // la balise.
    expect(out).toContain("Elle dure deux minutes.");
  });

  it("avec vidéo : c'est le libellé qui est écrit, jamais l'adresse", () => {
    /*
      Le gabarit reçoit un texte, et c'est la couche d'envoi qui en fait une
      vignette cliquable côté HTML et « Libellé : https://… » côté texte (le
      motif du lien de démonstration, jalon 34). Écrire l'adresse ici la
      rendrait nue dans les deux parties, et la vignette n'aurait plus de mot
      sur lequel s'accrocher.
    */
    const out = renderTemplate("Voici une vidéo : {video}.", full);
    expect(out).toContain("Voici une vidéo : Voir la démonstration en vidéo.");
    expect(out).not.toMatch(/https?:/);
  });

  it("ne laisse ni double espace, ni ligne vide en trop", () => {
    const out = renderTemplate("Un mot {societe} puis un autre.\n\n\n\nFin.", {
      ...full,
      societe: "",
    });
    expect(out).toBe("Fin.");
  });

  it("un paragraphe entièrement retiré ne laisse pas de trou", () => {
    const out = renderTemplate("Un.\n\nSeulement {site}.\n\nTrois.", { ...full, site: "" });
    expect(out).toBe("Un.\n\nTrois.");
  });

  it("ne coupe jamais une phrase sur une balise déjà remplacée", () => {
    // La valeur contient un point : si l'on substituait d'abord, la phrase
    // serait découpée au milieu du domaine.
    const out = renderTemplate("Voir {site}. Merci.", full);
    expect(out).toBe("Voir dermoplant.fr. Merci.");
  });
});

describe("unresolvedTags et {video}", () => {
  it("annonce la balise sans valeur, avant d'enregistrer", () => {
    expect(unresolvedTags("Objet {video}", { ...full, video: "" })).toContain("{video}");
    expect(unresolvedTags("Objet {video}", full)).toEqual([]);
  });

  it("{video} est une balise connue du produit", () => {
    // Sans cela, l'éditeur la signalerait comme une faute de frappe et elle
    // partirait pourtant remplacée : deux écrans qui se contredisent.
    expect(unknownTags("Objet {video}")).toEqual([]);
    expect(MERGE_TAGS.map((tag) => tag.tag)).toContain("{video}");
  });
});

describe("renderSubject", () => {
  it("retire la balise sans vider la ligne", () => {
    expect(renderSubject("Une démonstration pour {societe}", full)).toBe(
      "Une démonstration pour Dermoplant",
    );
    expect(renderSubject("Une démonstration pour {societe}", { ...full, societe: "" })).toBe(
      "Une démonstration pour",
    );
  });

  it("reste sur une seule ligne", () => {
    expect(renderSubject("Bonjour\n{prenom}", full)).toBe("Bonjour Roxana");
  });
});

describe("les balises annoncées", () => {
  it("nomme celles qui manqueront à ce contact", () => {
    expect(unresolvedTags("Bonjour {prenom}, sur {site}", { ...full, site: "" })).toEqual([
      "{site}",
    ]);
    expect(unresolvedTags("Bonjour {prenom}", full)).toEqual([]);
  });

  it("attrape une balise inventée, qui partirait telle quelle", () => {
    expect(unknownTags("Bonjour {prénom}, chez {societe}")).toEqual(["{prénom}"]);
    expect(unknownTags("Bonjour {prenom}")).toEqual([]);
  });

  it("chaque balise du produit dit ce qui se passe sans valeur", () => {
    for (const tag of MERGE_TAGS) {
      expect(tag.fallback.length).toBeGreaterThan(10);
      expect(unknownTags(tag.tag)).toEqual([]);
    }
  });
});
