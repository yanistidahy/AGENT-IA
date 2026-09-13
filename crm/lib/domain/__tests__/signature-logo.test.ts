import { describe, expect, it } from "vitest";
import {
  LOGO_WARN_BYTES,
  LOGO_WIDTH,
  MIN_BODY_CHARS,
  logoUrl,
  logoWeight,
} from "../signature-logo";
import { toHtml, toPlainText, withSignatureLogo, withTrackingPixel } from "../email-format";
import { signatureBlock } from "@/lib/agents/prompts/company";

const SIGNATURE = signatureBlock({
  name: "Yanis Tidahy",
  title: "Fondateur, Aura Flow AI",
  phone: "07 85 28 35 36",
  email: "yanis.tidahy@auraflowai.fr",
});

const BODY = [
  "Bonjour Stéphanie,",
  "",
  "69 % des visiteurs quittent un site après une question restée sans réponse.",
  "",
  "À bientôt,",
  "",
  SIGNATURE,
].join("\n");

const LOGO = { url: "https://crm.auraflowai.fr/api/logo/abc123", width: LOGO_WIDTH };

describe("les deux versions du message", () => {
  it("le texte porte les quatre lignes et aucune image", () => {
    const text = toPlainText(BODY);
    expect(text).toContain("Yanis Tidahy\nFondateur, Aura Flow AI\n07 85 28 35 36\nyanis.tidahy@auraflowai.fr");
    expect(text).not.toContain("<img");
    expect(text).not.toContain("/api/logo/");
  });

  it("le HTML porte les mêmes quatre lignes, plus le logo", () => {
    const html = withSignatureLogo(toHtml(BODY), LOGO);
    for (const line of ["Yanis Tidahy", "Fondateur, Aura Flow AI", "07 85 28 35 36"]) {
      expect(html).toContain(line);
    }
    expect(html).toContain('<img src="https://crm.auraflowai.fr/api/logo/abc123"');
    expect(html).toContain('alt="Aura Flow AI"');
    expect(html).toContain(`width="${LOGO_WIDTH}"`);
  });

  it("le logo n'est ni un lien ni une balise pistée", () => {
    const html = withSignatureLogo(toHtml(BODY), LOGO);
    // Aucune ancre autour de l'image : c'est une identité, pas un appel à
    // l'action. Et aucun paramètre dans l'adresse.
    expect(html).not.toMatch(/<a[^>]*>\s*<img/);
    expect(html).not.toContain("utm_");
    expect(html).not.toContain("?");
  });

  it("`toHtml` seul ne porte toujours aucune image — la règle du jalon 32 tient", () => {
    expect(toHtml(BODY)).not.toContain("<img");
  });

  it("sans logo, le HTML est exactement celui d'avant", () => {
    expect(withSignatureLogo(toHtml(BODY), undefined)).toBe(toHtml(BODY));
    expect(withSignatureLogo(toHtml(BODY), { url: "  ", width: 120 })).toBe(toHtml(BODY));
  });

  it("le pixel reste la toute dernière chose du corps", () => {
    // Ordre imposé par le jalon 43 : un client qui tronque coupe par la fin.
    const html = withTrackingPixel(withSignatureLogo(toHtml(BODY), LOGO), "https://crm/api/t/xyz");
    expect(html.indexOf("/api/logo/")).toBeLessThan(html.indexOf("/api/t/"));
    expect(html.trimEnd().endsWith("</body></html>")).toBe(true);
  });
});

describe("l'adresse du logo", () => {
  it("se compose depuis notre base et la version", () => {
    expect(logoUrl("https://crm.auraflowai.fr", "abc123")).toBe(
      "https://crm.auraflowai.fr/api/logo/abc123",
    );
    expect(logoUrl("https://crm.auraflowai.fr/", "abc123")).toBe(
      "https://crm.auraflowai.fr/api/logo/abc123",
    );
  });

  it("est vide sans base publique — mieux vaut pas de logo qu'une image cassée", () => {
    expect(logoUrl("", "abc123")).toBe("");
    expect(logoUrl("https://crm.auraflowai.fr", "")).toBe("");
  });
});

describe("le verdict de poids", () => {
  it("se tait quand il n'y a pas de logo", () => {
    expect(logoWeight({ logoBytes: 0, bodyChars: 50 })).toEqual({ heavy: false, reasons: [] });
  });

  it("accepte un logo de quelques kilo-octets sur un vrai message", () => {
    // Le cas normal : 3 Ko de PNG sous un message de quatre paragraphes. Une
    // règle qui sonnerait ici serait une règle qu'on apprend à ignorer.
    expect(logoWeight({ logoBytes: 3 * 1024, bodyChars: 900 }).heavy).toBe(false);
  });

  it("avertit au-delà du plafond absolu, en le chiffrant", () => {
    const verdict = logoWeight({ logoBytes: LOGO_WARN_BYTES + 1, bodyChars: 900 });
    expect(verdict.heavy).toBe(true);
    expect(verdict.reasons[0]).toContain("Ko");
  });

  it("avertit quand le corps est trop court pour porter une image", () => {
    const verdict = logoWeight({ logoBytes: 3 * 1024, bodyChars: MIN_BODY_CHARS - 1 });
    expect(verdict.heavy).toBe(true);
    expect(verdict.reasons.join(" ")).toContain("surtout une image");
  });

  it("cumule les deux raisons plutôt que d'en taire une", () => {
    const verdict = logoWeight({ logoBytes: LOGO_WARN_BYTES + 1, bodyChars: 10 });
    expect(verdict.reasons).toHaveLength(2);
  });
});
