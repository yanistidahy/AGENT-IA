import { describe, expect, it } from "vitest";
import {
  FILTER_NAME_MAX,
  cleanFilterName,
  describeAddOutcome,
  describeFilterDeletion,
  filterSortKey,
} from "../custom-filters";

describe("le nom est celui qu'on a écrit, débarrassé du bruit", () => {
  it("les espaces de bord et les doubles espaces partent", () => {
    // Deux filtres qui ne diffèrent que par une espace finale sont un doublon
    // qu'on ne voit pas.
    expect(cleanFilterName("  Salon   Beauté 2026 ")).toBe("Salon Beauté 2026");
  });

  it("la casse et les accents sont conservés", () => {
    // C'est le nom de l'utilisateur. Le tri, lui, passe par la clé pliée.
    expect(cleanFilterName("Éclat — À rappeler")).toBe("Éclat — À rappeler");
  });

  it("un nom vide n'en est pas un", () => {
    expect(cleanFilterName("   ")).toBeNull();
    expect(cleanFilterName("")).toBeNull();
  });

  it("un nom démesuré est borné plutôt que refusé", () => {
    const long = cleanFilterName("a".repeat(500));
    expect(long).not.toBeNull();
    expect(long?.length).toBe(FILTER_NAME_MAX);
  });
});

describe("le tri suit la règle du jalon 72", () => {
  it("la clé est pliée : ni casse, ni accents", () => {
    expect(filterSortKey("Éclat")).toBe(filterSortKey("eclat"));
  });

  it("les filtres accentués se rangent entre leurs voisines", () => {
    const keys = ["Eden", "Édition", "Effet"].map((name) => filterSortKey(name) ?? "");
    expect([...keys].sort()).toEqual(keys);
  });
});

describe("l'ajout dit ce qu'il a fait, raison par raison", () => {
  it("deux nombres plutôt qu'un total", () => {
    // « 10 traitées » ne dit pas si l'on vient de gagner dix fiches ou de
    // recliquer sur les mêmes.
    expect(describeAddOutcome({ added: 8, already: 2 })).toBe("8 ajoutées · 2 déjà dans le filtre");
  });

  it("aucun doublon : la phrase ne le mentionne pas", () => {
    expect(describeAddOutcome({ added: 1, already: 0 })).toBe("1 ajoutée");
  });

  it("rien d'ajouté se dit aussi", () => {
    expect(describeAddOutcome({ added: 0, already: 3 })).toBe(
      "0 ajoutée · 3 déjà dans le filtre",
    );
  });
});

describe("la suppression promet que les fiches restent", () => {
  it("il nomme le filtre et ce qui survit", () => {
    const phrase = describeFilterDeletion("Salon 2026", 12);
    expect(phrase).toContain("Salon 2026");
    expect(phrase).toContain("12 fiches restent dans le CRM");
    expect(phrase).toContain("seule l'appartenance à ce filtre disparaît");
  });

  it("un filtre vide ne promet rien sur des fiches qu'elle n'a pas", () => {
    expect(describeFilterDeletion("Brouillon", 0)).toContain("ne contient aucune fiche");
  });

  it("une seule fiche s'accorde au singulier", () => {
    expect(describeFilterDeletion("Test", 1)).toContain("Sa fiche reste dans le CRM");
  });
});
