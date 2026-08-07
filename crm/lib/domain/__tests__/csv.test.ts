import { describe, expect, it } from "vitest";
import {
  cell,
  detectDelimiter,
  looksLikeHeader,
  mapHeaders,
  normalizeHeader,
  parseCellDate,
  parseGrid,
  toCsv,
} from "../csv";

describe("detectDelimiter", () => {
  it("reconnaît un collage tabulé depuis un tableur", () => {
    expect(detectDelimiter("Prénom\tNom\tEmail\nMarie\tDurand\tm@a.fr")).toBe("\t");
  });

  it("reconnaît un export français en point-virgule", () => {
    expect(detectDelimiter("Prénom;Nom;Email")).toBe(";");
  });

  it("reconnaît un export anglo-saxon en virgule", () => {
    expect(detectDelimiter("Prénom,Nom,Email")).toBe(",");
  });

  it("préfère la tabulation quand une cellule contient une virgule", () => {
    expect(detectDelimiter("Nom\tAdresse\nDurand\t12 rue de Paris, Lyon")).toBe("\t");
  });

  it("retombe sur la tabulation pour une colonne unique", () => {
    expect(detectDelimiter("Nom")).toBe("\t");
  });
});

describe("parseGrid", () => {
  it("découpe et nettoie les cellules", () => {
    expect(parseGrid("a;b\n c ; d ")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("écarte les lignes vides, y compris la dernière", () => {
    expect(parseGrid("a;b\n\nc;d\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("respecte les guillemets autour d'un séparateur", () => {
    expect(parseGrid('nom;adresse\n"Durand;fils";Lyon')).toEqual([
      ["nom", "adresse"],
      ["Durand;fils", "Lyon"],
    ]);
  });

  it("lit un guillemet doublé comme un guillemet littéral", () => {
    expect(parseGrid('a\n"il dit ""oui"""')).toEqual([["a"], ['il dit "oui"']]);
  });

  it("tolère les fins de ligne Windows", () => {
    expect(parseGrid("a;b\r\nc;d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("normalizeHeader", () => {
  it("retire accents, casse et ponctuation", () => {
    expect(normalizeHeader("Prénom")).toBe("prenom");
    expect(normalizeHeader("  E-MAIL ")).toBe("email");
    expect(normalizeHeader("Nom de famille")).toBe("nomdefamille");
  });
});

describe("mapHeaders", () => {
  it("reconnaît les intitulés français usuels", () => {
    const mapping = mapHeaders(["Prénom", "Nom", "E-mail", "Société", "Téléphone"]);
    expect(mapping.columns).toEqual({
      firstName: 0,
      lastName: 1,
      email: 2,
      company: 3,
      phone: 4,
    });
    expect(mapping.ignored).toEqual([]);
  });

  it("reconnaît aussi les intitulés anglais", () => {
    const mapping = mapHeaders(["First name", "Last name", "Job title"]);
    expect(mapping.columns).toEqual({ firstName: 0, lastName: 1, title: 2 });
  });

  it("signale les colonnes inconnues au lieu de les deviner", () => {
    const mapping = mapHeaders(["Prénom", "Nom", "Score interne"]);
    expect(mapping.ignored).toEqual(["Score interne"]);
    expect(mapping.columns.firstName).toBe(0);
  });

  it("garde la première colonne quand deux intitulés visent le même champ", () => {
    const mapping = mapHeaders(["Nom", "Nom de famille"]);
    expect(mapping.columns.lastName).toBe(0);
    expect(mapping.ignored).toEqual(["Nom de famille"]);
  });

  it("ignore les colonnes sans intitulé", () => {
    const mapping = mapHeaders(["Prénom", "", "Nom"]);
    expect(mapping.columns).toEqual({ firstName: 0, lastName: 2 });
    expect(mapping.ignored).toEqual([]);
  });
});

describe("looksLikeHeader", () => {
  it("accepte une ligne d'au moins deux intitulés reconnus", () => {
    expect(looksLikeHeader(["Prénom", "Nom"])).toBe(true);
  });

  it("refuse une ligne de données", () => {
    expect(looksLikeHeader(["Marie", "marie@acme.fr", "06 12 34 56 78"])).toBe(false);
  });
});

describe("cell", () => {
  const mapping = mapHeaders(["Prénom", "Nom"]);

  it("lit la colonne correspondante", () => {
    expect(cell(["Marie", "Durand"], mapping, "firstName")).toBe("Marie");
  });

  it("renvoie une chaîne vide pour une colonne absente du tableau", () => {
    expect(cell(["Marie", "Durand"], mapping, "email")).toBe("");
  });

  it("renvoie une chaîne vide pour une ligne plus courte que l'en-tête", () => {
    expect(cell(["Marie"], mapping, "lastName")).toBe("");
  });
});

describe("parseCellDate", () => {
  it("lit le format ISO produit par l'export", () => {
    const parsed = parseCellDate("2026-03-01");
    expect(parsed instanceof Date && parsed.getFullYear()).toBe(2026);
  });

  it("lit le format français sans inverser jour et mois", () => {
    const parsed = parseCellDate("11/02/2026");
    expect(parsed instanceof Date && parsed.getMonth()).toBe(1); // février, pas novembre
    expect(parsed instanceof Date && parsed.getDate()).toBe(11);
  });

  it("accepte aussi le point comme séparateur de date", () => {
    const parsed = parseCellDate("01.12.2026");
    expect(parsed instanceof Date && parsed.getMonth()).toBe(11);
  });

  it("lit une cellule vide comme « pas de date »", () => {
    expect(parseCellDate("   ")).toBeNull();
  });

  it("signale une date illisible plutôt que d'inventer", () => {
    expect(parseCellDate("hier")).toBe("invalid");
  });
});

describe("toCsv", () => {
  it("sépare par point-virgule, comme Excel en français l'attend", () => {
    expect(toCsv([["a", "b"], ["c", "d"]])).toBe("a;b\r\nc;d");
  });

  it("protège les cellules contenant un séparateur, un guillemet ou un saut de ligne", () => {
    expect(toCsv([["Durand;fils", 'il dit "oui"', "deux\nlignes"]])).toBe(
      '"Durand;fils";"il dit ""oui""";"deux\nlignes"',
    );
  });

  it("produit un export relisible par l'import", () => {
    const csv = toCsv([
      ["Prénom", "Nom"],
      ["Marie", "Durand;fils"],
    ]);
    const grid = parseGrid(csv);
    expect(grid[1]).toEqual(["Marie", "Durand;fils"]);
  });

  it("fait l'aller-retour sur une note multiligne", () => {
    const csv = toCsv([
      ["Prénom", "Notes"],
      ["Marie", "Premier appel\nÀ relancer"],
    ]);
    expect(parseGrid(csv)).toEqual([
      ["Prénom", "Notes"],
      ["Marie", "Premier appel\nÀ relancer"],
    ]);
  });
});
