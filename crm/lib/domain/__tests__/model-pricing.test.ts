import { describe, expect, it } from "vitest";
import {
  ANOMALY_FACTOR,
  BUDGET_WARN_RATIO,
  budgetState,
  costMicros,
  DEFAULT_MODELS,
  EXPECTED_MICROS,
  findModel,
  formatCost,
  isAnomalous,
  isKnownModel,
  MODELS,
  PURPOSES,
} from "../model-pricing";

/**
 * **Le coût se calcule, il ne s'estime pas.**
 *
 * Le seul chiffre dont on disposait avant ce jalon était « environ 20 cents par
 * email », obtenu en regardant une facture. Ces tests fixent la seule chose qui
 * transforme cette impression en mesure : la formule, et les tarifs relus dans
 * la référence de l'API le 18 août 2026.
 */

describe("les tarifs", () => {
  it("porte les quatre modèles proposés, du moins cher au plus cher", () => {
    expect(MODELS.map((model) => model.id)).toEqual([
      "claude-haiku-4-5",
      "claude-sonnet-5",
      "claude-opus-5",
      "claude-fable-5",
    ]);
    for (let index = 1; index < MODELS.length; index += 1) {
      expect(MODELS[index]!.input).toBeGreaterThan(MODELS[index - 1]!.input);
    }
  });

  it("les tarifs sont ceux de la référence", () => {
    expect(findModel("claude-opus-5")).toMatchObject({ input: 5, output: 25 });
    expect(findModel("claude-sonnet-5")).toMatchObject({ input: 2, output: 10 });
    expect(findModel("claude-haiku-4-5")).toMatchObject({ input: 1, output: 5 });
    expect(findModel("claude-fable-5")).toMatchObject({ input: 10, output: 50 });
  });

  it("sait qu'un modèle sans réflexion adaptative existe", () => {
    // C'est ce fait qui empêche `requestFor()` d'envoyer un champ refusé.
    expect(findModel("claude-haiku-4-5")?.adaptiveThinking).toBe(false);
    expect(findModel("claude-sonnet-5")?.adaptiveThinking).toBe(true);
  });

  it("refuse un identifiant inconnu", () => {
    expect(isKnownModel("claude-opus-4-1")).toBe(false);
    expect(findModel("gpt-4")).toBeNull();
  });

  it("les défauts par usage sont tous des modèles connus", () => {
    for (const purpose of PURPOSES) expect(isKnownModel(DEFAULT_MODELS[purpose])).toBe(true);
  });

  it("garde le plus fort pour la vacation, le milieu de gamme pour écrire", () => {
    const draft = findModel(DEFAULT_MODELS.draft)!;
    const shift = findModel(DEFAULT_MODELS.shift)!;
    expect(draft.input).toBeLessThan(shift.input);
    expect(DEFAULT_MODELS.revision).toBe(DEFAULT_MODELS.draft);
  });
});

describe("le calcul du coût", () => {
  const usage = { input: 4000, output: 800, thinking: null, cacheRead: 0, cacheWrite: 0 };

  it("additionne entrée et sortie au tarif du modèle", () => {
    // Opus 5 : 4000 × 5 / 1M + 800 × 25 / 1M = 0,02 + 0,02 = 0,04 $
    expect(costMicros("claude-opus-5", usage)).toBe(40_000);
    // Sonnet 5 : 0,008 + 0,008 = 0,016 $ — 2,5 fois moins, exactement.
    expect(costMicros("claude-sonnet-5", usage)).toBe(16_000);
  });

  /**
   * **La réflexion n'est pas un troisième terme.** Elle fait partie de la
   * sortie et est facturée comme elle : l'ajouter au calcul la compterait deux
   * fois, et gonflerait la facture affichée sans que rien ne le signale.
   */
  it("ne facture pas la réflexion en plus de la sortie", () => {
    const avec = { ...usage, thinking: 500 };
    expect(costMicros("claude-opus-5", avec)).toBe(costMicros("claude-opus-5", usage));
  });

  it("facture la lecture de cache au dixième et l'écriture à 1,25", () => {
    const cache = { input: 0, output: 0, thinking: null, cacheRead: 10_000, cacheWrite: 10_000 };
    // 10 000 × 0,5 / 1M + 10 000 × 6,25 / 1M = 0,005 + 0,0625
    expect(costMicros("claude-opus-5", cache)).toBe(67_500);
  });

  it("rend zéro plutôt que de deviner sur un modèle inconnu", () => {
    // Un tarif inventé serait pire qu'un trou : il s'additionnerait au mois.
    expect(costMicros("modèle-inconnu", usage)).toBe(0);
  });

  it("affiche quatre décimales sous le dollar, deux au-delà", () => {
    expect(formatCost(197_400)).toBe("0,1974 $");
    expect(formatCost(12_500_000)).toBe("12,50 $");
  });
});

describe("les anomalies", () => {
  it("ne signale rien à l'ordinaire", () => {
    expect(isAnomalous("draft", EXPECTED_MICROS.draft)).toBe(false);
    expect(isAnomalous("draft", EXPECTED_MICROS.draft * ANOMALY_FACTOR)).toBe(false);
  });

  it("signale un appel qui coûte un multiple de son ordinaire", () => {
    // Un contexte qui a gonflé, une boucle d'outils qui tourne : dans les deux
    // cas c'est un défaut, et il doit laisser une trace au lieu d'être avalé.
    expect(isAnomalous("draft", EXPECTED_MICROS.draft * ANOMALY_FACTOR + 1)).toBe(true);
  });
});

describe("le plafond mensuel", () => {
  it("n'existe pas quand aucun plafond n'est réglé", () => {
    // Zéro pour cent d'un plafond inexistant n'est pas une jauge à zéro : c'est
    // l'absence de dénominateur. Même règle que les taux du jalon 20.
    expect(budgetState(500_000, 0)).toBeNull();
  });

  it("prévient à 80 %, refuse à 100 %", () => {
    const ceiling = 20_000_000;
    expect(budgetState(ceiling * 0.5, ceiling)?.level).toBe("ok");
    expect(budgetState(ceiling * BUDGET_WARN_RATIO, ceiling)?.level).toBe("warn");
    expect(budgetState(ceiling * 0.99, ceiling)?.level).toBe("warn");
    expect(budgetState(ceiling, ceiling)?.level).toBe("over");
    expect(budgetState(ceiling * 2, ceiling)?.level).toBe("over");
  });
});
