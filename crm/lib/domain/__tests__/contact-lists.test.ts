import { describe, expect, it } from "vitest";
import {
  LIST_NAME_MAX,
  cleanListName,
  describeAddOutcome,
  describeListDeletion,
  listSortKey,
} from "../contact-lists";

describe("le nom est celui qu'on a écrit, débarrassé du bruit", () => {
  it("les espaces de bord et les doubles espaces partent", () => {
    // Deux listes qui ne diffèrent que par une espace finale sont un doublon
    // qu'on ne voit pas.
    expect(cleanListName("  Salon   Beauté 2026 ")).toBe("Salon Beauté 2026");
  });

  it("la casse et les accents sont conservés", () => {
    // C'est le nom de l'utilisateur. Le tri, lui, passe par la clé pliée.
    expect(cleanListName("Éclat — À rappeler")).toBe("Éclat — À rappeler");
  });

  it("un nom vide n'en est pas un", () => {
    expect(cleanListName("   ")).toBeNull();
    expect(cleanListName("")).toBeNull();
  });

  it("un nom démesuré est borné plutôt que refusé", () => {
    const long = cleanListName("a".repeat(500));
    expect(long).not.toBeNull();
    expect(long?.length).toBe(LIST_NAME_MAX);
  });
});

describe("le tri suit la règle du jalon 72", () => {
  it("la clé est pliée : ni casse, ni accents", () => {
    expect(listSortKey("Éclat")).toBe(listSortKey("eclat"));
  });

  it("les listes accentuées se rangent entre leurs voisines", () => {
    const keys = ["Eden", "Édition", "Effet"].map((name) => listSortKey(name) ?? "");
    expect([...keys].sort()).toEqual(keys);
  });
});

describe("l'ajout dit ce qu'il a fait, raison par raison", () => {
  it("deux nombres plutôt qu'un total", () => {
    // « 10 traitées » ne dit pas si l'on vient de gagner dix fiches ou de
    // recliquer sur les mêmes.
    expect(describeAddOutcome({ added: 8, already: 2 })).toBe("8 ajoutées · 2 déjà dans la liste");
  });

  it("aucun doublon : la phrase ne le mentionne pas", () => {
    expect(describeAddOutcome({ added: 1, already: 0 })).toBe("1 ajoutée");
  });

  it("rien d'ajouté se dit aussi", () => {
    expect(describeAddOutcome({ added: 0, already: 3 })).toBe(
      "0 ajoutée · 3 déjà dans la liste",
    );
  });
});

describe("la suppression promet que les fiches restent", () => {
  it("elle nomme la liste et ce qui survit", () => {
    const phrase = describeListDeletion("Salon 2026", 12);
    expect(phrase).toContain("Salon 2026");
    expect(phrase).toContain("12 fiches restent dans le CRM");
    expect(phrase).toContain("seule l'appartenance à cette liste disparaît");
  });

  it("une liste vide ne promet rien sur des fiches qu'elle n'a pas", () => {
    expect(describeListDeletion("Brouillon", 0)).toContain("ne contient aucune fiche");
  });

  it("une seule fiche s'accorde au singulier", () => {
    expect(describeListDeletion("Test", 1)).toContain("Sa fiche reste dans le CRM");
  });
});
