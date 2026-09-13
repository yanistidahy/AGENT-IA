import { describe, expect, it } from "vitest";
import {
  NO_SIGNATORY,
  chosenSignatory,
  signatoryGap,
  signatoryOptionLabel,
  signatureLines,
  type MailboxOption,
} from "../signatory-choice";

const yanis: MailboxOption = {
  id: "mb_yanis",
  label: "Yanis",
  name: "Yanis Tidahy",
  title: "Fondateur, Aura Flow AI",
  email: "yanis.tidahy@auraflowai.fr",
  from: "yanis.tidahy@auraflowai.fr",
};

describe("l'étiquette d'un signataire", () => {
  it("nomme la boîte, la personne et l'adresse", () => {
    expect(signatoryOptionLabel(yanis)).toBe(
      "Yanis · Yanis Tidahy (yanis.tidahy@auraflowai.fr)",
    );
  });

  it("ne laisse jamais pendre un séparateur — c'était le défaut signalé", () => {
    const label = signatoryOptionLabel({
      ...yanis,
      name: "",
      label: "Sans signataire",
    });
    expect(label).not.toContain("· (");
    expect(label).not.toMatch(/·\s*$/);
    expect(label).toContain(NO_SIGNATORY);
  });

  it("nomme le manque plutôt que de l'escamoter", () => {
    // Une entrée réduite au seul libellé de la boîte se lirait comme une boîte
    // sans problème, alors que c'est une campagne qui partira sans signature.
    expect(signatoryOptionLabel({ ...yanis, name: "", from: "" })).toBe(
      `Yanis · ${NO_SIGNATORY}`,
    );
  });
});

describe("les lignes de signature", () => {
  it("rend ce que le destinataire verra, sans ligne vide", () => {
    expect(signatureLines({ ...yanis, title: "" })).toEqual([
      "Yanis Tidahy",
      "yanis.tidahy@auraflowai.fr",
    ]);
  });
});

describe("le manque de signataire", () => {
  it("avertit sans bloquer quand la boîte ne porte aucun nom", () => {
    const gap = signatoryGap({ ...yanis, name: "" });
    expect(gap.missing).toBe(true);
    expect(gap.message).toContain("Yanis");
    expect(gap.message).toContain("Réglages");
  });

  it("se tait quand la signature est réglée", () => {
    expect(signatoryGap(yanis)).toEqual({ missing: false, message: "" });
  });

  it("distingue « aucune boîte choisie » de « boîte sans nom »", () => {
    expect(signatoryGap(null).message).toContain("Aucune boîte");
  });
});

describe("le choix courant", () => {
  it("retrouve la boîte, et rend null quand elle n'existe pas", () => {
    expect(chosenSignatory([yanis], "mb_yanis")).toBe(yanis);
    expect(chosenSignatory([yanis], "")).toBeNull();
  });
});
