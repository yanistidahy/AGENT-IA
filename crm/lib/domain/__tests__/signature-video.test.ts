import { describe, expect, it } from "vitest";
import {
  POSTER_WARN_BYTES,
  VIDEO_POSTER_HEIGHT,
  VIDEO_POSTER_WIDTH,
  isUsableVideo,
  posterUrl,
  posterWeight,
  staysOnOurDomain,
  toVideoKind,
  videoDestination,
  videoFileUrl,
  type VideoLink,
} from "../signature-video";

describe("la frontière string → union", () => {
  it("reconnaît les deux voies", () => {
    expect(toVideoKind("file")).toBe("file");
    expect(toVideoKind("hosted")).toBe("hosted");
  });

  it("retombe sur l'hébergement sur une valeur inconnue", () => {
    // Le repli le plus sûr : `file` promettrait un fichier chez nous que la
    // base ne porte peut-être pas, donc un lien mort.
    expect(toVideoKind("")).toBe("hosted");
    expect(toVideoKind("Fichier")).toBe("hosted");
  });
});

describe("les adresses servies", () => {
  it("composent la vignette et le fichier sous la même version", () => {
    expect(posterUrl("https://crm.test", "abc123")).toBe("https://crm.test/api/video/abc123");
    expect(videoFileUrl("https://crm.test", "abc123")).toBe(
      "https://crm.test/api/video/abc123/fichier",
    );
  });

  it("ferment la barre oblique en trop", () => {
    expect(posterUrl("https://crm.test/", "abc")).toBe("https://crm.test/api/video/abc");
  });

  it("ne composent rien quand une moitié manque", () => {
    // Une adresse devinée produirait une image cassée dans chaque message :
    // c'est la règle du pixel du jalon 37 et du logo du jalon 62.
    expect(posterUrl("", "abc")).toBe("");
    expect(posterUrl("https://crm.test", "")).toBe("");
    expect(videoFileUrl("", "abc")).toBe("");
  });
});

describe("la destination du clic", () => {
  it("reste chez nous pour un fichier téléversé", () => {
    expect(videoDestination({ kind: "file", url: "", version: "v1" }, "https://crm.test")).toBe(
      "https://crm.test/api/video/v1/fichier",
    );
    expect(staysOnOurDomain("file")).toBe(true);
  });

  it("va chez l'hébergeur pour une adresse collée, et on le dit", () => {
    expect(
      videoDestination({ kind: "hosted", url: "https://vimeo.com/42", version: "v1" }, "https://crm.test"),
    ).toBe("https://vimeo.com/42");
    expect(staysOnOurDomain("hosted")).toBe(false);
  });

  it("ne devine jamais une adresse incomplète", () => {
    // Sans destination, il n'y a pas de lien, et `{video}` retire sa phrase
    // comme `{site}` retire la sienne. Un lien mort coûte plus que la phrase.
    expect(videoDestination({ kind: "hosted", url: "vimeo.com/42", version: "v1" }, "https://crm.test")).toBe("");
    expect(videoDestination({ kind: "hosted", url: "  ", version: "v1" }, "https://crm.test")).toBe("");
  });
});

describe("le rapport de la vignette", () => {
  it("est celui d'une vidéo", () => {
    expect(VIDEO_POSTER_HEIGHT).toBe(Math.round((VIDEO_POSTER_WIDTH * 9) / 16));
  });
});

describe("le poids de la vignette", () => {
  it("ne dit rien en dessous du seuil", () => {
    expect(posterWeight(POSTER_WARN_BYTES).heavy).toBe(false);
    expect(posterWeight(POSTER_WARN_BYTES).reasons).toEqual([]);
  });

  it("avertit au-delà, en citant le poids et le seuil", () => {
    const verdict = posterWeight(POSTER_WARN_BYTES + 40 * 1024);
    expect(verdict.heavy).toBe(true);
    expect(verdict.reasons[0]).toMatch(/Ko/);
  });

  it("est plus permissif que le logo, et c'est délibéré", () => {
    /*
      Une vignette est une image photographique, pas un aplat de marque : la
      comparer au seuil de 20 Ko du logo ferait sonner l'alerte sur chaque vidéo
      légitime — l'erreur que le jalon 62 a explicitement refusé de commettre.
    */
    expect(POSTER_WARN_BYTES).toBeGreaterThan(20 * 1024);
    expect(posterWeight(60 * 1024).heavy).toBe(false);
  });
});

describe("les trois morceaux sont solidaires", () => {
  const full: VideoLink = {
    label: "Voir la démonstration",
    url: "https://crm.test/api/video/v1/fichier",
    posterUrl: "https://crm.test/api/video/v1",
    posterWidth: VIDEO_POSTER_WIDTH,
  };

  it("accepte un lien complet", () => {
    expect(isUsableVideo(full)).toBe(true);
  });

  it("refuse un lien à moitié", () => {
    // Sans vignette on n'a qu'un lien nu, sans destination qu'une image inerte,
    // sans libellé rien sur quoi cliquer. Plutôt que d'en rendre la moitié, on
    // ne rend rien et la phrase disparaît.
    expect(isUsableVideo({ ...full, posterUrl: "" })).toBe(false);
    expect(isUsableVideo({ ...full, url: "" })).toBe(false);
    expect(isUsableVideo({ ...full, label: "   " })).toBe(false);
    expect(isUsableVideo(undefined)).toBe(false);
  });
});
