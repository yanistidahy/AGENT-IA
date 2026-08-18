import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIMITS,
  isRateRefusal,
  limitNotice,
  loweredCeiling,
  rateVerdict,
  spacingSeconds,
  SPACING_SECONDS,
} from "../send-rate";

/**
 * **Le réglage est une estimation ; le serveur est la source.**
 *
 * Les quotas d'IONOS montent avec l'âge de la boîte et ne sont pas garantis. La
 * conception ne dépend donc pas de la justesse des nombres réglés : elle dépend
 * de ce qu'on fait du refus.
 */

describe("le plafond", () => {
  it("laisse passer tant qu'il reste de la place, et dit combien", () => {
    const verdict = rateVerdict(10, 40, DEFAULT_LIMITS);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.remainingHour).toBe(20);
      expect(verdict.remainingDay).toBe(110);
    }
  });

  it("refuse en nommant le plafond atteint et sa valeur", () => {
    // « Bloqué » sans chiffre n'apprend rien et se lit comme une panne.
    const hour = rateVerdict(30, 40, DEFAULT_LIMITS);
    expect(hour.ok).toBe(false);
    if (!hour.ok) {
      expect(hour.reason).toContain("horaire");
      expect(hour.reason).toContain("30");
    }

    const day = rateVerdict(1, 150, DEFAULT_LIMITS);
    expect(day.ok).toBe(false);
    if (!day.ok) expect(day.reason).toContain("journalier");
  });

  it("part bas : trente par heure, cent cinquante par jour", () => {
    expect(DEFAULT_LIMITS).toEqual({ perHour: 30, perDay: 150 });
  });
});

describe("reconnaître un refus de débit", () => {
  it("reconnaît le 450 d'IONOS", () => {
    expect(
      isRateRefusal({
        responseCode: 450,
        response: "450 Requested mail action not taken: Mail send limit exceeded",
      }),
    ).toBe(true);
  });

  /**
   * **Un 450 n'est pas toujours une limite de débit.** C'est un refus
   * temporaire qui couvre aussi le greylisting et une boîte momentanément
   * indisponible. Confondre les deux ferait baisser le plafond pour une raison
   * qui n'a rien à voir — et le ferait baisser à chaque greylisting.
   */
  it("ne confond pas un greylisting avec une limite de débit", () => {
    expect(
      isRateRefusal({ responseCode: 450, response: "450 4.7.1 Greylisted, try again later" }),
    ).toBe(false);
    expect(isRateRefusal({ responseCode: 421, response: "too many messages" })).toBe(false);
    expect(isRateRefusal(null)).toBe(false);
    expect(isRateRefusal({ responseCode: 535 })).toBe(false);
  });
});

describe("apprendre du refus", () => {
  it("descend à ce qui vient réellement de passer", () => {
    // Le serveur a accepté 17 messages puis refusé : 17 est la seule valeur
    // dont on ait la preuve.
    expect(loweredCeiling(17)).toBe(17);
  });

  it("ne descend jamais à zéro", () => {
    // Un plafond à zéro bloquerait tout sans qu'aucun réglage ne l'explique.
    expect(loweredCeiling(0)).toBe(1);
  });

  it("le message dit l'ancien plafond, le nouveau, et cite le serveur", () => {
    const notice = limitNotice(17, 30, "450 Mail send limit exceeded");
    expect(notice).toContain("17");
    expect(notice).toContain("de 30 à 17");
    expect(notice).toContain("450 Mail send limit exceeded");
  });
});

describe("l'espacement", () => {
  it("reste dans la fourchette, bornes comprises", () => {
    // Cinquante messages à la seconde près sont un signal de masse à eux seuls,
    // indépendamment du quota.
    expect(spacingSeconds(0)).toBe(SPACING_SECONDS.min);
    expect(spacingSeconds(1)).toBe(SPACING_SECONDS.max);
    expect(spacingSeconds(0.5)).toBeGreaterThanOrEqual(SPACING_SECONDS.min);
    expect(spacingSeconds(0.5)).toBeLessThanOrEqual(SPACING_SECONDS.max);
  });
});
