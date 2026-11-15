import { describe, expect, it } from "vitest";
import {
  companyKeyOf,
  domainKey,
  looksLikeDomain,
  planVisitorsImport,
  readColumns,
  type ImportCompany,
} from "../visitors-import";
import { parseGrid } from "../csv";

/**
 * **Le collage de trafics, et les quatre façons dont une ligne n'aboutit pas.**
 *
 * Ce qui est fixé ici n'est pas « l'import marche », c'est **ce qu'il refuse de
 * faire** : créer une société, deviner un nombre, trancher une ambiguïté, ou
 * compter comme « mise à jour » une ligne qui n'a rien changé. Chacun de ces
 * quatre refus est une façon précise d'abîmer des données en silence.
 */

const COMPANIES: readonly ImportCompany[] = [
  { id: "c1", name: "Zénith Labs", domain: "zenithlabs.fr", monthlyVisitors: null },
  { id: "c2", name: "Maison Clé", domain: "https://www.maison-cle.com/", monthlyVisitors: 4_000 },
  { id: "c3", name: "Studio Kaolin", domain: "", monthlyVisitors: null },
  // Deux maisons portent le même nom plié : la clé est ambiguë, et le dire est
  // la seule réponse honnête.
  { id: "c4", name: "Atelier", domain: "atelier-a.fr", monthlyVisitors: null },
  { id: "c5", name: "atelier", domain: "atelier-b.fr", monthlyVisitors: null },
];

describe("les clés de rapprochement", () => {
  it("réduit un domaine à ce qui l'identifie", () => {
    expect(domainKey("https://www.Example.com/tarifs")).toBe("example.com");
    expect(domainKey("www.example.com")).toBe("example.com");
    expect(domainKey("EXAMPLE.COM:443")).toBe("example.com");
    expect(domainKey("  ")).toBe("");
  });

  it("plie un nom comme la base le fait", () => {
    // Même pli que `Company.nameKey` : deux plis différents feraient qu'une
    // société trouvée au tri serait introuvable à l'import.
    expect(companyKeyOf("Zénith Labs")).toBe(companyKeyOf("zenith labs"));
    expect(companyKeyOf("  ")).toBe("");
  });

  it("distingue un domaine d'un nom de maison", () => {
    expect(looksLikeDomain("zenithlabs.fr")).toBe(true);
    expect(looksLikeDomain("https://www.maison-cle.com/")).toBe(true);
    expect(looksLikeDomain("Zenith Labs")).toBe(false);
    expect(looksLikeDomain("Atelier")).toBe(false);
    expect(looksLikeDomain("")).toBe(false);
  });
});

describe("les colonnes du collage", () => {
  it("reconnaît un en-tête, dans n'importe quel ordre", () => {
    expect(readColumns(parseGrid("Visiteurs;Société\n8000;Zénith Labs"))).toEqual({
      key: 1,
      value: 0,
      hasHeader: true,
    });
  });

  it("accepte deux colonnes sans en-tête, le geste le plus courant", () => {
    expect(readColumns(parseGrid("zenithlabs.fr;8000"))).toEqual({
      key: 0,
      value: 1,
      hasHeader: false,
    });
  });

  it("refuse de deviner au-delà de deux colonnes sans en-tête", () => {
    // Choisir laquelle des quatre porte le trafic serait un tirage au sort sur
    // la donnée de quelqu'un.
    expect(readColumns(parseGrid("a;b;c;d"))).toBeNull();
    expect(readColumns([])).toBeNull();
  });
});

describe("le plan d'import", () => {
  /** L'item 4 du test d'acceptation, à la ligne près. */
  it("met à jour les lignes rapprochées et nomme celles qui ne le sont pas", () => {
    const plan = planVisitorsImport(
      [
        "Domaine;Visiteurs",
        "zenithlabs.fr;8000",
        "maison-cle.com;12 000",
        "Studio Kaolin;3k",
        "inconnue.fr;5000",
        "Maison Fantôme;900",
      ].join("\n"),
      COMPANIES,
    );

    expect(plan.read).toBe(5);
    expect(plan.updated).toBe(3);
    expect(plan.unmatched).toBe(2);
    expect(plan.unchanged).toBe(0);
    expect(plan.unreadable).toBe(0);

    // Les deux non rapprochées sont **nommées**, pas seulement comptées.
    expect(plan.lines.filter((line) => line.outcome === "unmatched").map((line) => line.raw)).toEqual(
      ["inconnue.fr", "Maison Fantôme"],
    );

    // Et les trois rapprochées portent bien la valeur lue, y compris « 3k ».
    const kaolin = plan.lines.find((line) => line.companyId === "c3");
    expect(kaolin?.visitors).toBe(3_000);
    expect(kaolin?.before).toBeNull();
  });

  it("distingue « inchangée » de « mise à jour »", () => {
    // Rejouer le même collage doit rendre 0 mise à jour : « 120 mises à jour »
    // sur un second passage ferait douter du premier.
    const plan = planVisitorsImport("maison-cle.com;4000", COMPANIES);
    expect(plan.updated).toBe(0);
    expect(plan.unchanged).toBe(1);
    expect(plan.lines[0]?.before).toBe(4_000);
  });

  it("refuse un nombre illisible plutôt que de le ranger à zéro", () => {
    const plan = planVisitorsImport(
      ["zenithlabs.fr;beaucoup", "maison-cle.com;"].join("\n"),
      COMPANIES,
    );
    expect(plan.unreadable).toBe(2);
    expect(plan.updated).toBe(0);
    expect(plan.lines[0]?.reason).toContain("beaucoup");
    expect(plan.lines[0]?.visitors).toBeNull();
  });

  it("ne tranche pas une clé ambiguë", () => {
    const plan = planVisitorsImport("Atelier;9000", COMPANIES);
    expect(plan.ambiguous).toBe(1);
    expect(plan.lines[0]?.companyId).toBeNull();
    expect(plan.lines[0]?.reason).toContain("Plusieurs sociétés");
  });

  it("ne porte aucune ligne qui créerait une société", () => {
    // La garantie structurelle : un plan ne contient que des décisions, et
    // aucune d'elles ne nomme une société inexistante avec un identifiant.
    const plan = planVisitorsImport("inconnue.fr;5000", COMPANIES);
    for (const line of plan.lines) {
      if (line.outcome === "unmatched") expect(line.companyId).toBeNull();
    }
  });

  it("lit les quatre écritures du brief dans une colonne de tableur", () => {
    const plan = planVisitorsImport(
      [
        "Société;Visiteurs",
        "Zénith Labs;8 000",
        "Maison Clé;8 000",
        "Studio Kaolin;8.5k",
      ].join("\n"),
      COMPANIES,
    );
    expect(plan.lines.map((line) => line.visitors)).toEqual([8_000, 8_000, 8_500]);
  });

  it("rend un plan vide plutôt que de lever sur un collage incompréhensible", () => {
    const plan = planVisitorsImport("a;b;c;d\n1;2;3;4", COMPANIES);
    expect(plan.read).toBe(0);
    expect(plan.lines).toEqual([]);
  });
});
