import { describe, expect, it } from "vitest";
import {
  DEFAULT_VIDEO_DISPLAY,
  VIDEO_DISPLAY_LABELS,
  VIDEO_DISPLAY_NOTES,
  toVideoDisplay,
} from "../video-display";

/**
 * **Le mode d'affichage de la vidéo, et son défaut.**
 *
 * Le défaut est la seule chose que ce module promet vraiment : une installation
 * neuve comme la ligne de réglages déjà en base doivent lire « Lien texte » sans
 * que personne clique. Le reste est une frontière `string` vers union, celle des
 * `z.enum()` de `schemas.ts`, et elle ne lève jamais : une faute de frappe dans
 * un réglage ne doit pas devenir une panne d'envoi.
 */

describe("le mode d'affichage de la vidéo", () => {
  it("part sur le lien texte, jamais sur la vignette", () => {
    expect(DEFAULT_VIDEO_DISPLAY).toBe("link");
  });

  it("lit les deux valeurs connues", () => {
    expect(toVideoDisplay("link")).toBe("link");
    expect(toVideoDisplay("thumbnail")).toBe("thumbnail");
  });

  it("retombe sur le lien texte plutôt que de lever", () => {
    // Le repli le moins risqué est celui qui n'envoie pas d'image : une valeur
    // inconnue ne doit ni casser l'envoi, ni ressusciter la vignette.
    for (const raw of ["", "vignette", "LINK", "THUMBNAIL", "  thumbnail  ", "null"]) {
      expect(toVideoDisplay(raw), raw).toBe("link");
    }
  });

  it("nomme les deux modes à l'écran, et dit ce que chacun fait", () => {
    expect(VIDEO_DISPLAY_LABELS.link).toBe("Lien texte");
    expect(VIDEO_DISPLAY_LABELS.thumbnail).toBe("Vignette");
    // Ce que l'écran affiche décrit le destinataire, pas le réglage : « rien à
    // charger » d'un côté, « souvent masquée » de l'autre.
    expect(VIDEO_DISPLAY_NOTES.link).toMatch(/lien cliquable/i);
    expect(VIDEO_DISPLAY_NOTES.thumbnail).toMatch(/afficher les images/i);
  });
});
