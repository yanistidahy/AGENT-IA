import { describe, expect, it } from "vitest";
import {
  DEFAULT_DRAFT_TOKENS,
  INLINE_MAX,
  MIN_SAMPLE,
  describeCost,
  describeEstimate,
  estimateComposition,
} from "../compose-estimate";

/** Sonnet 5 au tarif du jalon 36 : 2 $ / M en entrée, 10 $ / M en sortie. */
const sonnet = (usage: { input: number; output: number }): number =>
  Math.round((2 * usage.input) / 1_000_000 * 1_000_000 + (10 * usage.output) / 1_000_000 * 1_000_000);

const plan = (drafts: number, sample: Parameters<typeof estimateComposition>[0]["sample"]) =>
  estimateComposition({ drafts, model: "claude-sonnet-5", sample, price: sonnet });

describe("l'estimation d'une composition", () => {
  it("retrouve les deux centimes par brouillon annoncés au jalon 36", () => {
    const one = plan(1, null);
    // 3000 × 2 $/M + 1500 × 10 $/M = 0,006 + 0,015 = 0,021 $
    expect(one.micros).toBe(21_000);
    expect(describeCost(one.micros)).toBe("0,02 $");
    expect(one.source).toBe("default");
  });

  it("multiplie par le nombre de brouillons — cinquante coûtent cinquante fois un", () => {
    expect(plan(50, null).micros).toBe(50 * plan(1, null).micros);
    expect(describeCost(plan(50, null).micros)).toBe("1,05 $");
  });

  it("préfère les jetons réellement facturés dès qu'il y en a assez", () => {
    const measured = plan(1, { calls: MIN_SAMPLE, inputTokens: 6000, outputTokens: 3000 });
    expect(measured.source).toBe("measured");
    // Deux fois le contexte par défaut : deux fois le prix.
    expect(measured.micros).toBe(2 * plan(1, null).micros);
  });

  it("ignore un échantillon trop maigre pour décrire le prochain appel", () => {
    const thin = plan(1, { calls: MIN_SAMPLE - 1, inputTokens: 99_999, outputTokens: 99_999 });
    expect(thin.source).toBe("default");
    expect(thin.micros).toBe(plan(1, null).micros);
  });

  it("bascule en arrière-plan au-delà du seuil, et pas avant", () => {
    expect(plan(INLINE_MAX, null).background).toBe(false);
    expect(plan(INLINE_MAX + 1, null).background).toBe(true);
  });

  it("ne facture rien pour zéro brouillon, et ne promet pas la gratuité pour un travail réel", () => {
    expect(plan(0, null).micros).toBe(0);
    expect(describeCost(0)).toBe("0,00 $");
    // Un coût réel arrondi à zéro se lirait « gratuit », et l'on composerait
    // sans y penser.
    expect(describeCost(500)).toBe("moins de 0,01 $");
  });

  it("dit d'où vient le chiffre : une estimation dont on ignore la source ne se conteste pas", () => {
    expect(describeEstimate(plan(3, null))).toContain("faute d'historique");
    expect(
      describeEstimate(plan(3, { calls: 10, inputTokens: 3000, outputTokens: 1500 })),
    ).toContain("déjà facturés");
    expect(describeEstimate(plan(0, null))).toContain("rien ne sera appelé");
  });

  it("les repères par défaut sont ceux mesurés au jalon 36, pas des chiffres ronds inventés", () => {
    expect(DEFAULT_DRAFT_TOKENS.input).toBe(3000);
    expect(DEFAULT_DRAFT_TOKENS.output).toBe(1500);
  });
});
