import { describe, expect, it } from "vitest";
import { historyLossWarning, nameConfirms } from "../campaign-deletion";

describe("le texte qui dit ce qui part", () => {
  it("accorde chaque nombre indépendamment", () => {
    expect(historyLossWarning({ messages: 1, opens: 1, replies: 1 })).toBe(
      "1 message envoyé, 1 ouverture, 1 réponse seront retirés de vos statistiques. " +
        "Les contacts et leur historique de conversation restent intacts — seule l'attribution " +
        "à cette campagne disparaît.",
    );
    expect(historyLossWarning({ messages: 47, opens: 12, replies: 3 })).toBe(
      "47 messages envoyés, 12 ouvertures, 3 réponses seront retirés de vos statistiques. " +
        "Les contacts et leur historique de conversation restent intacts — seule l'attribution " +
        "à cette campagne disparaît.",
    );
  });

  it("un nombre à zéro reste au singulier — ce n'est pas « 0 messages »", () => {
    expect(historyLossWarning({ messages: 5, opens: 0, replies: 1 })).toContain("0 ouverture,");
  });

  it("les trois comptes peuvent diverger sans se contaminer", () => {
    // 1 message, plusieurs ouvertures (rechargé), aucune réponse.
    expect(historyLossWarning({ messages: 1, opens: 4, replies: 0 })).toBe(
      "1 message envoyé, 4 ouvertures, 0 réponse seront retirés de vos statistiques. " +
        "Les contacts et leur historique de conversation restent intacts — seule l'attribution " +
        "à cette campagne disparaît.",
    );
  });

  it("dit toujours que les contacts restent intacts", () => {
    expect(historyLossWarning({ messages: 0, opens: 0, replies: 0 })).toContain(
      "Les contacts et leur historique de conversation restent intacts",
    );
  });
});

describe("le nom tapé confirme, ou pas", () => {
  it("accepte une correspondance exacte", () => {
    expect(nameConfirms("Prospection SAV — septembre", "Prospection SAV — septembre")).toBe(true);
  });

  it("tolère les espaces de bord de la saisie", () => {
    expect(nameConfirms("  Prospection SAV — septembre  ", "Prospection SAV — septembre")).toBe(true);
  });

  it("refuse une casse différente — la friction est délibérée", () => {
    expect(nameConfirms("prospection sav — septembre", "Prospection SAV — septembre")).toBe(false);
  });

  it("refuse un sous-ensemble du nom", () => {
    expect(nameConfirms("Prospection SAV", "Prospection SAV — septembre")).toBe(false);
  });

  it("refuse une chaîne vide, même contre un nom qui ne le serait pas", () => {
    expect(nameConfirms("", "Prospection SAV")).toBe(false);
    expect(nameConfirms("   ", "Prospection SAV")).toBe(false);
  });

  it("refuse un nom approchant, avec une seule lettre en trop", () => {
    expect(nameConfirms("Prospection SAVE", "Prospection SAV")).toBe(false);
  });
});
