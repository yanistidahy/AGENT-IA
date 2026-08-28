import { describe, expect, it } from "vitest";
import { instagramHandle, instagramLabel, instagramUrl } from "../instagram";

describe("les formes qu'on colle réellement dans le champ", () => {
  it("un pseudo avec arobase", () => {
    expect(instagramUrl("@maison_vertu")).toBe("https://instagram.com/maison_vertu");
  });

  it("un pseudo nu", () => {
    expect(instagramUrl("maison_vertu")).toBe("https://instagram.com/maison_vertu");
  });

  it("l'URL entière, collée depuis le navigateur", () => {
    expect(instagramUrl("https://www.instagram.com/maison_vertu/")).toBe(
      "https://instagram.com/maison_vertu",
    );
  });

  it("l'URL sans schéma", () => {
    expect(instagramUrl("instagram.com/maison_vertu")).toBe(
      "https://instagram.com/maison_vertu",
    );
  });

  it("une URL profonde désigne toujours le compte", () => {
    expect(instagramUrl("https://instagram.com/maison_vertu/reels/?hl=fr")).toBe(
      "https://instagram.com/maison_vertu",
    );
  });

  it("les espaces de bord ne cassent rien", () => {
    expect(instagramHandle("  @maison_vertu  ")).toBe("maison_vertu");
  });
});

describe("ce qui ne doit **pas** devenir un lien", () => {
  it("un champ vide", () => {
    expect(instagramUrl("")).toBeNull();
    expect(instagramUrl("   ")).toBeNull();
  });

  it("une phrase — quelqu'un a écrit une note dans le champ", () => {
    expect(instagramUrl("pas trouvé leur compte")).toBeNull();
  });

  it("un `javascript:` — même règle que les liens externes du jalon 10", () => {
    expect(instagramUrl("javascript:alert(1)")).toBeNull();
  });

  it("un pseudo trop long pour en être un", () => {
    expect(instagramUrl("a".repeat(31))).toBeNull();
  });

  it("une URL Instagram sans compte derrière", () => {
    expect(instagramUrl("https://instagram.com/")).toBeNull();
  });
});

describe("l'étiquette affichée", () => {
  it("porte l'arobase, quelle que soit la forme saisie", () => {
    expect(instagramLabel("https://instagram.com/maison_vertu/")).toBe("@maison_vertu");
    expect(instagramLabel("maison_vertu")).toBe("@maison_vertu");
  });

  it("n'existe pas quand le compte n'est pas lisible", () => {
    expect(instagramLabel("pas trouvé")).toBeNull();
  });
});
