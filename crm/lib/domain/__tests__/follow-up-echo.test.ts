import { describe, expect, it } from "vitest";
import { comparableWords, describeEcho, echoOf, openingSentence } from "../follow-up-echo";

const STEP1 = `Bonjour Stéphanie,

69 % des visiteurs quittent un site après une question restée sans réponse, sans
même avoir pris le temps de la poser.

J'ai préparé une démonstration de ce que cela donnerait sur linae.fr.
Dites-le-moi en réponse et je vous envoie le lien.

À bientôt,
Yanis Tidahy
Fondateur, Aura Flow AI`;

describe("ce qui compte dans la comparaison", () => {
  it("la salutation et la signature sont retirées", () => {
    const words = comparableWords(STEP1);
    expect(words).not.toContain("bonjour");
    expect(words).not.toContain("stephanie");
    // Tout ce qui suit la formule de clôture est de la signature.
    expect(words).not.toContain("fondateur");
    expect(words).not.toContain("tidahy");
  });

  it("les accents et la ponctuation ne décident de rien", () => {
    expect(comparableWords("Bonjour,\n\nDéjà vu !")).toEqual(["deja", "vu"]);
  });
});

describe("une relance qui recopie se signale", () => {
  it("la phrase de démonstration reprise mot pour mot est nommée", () => {
    const copie = `Bonjour Stéphanie,

Un mot sur votre boutique.

J'ai préparé une démonstration de ce que cela donnerait sur linae.fr.
Dites-le-moi en réponse et je vous envoie le lien.

À bientôt,`;
    const verdict = echoOf(STEP1, copie);
    expect(verdict.run).toContain("demonstration de ce que cela donnerait");
    expect(describeEcho(verdict)).toContain("elle en reprend");
  });

  it("une ouverture identique se signale à part", () => {
    const verdict = echoOf(STEP1, STEP1);
    expect(verdict.sameOpening).toBe(true);
    expect(describeEcho(verdict)).toContain("elle ouvre comme le message précédent");
  });

  it("la relance approuvée ne déclenche rien", () => {
    // Le texte validé à la main : il renvoie au premier message sans le
    // reprendre. S'il sonnait, la garde serait inutilisable.
    const etape2 = `Bonjour Stéphanie,

Il y a plusieurs formats sur votre page de recharges. C'est typiquement le genre
de choix sur lequel on hésite, et qui se tranche en deux phrases quand quelqu'un
est là pour répondre.

C'est exactement ce que montre la démonstration dont je vous parlais.

Vous voulez que je vous envoie le lien ?

À bientôt,`;
    const verdict = echoOf(STEP1, etape2);
    expect(verdict.sameOpening).toBe(false);
    expect(verdict.run).toBe("");
    expect(describeEcho(verdict)).toBe("");
  });

  it("sept mots communs ne suffisent pas, huit oui", () => {
    const sept = "un deux trois quatre cinq six sept";
    const huit = `${sept} huit`;
    expect(echoOf(`Bonjour,\n\n${sept}\n\nÀ bientôt,`, `Bonjour,\n\n${sept}\n\nÀ bientôt,`).run).toBe("");
    expect(echoOf(`Bonjour,\n\n${huit}\n\nÀ bientôt,`, `Bonjour,\n\n${huit}\n\nÀ bientôt,`).run).toBe(huit);
  });

  it("un message précédent vide ne signale rien", () => {
    expect(echoOf("", STEP1)).toEqual({ sameOpening: false, run: "" });
  });
});

describe("l'ouverture", () => {
  it("se compare sur une fenêtre fixe de mots utiles", () => {
    expect(openingSentence(STEP1).startsWith("69 des visiteurs quittent")).toBe(true);
  });
});
