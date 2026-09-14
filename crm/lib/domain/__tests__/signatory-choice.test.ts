import { describe, expect, it } from "vitest";
import { replaceSignature } from "../email-format";
import {
  NO_SIGNATORY,
  knownSignatureBlocks,
  signatureText,
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
  phone: "07 85 28 35 36",
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
      "07 85 28 35 36",
      "yanis.tidahy@auraflowai.fr",
    ]);
  });
});

describe("le bloc de signature, celui qui vit dans le corps du message", () => {
  const mohamed: MailboxOption = {
    id: "mb_mohamed",
    label: "Mohamed",
    name: "Mohamed Targani",
    title: "Co-Fondateur, Aura Flow AI",
    phone: "06 12 34 56 78",
    email: "mohamed.targani@auraflowai.fr",
    from: "mohamed.targani@auraflowai.fr",
  };

  it("porte les quatre lignes, téléphone compris", () => {
    expect(signatureText(yanis)).toBe(
      "Yanis Tidahy\nFondateur, Aura Flow AI\n07 85 28 35 36\nyanis.tidahy@auraflowai.fr",
    );
  });

  it("changer de boîte remplace la signature, il n'en ajoute pas une seconde", () => {
    // Le défaut signalé, dans sa forme exacte : le corps porte le bloc composé
    // par le serveur, et le panneau y applique son propre bloc.
    const body = `Bonjour Stéphanie,\n\nÀ bientôt,\n\n${signatureText(yanis)}`;
    const after = replaceSignature(body, knownSignatureBlocks([yanis, mohamed]), signatureText(mohamed));

    expect(after.split("Mohamed Targani")).toHaveLength(2);
    expect(after).not.toContain("Yanis Tidahy");
    expect(after.endsWith(signatureText(mohamed))).toBe(true);
  });

  it("les formes héritées sont remplacées elles aussi", () => {
    // Un brouillon composé avant le jalon 62 dort peut-être encore dans la
    // file des départs : sa signature à deux lignes doit se remplacer, sinon
    // c'est là que le doublon réapparaîtrait.
    for (const legacy of [
      signatureText({ ...yanis, phone: "", email: "" }),
      signatureText({ ...yanis, email: "" }),
      signatureText({ ...yanis, phone: "" }),
    ]) {
      const body = `Bonjour,\n\nÀ bientôt,\n\n${legacy}`;
      const after = replaceSignature(body, knownSignatureBlocks([yanis, mohamed]), signatureText(mohamed));
      expect(after.split("Mohamed Targani")).toHaveLength(2);
      expect(after).not.toContain("Yanis Tidahy");
    }
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
