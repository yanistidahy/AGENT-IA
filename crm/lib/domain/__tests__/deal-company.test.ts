import { describe, expect, it } from "vitest";
import { inheritedCompanyId } from "../deal-company";

describe("la société héritée du contact principal", () => {
  it("comble un vide", () => {
    expect(
      inheritedCompanyId({ dealCompanyId: null, contactCompanyId: "c2" }),
    ).toBe("c2");
  });

  it("comble aussi quand le formulaire n'a rien envoyé du tout", () => {
    // `resolveCompanyLink` rend `undefined` quand ni l'identifiant ni le nom
    // n'ont été saisis : c'est le cas réel du formulaire d'affaire.
    expect(
      inheritedCompanyId({ dealCompanyId: undefined, contactCompanyId: "c2" }),
    ).toBe("c2");
  });

  it("**n'écrase jamais** une société déjà choisie", () => {
    // Elle peut différer volontairement : intermédiaire, filiale, acheteur qui
    // n'appartient pas à la maison qui signe.
    expect(
      inheritedCompanyId({ dealCompanyId: "c1", contactCompanyId: "c2" }),
    ).toBeNull();
  });

  it("ne devine rien sans contact", () => {
    expect(
      inheritedCompanyId({ dealCompanyId: null, contactCompanyId: null }),
    ).toBeNull();
  });

  it("ne devine rien d'un contact sans société", () => {
    expect(
      inheritedCompanyId({ dealCompanyId: null, contactCompanyId: undefined }),
    ).toBeNull();
  });

  it("traite la chaîne vide comme une absence, des deux côtés", () => {
    expect(inheritedCompanyId({ dealCompanyId: "", contactCompanyId: "c2" })).toBe("c2");
    expect(inheritedCompanyId({ dealCompanyId: "", contactCompanyId: "" })).toBeNull();
  });
});
