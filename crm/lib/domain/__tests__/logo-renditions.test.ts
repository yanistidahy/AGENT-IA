import { describe, expect, it } from "vitest";
import {
  CHROME_WIDTH,
  MIN_DARK_CONTRAST,
  chromeUrl,
  contrastRatio,
  readsOnDark,
  relativeLuminance,
} from "../logo-renditions";
import { LOGO_WIDTH } from "../signature-logo";

/** Encre foncée sur fond transparent : le logo dessiné pour du papier blanc. */
const DARK_INK = { r: 20, g: 24, b: 40, transparency: 0.75 } as const;
/** Logo clair sur fond transparent : le cas qui va bien sur le rail. */
const LIGHT_INK = { r: 240, g: 244, b: 255, transparency: 0.7 } as const;
/** Logo à fond plein : ce qu'on voit sur le rail, c'est son propre fond. */
const OPAQUE = { r: 20, g: 24, b: 40, transparency: 0 } as const;

describe("la lisibilité sur le rail est mesurée, pas supposée", () => {
  it("une encre claire sur fond transparent se détache, sans plaque", () => {
    const verdict = readsOnDark(LIGHT_INK);
    expect(verdict.readable).toBe(true);
    expect(verdict.plate).toBe(false);
    expect(verdict.contrast).toBeGreaterThanOrEqual(MIN_DARK_CONTRAST);
  });

  it("une encre foncée sur fond transparent est déclarée illisible, et reçoit une plaque", () => {
    const verdict = readsOnDark(DARK_INK);
    expect(verdict.readable).toBe(false);
    expect(verdict.plate).toBe(true);
    expect(verdict.contrast).toBeLessThan(MIN_DARK_CONTRAST);
    // Le message doit dire quoi faire, pas seulement constater.
    expect(verdict.message).toContain("plaque claire");
  });

  it("un fond opaque n'appelle jamais de plaque, si sombre soit-il", () => {
    // Le rail ne transparaît pas : encadrer de blanc un logo qui porte déjà son
    // fond dessinerait un cadre autour d'un cadre.
    const verdict = readsOnDark(OPAQUE);
    expect(verdict.readable).toBe(true);
    expect(verdict.plate).toBe(false);
  });

  it("le verdict chiffre toujours ce qu'il a mesuré", () => {
    for (const sample of [DARK_INK, LIGHT_INK, OPAQUE]) {
      expect(readsOnDark(sample).contrast).toBeGreaterThan(0);
      expect(readsOnDark(sample).message.length).toBeGreaterThan(20);
    }
  });

  it("une image entièrement transparente n'est pas déclarée noire", () => {
    // Aucun pixel visible : une moyenne sur zéro pixel ne vaut rien, et le noir
    // serait le pire des deux verdicts possibles.
    expect(readsOnDark({ r: 255, g: 255, b: 255, transparency: 1 }).readable).toBe(true);
  });
});

describe("le calcul de contraste suit WCAG", () => {
  it("le blanc et le noir donnent 21:1", () => {
    const white = relativeLuminance(255, 255, 255);
    const black = relativeLuminance(0, 0, 0);
    expect(Math.round(contrastRatio(white, black))).toBe(21);
  });

  it("le contraste est symétrique", () => {
    const a = relativeLuminance(11, 16, 48);
    const b = relativeLuminance(240, 240, 240);
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });
});

describe("les deux rendus ne se confondent pas", () => {
  it("le rendu d'interface est plus large que celui de la signature", () => {
    // C'est toute la raison d'être du second fichier : étirer 120 px à la
    // taille du rail donne une image molle.
    expect(CHROME_WIDTH).toBeGreaterThan(LOGO_WIDTH);
  });

  it("l'adresse d'interface est relative, jamais absolue", () => {
    // Le navigateur qui affiche le rail parle déjà au CRM : une adresse absolue
    // rendrait le logo dépendant d'un réglage de déploiement (leçon du jalon 62).
    const url = chromeUrl("abc123");
    expect(url).toBe("/api/logo/abc123/app");
    expect(url.startsWith("/")).toBe(true);
    expect(url).not.toContain("http");
  });

  it("sans version, aucune adresse — pas une adresse à moitié composée", () => {
    expect(chromeUrl("")).toBe("");
    expect(chromeUrl("   ")).toBe("");
  });
});
