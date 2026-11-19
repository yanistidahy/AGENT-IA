import { describe, expect, it } from "vitest";
import {
  compareContacts,
  contactOptions,
  NO_LABEL,
  pickerLabel,
  pickerSearch,
  tidyName,
  type ContactPickerLike,
} from "../contact-picker";

/** Une fiche minimale : seuls les champs nommés comptent pour ces tests. */
function contact(partial: Partial<ContactPickerLike> & { readonly id: string }): ContactPickerLike {
  return { firstName: "", lastName: "", ...partial };
}

describe("tidyName — ranger la casse à l'affichage", () => {
  it("capitalise un nom entièrement en minuscules", () => {
    expect(tidyName("aguilera")).toBe("Aguilera");
  });

  it("capitalise un nom entièrement en majuscules", () => {
    expect(tidyName("BAKHKHAR")).toBe("Bakhkhar");
  });

  it("traite chaque mot d'un nom composé", () => {
    expect(tidyName("marc andré lacarelle")).toBe("Marc André Lacarelle");
  });

  it("traite chaque morceau d'un trait d'union et d'une apostrophe", () => {
    expect(tidyName("jean-luc")).toBe("Jean-Luc");
    expect(tidyName("o'brien")).toBe("O'Brien");
    expect(tidyName("JEAN-PIERRE O’NEILL")).toBe("Jean-Pierre O’Neill");
  });

  it("laisse intact un nom où les deux casses cohabitent", () => {
    // Ce sont des orthographes, pas des accidents de saisie : deviner les
    // particules se tromperait sur « De Niro » comme sur « de Gaulle ».
    expect(tidyName("de La Fontaine")).toBe("de La Fontaine");
    expect(tidyName("McDonald")).toBe("McDonald");
    expect(tidyName("van der Berg")).toBe("van der Berg");
  });

  it("traite les lettres accentuées comme des lettres", () => {
    // Une classe `[a-z]` aurait déclaré « ÉLODIE » sans minuscule *et* sans
    // majuscule, donc l'aurait laissée telle quelle.
    expect(tidyName("ÉLODIE")).toBe("Élodie");
    expect(tidyName("élodie")).toBe("Élodie");
  });

  it("réduit les espaces en trop et rend la chaîne vide telle quelle", () => {
    expect(tidyName("  marie   curie ")).toBe("Marie Curie");
    expect(tidyName("   ")).toBe("");
  });
});

describe("pickerLabel — de quoi distinguer deux fiches", () => {
  it("rend le nom rangé quand la fiche porte une personne", () => {
    expect(pickerLabel(contact({ id: "a", firstName: "giovanni", lastName: "AMICO" }))).toBe(
      "Giovanni Amico",
    );
  });

  it("rend l'adresse avant la marque sur une fiche anonyme", () => {
    /*
      **L'inverse de `contactTitle()`, et c'est le but.** Cinq fiches anonymes
      de la même marque porteraient cinq fois « Maison Vertu » : choisir
      deviendrait un tirage au sort. L'adresse est propre à la ligne.
    */
    const label = pickerLabel(
      contact({ id: "a", email: "contact@vertu.fr", company: { name: "Maison Vertu" } }),
    );
    expect(label).toBe("contact@vertu.fr");
  });

  it("retombe sur la marque, puis sur Instagram, puis sur une phrase", () => {
    expect(pickerLabel(contact({ id: "a", company: { name: "Maison Vertu" } }))).toBe(
      "Maison Vertu",
    );
    expect(pickerLabel(contact({ id: "a", instagram: "@vertu" }))).toBe("@vertu");
    expect(pickerLabel(contact({ id: "a" }))).toBe(NO_LABEL);
  });

  it("ne range pas la casse d'une adresse ni d'une marque", () => {
    // Une adresse est une valeur technique : « Contact@Vertu.fr » ne s'écrit
    // pas, et une marque porte sa propre typographie (« L'ORÉAL »).
    expect(pickerLabel(contact({ id: "a", email: "contact@VERTU.fr" }))).toBe("contact@VERTU.fr");
    expect(pickerLabel(contact({ id: "a", company: { name: "L'ORÉAL" } }))).toBe("L'ORÉAL");
  });
});

describe("pickerSearch — ce sur quoi la frappe filtre", () => {
  const giovanni = contact({
    id: "a",
    firstName: "Giovanni",
    lastName: "Amico",
    email: "gio@trattoria.it",
    company: { name: "Trattoria Zénith" },
  });

  it("trouve par le début du prénom et par le début du nom", () => {
    expect(pickerSearch(giovanni)).toContain("gio");
    expect(pickerSearch(giovanni)).toContain("ami");
  });

  it("trouve par l'adresse et par la société, accents pliés", () => {
    expect(pickerSearch(giovanni)).toContain("trattoria.it");
    expect(pickerSearch(giovanni)).toContain("zenith");
  });
});

describe("compareContacts — prénom, puis nom, et les sans-nom en fin", () => {
  it("classe sur le prénom et non sur le nom de famille", () => {
    const zoe = contact({ id: "1", firstName: "Zoé", lastName: "Abadie" });
    const ange = contact({ id: "2", firstName: "Ange", lastName: "Zunino" });
    expect([zoe, ange].sort(compareContacts).map((row) => row.firstName)).toEqual(["Ange", "Zoé"]);
  });

  it("place « Élodie » et « Elodie » côte à côte", () => {
    const rows = [
      contact({ id: "1", firstName: "Fabien", lastName: "Roux" }),
      contact({ id: "2", firstName: "Élodie", lastName: "Simon" }),
      contact({ id: "3", firstName: "Emma", lastName: "Petit" }),
      contact({ id: "4", firstName: "Elodie", lastName: "Bernard" }),
    ];
    const order = rows.sort(compareContacts).map((row) => row.firstName);
    const first = order.indexOf("Élodie");
    const second = order.indexOf("Elodie");
    expect(Math.abs(first - second)).toBe(1);
    // Et aucune des deux n'est reléguée après « Z » comme le ferait un
    // comparateur de points de code.
    expect(order.indexOf("Emma")).toBeGreaterThan(Math.max(first, second));
  });

  it("classe « aguilera » là où « Aguilera » se classerait", () => {
    const rows = [
      contact({ id: "1", firstName: "Bruno", lastName: "Dupré" }),
      contact({ id: "2", firstName: "aguilera", lastName: "diaz" }),
      contact({ id: "3", firstName: "Camille", lastName: "Noé" }),
    ];
    expect(rows.sort(compareContacts).map((row) => row.firstName)).toEqual([
      "aguilera",
      "Bruno",
      "Camille",
    ]);
  });

  it("départage deux prénoms identiques sur le nom", () => {
    const rows = [
      contact({ id: "1", firstName: "Marie", lastName: "Zola" }),
      contact({ id: "2", firstName: "Marie", lastName: "Abel" }),
    ];
    expect(rows.sort(compareContacts).map((row) => row.lastName)).toEqual(["Abel", "Zola"]);
  });

  it("départage deux homonymes exacts sur l'identifiant, pas sur l'ordre de lecture", () => {
    const b = contact({ id: "b", firstName: "Marie", lastName: "Curie" });
    const a = contact({ id: "a", firstName: "Marie", lastName: "Curie" });
    expect([b, a].sort(compareContacts).map((row) => row.id)).toEqual(["a", "b"]);
    expect([a, b].sort(compareContacts).map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("met les fiches sans personne en **fin** de liste", () => {
    /*
      C'était le défaut visible : `lastName: "asc"` classait la chaîne vide en
      tête — le plus petit préfixe de tout — donc les fiches anonymes ouvraient
      le menu et poussaient les vraies entrées hors de l'écran.
    */
    const rows = [
      contact({ id: "1", email: "z@vertu.fr" }),
      contact({ id: "2", firstName: "Zoé", lastName: "Abadie" }),
      contact({ id: "3", company: { name: "Maison Vertu" } }),
      contact({ id: "4", firstName: "Ange", lastName: "Zunino" }),
    ];
    // Les deux fiches nommées d'abord, par prénom ; les deux anonymes ensuite,
    // par leur libellé (« Maison Vertu » avant « z@vertu.fr »).
    expect(rows.sort(compareContacts).map((row) => row.id)).toEqual(["4", "2", "3", "1"]);
  });

  it("classe les fiches sans personne entre elles sur leur libellé", () => {
    const rows = [
      contact({ id: "1", email: "zoe@vertu.fr" }),
      contact({ id: "2", email: "ange@vertu.fr" }),
    ];
    expect(rows.sort(compareContacts).map((row) => row.id)).toEqual(["2", "1"]);
  });
});

describe("contactOptions — la liste donnée aux sélecteurs", () => {
  const rows = [
    contact({ id: "1", firstName: "zoé", lastName: "ABADIE", email: "zoe@a.fr" }),
    contact({ id: "2", company: { name: "Maison Vertu" } }),
    contact({ id: "3", firstName: "Ange", lastName: "Zunino", company: { name: "Trattoria" } }),
  ];

  it("rend des entrées triées, libellées et cherchables", () => {
    const options = contactOptions(rows);
    expect(options.map((option) => option.label)).toEqual([
      "Ange Zunino",
      "Zoé Abadie",
      "Maison Vertu",
    ]);
    expect(options[0]?.search).toContain("trattoria");
  });

  it("ne modifie pas la liste reçue", () => {
    const given = [...rows];
    contactOptions(given);
    expect(given.map((row) => row.id)).toEqual(["1", "2", "3"]);
  });

  it("ajoute la mention demandée au libellé, sans l'ajouter à la recherche", () => {
    const options = contactOptions(rows, (row) => (row.firstName === "" ? " — sans prénom" : ""));
    expect(options.map((option) => option.label)).toEqual([
      "Ange Zunino",
      "Zoé Abadie",
      "Maison Vertu — sans prénom",
    ]);
    expect(options[2]?.search).not.toContain("sans prenom");
  });
});
