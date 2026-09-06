import { describe, expect, it } from "vitest";

import {
  matchRole,
  normalizeRoleLabel,
  roleAngleRule,
  unmatchedTitles,
  type RoleAngleLike,
} from "../role-angles";

const sav: RoleAngleLike = {
  id: "r_sav",
  name: "Responsable SAV",
  angle:
    "Elle mesure son volume de tickets et son temps de réponse. Parler du SAV absorbé, pas de conversion.",
  labels: ["Responsable SAV", "Head of Customer Care", "Responsable service client", "SAV Manager"],
};

const ecom: RoleAngleLike = {
  id: "r_ecom",
  name: "Responsable e-commerce",
  angle: "Il regarde le taux de conversion et le panier moyen.",
  labels: ["Responsable e-commerce", "E-commerce Manager", "Head of E-commerce"],
};

const ROLES = [sav, ecom];

describe("apparier une fonction à un rôle", () => {
  it("absorbe casse, accents, ponctuation et espaces — mais rien de plus", () => {
    // Ce sont les seules différences qui ne veulent rien dire. Tout le reste
    // est une information, et une information ne se normalise pas.
    expect(normalizeRoleLabel("Responsable S.A.V.")).toBe("responsable s a v");
    expect(normalizeRoleLabel("  RESPONSABLE   SAV  ")).toBe("responsable sav");
    expect(normalizeRoleLabel("Chargée de Relation Client")).toBe("chargee de relation client");
    expect(normalizeRoleLabel("")).toBe("");
    expect(normalizeRoleLabel("—")).toBe("");
  });

  it("reconnaît les trois formulations d'un même métier", () => {
    // Le cas d'usage littéral : trois fichiers d'enrichissement, trois façons
    // de nommer la même personne.
    for (const title of ["Head of Customer Care", "Responsable service client", "SAV Manager"]) {
      const match = matchRole(title, ROLES);
      expect(match.kind, `« ${title} » devrait tomber sur le rôle SAV`).toBe("role");
      if (match.kind === "role") expect(match.role.id).toBe("r_sav");
    }
  });

  it("l'étiquette la plus précise l'emporte sur la plus courte", () => {
    // « Responsable SAV France » contient « responsable » et « responsable sav ».
    // C'est la seconde qui décrit la personne.
    const roles = [{ ...ecom, labels: ["Responsable"] }, sav];
    const match = matchRole("Responsable SAV France", roles);
    expect(match.kind).toBe("role");
    if (match.kind === "role") {
      expect(match.role.id).toBe("r_sav");
      expect(match.matched).toBe("Responsable SAV");
    }
  });

  it("ne reconnaît pas une étiquette au milieu d'un mot", () => {
    // « ops » dans « opsourcing » : l'inclusion porte sur des mots entiers,
    // sinon une étiquette courte attraperait n'importe quoi.
    const roles = [{ ...ecom, labels: ["ops"] }];
    expect(matchRole("Opsourcing Lead", roles).kind).toBe("generic");
    expect(matchRole("Head of Ops", roles).kind).toBe("role");
  });

  it("renonce plutôt que de trancher entre deux rôles également fondés", () => {
    // Choisir ici reviendrait à tirer au sort l'angle sous lequel on écrit à
    // quelqu'un. L'intitulé remonte dans les non appariés, où une étiquette
    // plus précise le tranchera.
    const roles = [
      { ...sav, labels: ["client"] },
      { ...ecom, labels: ["client"] },
    ];
    const match = matchRole("Directrice Client", roles);
    expect(match.kind).toBe("generic");
    if (match.kind === "generic") expect(match.reason).toBe("ambiguous");
  });

  it("une fiche sans fonction n'est pas un échec d'appariement", () => {
    const match = matchRole("", ROLES);
    expect(match.kind).toBe("generic");
    if (match.kind === "generic") expect(match.reason).toBe("no-title");
  });
});

describe("la consigne d'angle envoyée à Alex", () => {
  it("porte la note écrite par l'utilisateur, mot pour mot", () => {
    const rule = roleAngleRule(matchRole("Head of Customer Care", ROLES));
    expect(rule).toContain(sav.angle);
    expect(rule).toContain("Responsable SAV");
  });

  it("un rôle reconnu mais sans note écrite ne vaut pas un angle", () => {
    // L'état de tous les rôles au lendemain de la migration : semés, nommés,
    // sans note. Annoncer « angle pour Responsable SAV » puis rien ferait
    // remplir le vide par le modèle — exactement ce qu'on veut empêcher.
    const rule = roleAngleRule(matchRole("SAV Manager", [{ ...sav, angle: "   " }]));
    expect(rule).toContain("AUCUN");
    expect(rule).toContain("Responsable SAV");
    expect(rule).toContain("aucune note d'angle n'a encore été écrite");
    expect(rule).toContain("N'invente pas");
  });

  it("dit **explicitement** qu'il n'y a pas d'angle, et interdit d'en inventer un", () => {
    // La règle du DM du jalon 48 : une absence de ligne se lit comme une
    // absence d'information, une ligne qui dit « aucun » se lit comme une
    // interdiction. Sans elle, le modèle déduit un angle de l'intitulé.
    for (const title of ["", "Office Manager", "Directrice Client"]) {
      const roles =
        title === "Directrice Client"
          ? [
              { ...sav, labels: ["client"] },
              { ...ecom, labels: ["client"] },
            ]
          : ROLES;
      const rule = roleAngleRule(matchRole(title, roles));
      expect(rule, `« ${title} »`).toContain("AUCUN");
      expect(rule).toContain("N'invente pas");
      expect(rule).not.toContain(sav.angle);
    }
  });
});

describe("les fonctions qu'aucun rôle ne reconnaît", () => {
  const titles = [
    { title: "Head of Customer Care", contacts: 3 },
    { title: "Office Manager", contacts: 5 },
    { title: "Chief Happiness Officer", contacts: 1 },
    { title: "Growth Lead", contacts: 5 },
    { title: "", contacts: 12 },
  ];

  it("liste les non appariés, les plus portés d'abord", () => {
    const rows = unmatchedTitles(titles, ROLES);
    expect(rows.map((r) => r.title)).toEqual([
      "Growth Lead",
      "Office Manager",
      "Chief Happiness Officer",
    ]);
    expect(rows[0]?.contacts).toBe(5);
  });

  it("écarte les appariés **et** les fiches sans fonction", () => {
    // Une fiche sans intitulé n'appelle aucune étiquette à ajouter : c'est une
    // donnée à saisir, pas un réglage à étendre. La faire figurer ici enverrait
    // travailler sur une ligne vide — et les 12 fiches concernées noieraient la
    // liste en tête, puisqu'elle est triée par nombre.
    const rows = unmatchedTitles(titles, ROLES);
    expect(rows.some((r) => r.title === "Head of Customer Care")).toBe(false);
    expect(rows.some((r) => r.title === "")).toBe(false);
  });

  it("signale l'ambiguïté comme telle, et non comme une absence", () => {
    // Les deux demandent le même geste — écrire une étiquette — mais pas la
    // même : ici il faut *désambiguïser*, pas ajouter.
    const roles = [
      { ...sav, labels: ["client"] },
      { ...ecom, labels: ["client"] },
    ];
    const rows = unmatchedTitles([{ title: "Directrice Client", contacts: 2 }], roles);
    expect(rows[0]?.reason).toBe("ambiguous");
  });
});
