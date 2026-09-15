import { describe, expect, it } from "vitest";
import {
  STATUS_LABELS,
  campaignStatus,
  draftReason,
  sequenceProgress,
} from "../campaign-status";

describe("l'état d'une campagne est dérivé", () => {
  it("archivée l'emporte sur tout le reste", () => {
    // C'est une décision, pas un calcul : une campagne archivée qui porterait
    // encore des inscrits actifs se lirait « En cours » alors qu'elle est close.
    expect(campaignStatus({ archived: true, hasBrief: true, enrolled: 40 })).toBe("archived");
    expect(campaignStatus({ archived: true, hasBrief: false, enrolled: 0 })).toBe("archived");
  });

  it("« brouillon » veut dire « ne peut pas envoyer »", () => {
    expect(campaignStatus({ archived: false, hasBrief: false, enrolled: 40 })).toBe("draft");
    expect(campaignStatus({ archived: false, hasBrief: true, enrolled: 0 })).toBe("draft");
    expect(campaignStatus({ archived: false, hasBrief: true, enrolled: 1 })).toBe("running");
  });

  it("la cause du brouillon est nommée, jamais devinée", () => {
    expect(draftReason({ hasBrief: false, enrolled: 0 })).toContain("personne d'inscrit");
    expect(draftReason({ hasBrief: false, enrolled: 3 })).toBe(
      "Aucune étape ne porte de consigne.",
    );
    expect(draftReason({ hasBrief: true, enrolled: 0 })).toBe("Personne n'est encore inscrit.");
    expect(draftReason({ hasBrief: true, enrolled: 3 })).toBeNull();
  });

  it("chaque état porte un libellé", () => {
    for (const status of ["archived", "running", "draft"] as const) {
      expect(STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });
});

describe("l'avancement mesure des messages dus", () => {
  it("rien à envoyer ne vaut pas cent pour cent", () => {
    // Une division par zéro rendue en « 100 % » ferait lire une campagne vide
    // comme une campagne terminée.
    expect(sequenceProgress({ enrolled: 0, steps: 3, delivered: 0 }).ratio).toBe(0);
    expect(sequenceProgress({ enrolled: 5, steps: 0, delivered: 0 }).ratio).toBe(0);
  });

  it("le dénominateur ne recule pas quand quelqu'un répond", () => {
    // Une inscription arrêtée n'enverra pas ses étapes restantes ; les retirer
    // du total ferait grimper la barre à chaque réponse, c'est-à-dire quand la
    // campagne réussit.
    const before = sequenceProgress({ enrolled: 10, steps: 3, delivered: 10 });
    expect(before.ratio).toBeCloseTo(10 / 30);
    expect(before.label).toContain("sur 30");
  });

  it("l'étape moyenne se lit avec sa décimale", () => {
    // « étape 1,4/3 » dit qu'une partie des inscrits est passée à la deuxième,
    // ce qu'un arrondi à l'entier cacherait.
    expect(sequenceProgress({ enrolled: 10, steps: 3, delivered: 14 }).label).toContain("1,4/3");
    expect(sequenceProgress({ enrolled: 10, steps: 3, delivered: 10 }).label).toContain("1/3");
  });

  it("un compte aberrant est borné plutôt que rendu tel quel", () => {
    const over = sequenceProgress({ enrolled: 2, steps: 1, delivered: 9 });
    expect(over.ratio).toBe(1);
    expect(over.label).toContain("2 messages sur 2");
    expect(over.label).toContain("1/1");
  });
});
