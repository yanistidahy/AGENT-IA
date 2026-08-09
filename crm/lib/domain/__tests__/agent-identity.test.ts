import { describe, expect, it } from "vitest";
import {
  acceptPhotoUpload,
  isAcceptedUploadMime,
  isPhotoSize,
  MAX_UPLOAD_BYTES,
  photoUrl,
  portraitAlt,
} from "../agent-identity";

describe("acceptPhotoUpload", () => {
  it("accepte les trois formats prévus", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
      expect(acceptPhotoUpload(mime, 1024).ok, mime).toBe(true);
    }
  });

  it("refuse un PDF en le nommant", () => {
    const result = acceptPhotoUpload("application/pdf", 1024);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("application/pdf");
      expect(result.message).toContain("JPEG, PNG ou WebP");
    }
  });

  /**
   * SVG est une image pour un navigateur, mais un document capable de porter du
   * script. Servi depuis notre domaine, il s'exécuterait dans la session — d'où
   * la liste fermée plutôt qu'un test sur le préfixe « image/ ».
   */
  it("refuse le SVG, qui est un document et non une image", () => {
    expect(acceptPhotoUpload("image/svg+xml", 1024).ok).toBe(false);
    expect(isAcceptedUploadMime("image/svg+xml")).toBe(false);
  });

  it("refuse un fichier vide", () => {
    expect(acceptPhotoUpload("image/png", 0).ok).toBe(false);
  });

  it("accepte 5 Mo pile et refuse un octet de plus, en donnant le poids", () => {
    expect(acceptPhotoUpload("image/jpeg", MAX_UPLOAD_BYTES).ok).toBe(true);

    const result = acceptPhotoUpload("image/jpeg", MAX_UPLOAD_BYTES + 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("5 Mo");
      expect(result.message).toContain("5.0 Mo");
    }
  });
});

describe("portraitAlt", () => {
  it("nomme la personne et son rôle", () => {
    expect(portraitAlt("Sarah", "Sales & Closing")).toBe("Portrait de Sarah, Sales & Closing");
  });

  it("reste lisible quand le rôle est vide", () => {
    expect(portraitAlt("Sarah", "  ")).toBe("Portrait de Sarah");
  });
});

describe("photoUrl", () => {
  it("porte la version, qui est ce qui autorise un cache long", () => {
    expect(photoUrl("sarah", "thumb", "abc123")).toBe(
      "/api/agents/sarah/photo?size=thumb&v=abc123",
    );
  });

  it("omet le jeton quand il n'y a pas de version", () => {
    expect(photoUrl("sarah", "portrait", "")).toBe("/api/agents/sarah/photo?size=portrait");
  });

  it("échappe un slug exotique", () => {
    expect(photoUrl("a b", "thumb", "v")).toContain("a%20b");
  });
});

describe("isPhotoSize", () => {
  it("n'accepte que les deux tailles produites", () => {
    expect(isPhotoSize("portrait")).toBe(true);
    expect(isPhotoSize("thumb")).toBe(true);
    expect(isPhotoSize("original")).toBe(false);
  });
});
