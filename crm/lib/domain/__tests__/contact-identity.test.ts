import { describe, expect, it } from "vitest";

import {
  contactTitle,
  greeting,
  greetingRule,
  isUnidentified,
  personName,
  repairGreeting,
} from "../contact-identity";

const BRAND = { firstName: "", lastName: "", company: { name: "Maison Vertu" } };

describe("nommer une fiche", () => {
  it("une personne nommée l'emporte sur tout le reste", () => {
    expect(
      contactTitle({
        firstName: "Caroline",
        lastName: "Miyé",
        company: { name: "Miye Care" },
        email: "caroline@miye.care",
      }),
    ).toBe("Caroline Miyé");
  });

  it("sans personne, la marque devient l'identité", () => {
    expect(contactTitle(BRAND)).toBe("Maison Vertu");
    expect(isUnidentified(BRAND)).toBe(true);
  });

  it("un prénom seul suffit à identifier", () => {
    // Refuser « Caroline » sans nom de famille ferait entrer dans la file de
    // recherche une fiche où il n'y a plus rien à chercher.
    const partial = { firstName: "Caroline", lastName: "" };
    expect(isUnidentified(partial)).toBe(false);
    expect(contactTitle(partial)).toBe("Caroline");
  });

  it("sans marque, on retombe sur ce par quoi on la joint", () => {
    expect(contactTitle({ firstName: "", lastName: "", email: "hello@vertu.fr" })).toBe(
      "hello@vertu.fr",
    );
    expect(contactTitle({ firstName: "", lastName: "", instagram: "@vertu" })).toBe("@vertu");
  });

  it("le dernier repli est une phrase, jamais une ligne vide", () => {
    // Une ligne vide dans une liste ne se clique pas : on croit à une panne
    // d'affichage plutôt qu'à une fiche incomplète.
    expect(contactTitle({ firstName: "", lastName: "" })).toBe("Fiche sans nom");
    expect(contactTitle({ firstName: " ", lastName: " ", company: { name: "  " } })).toBe(
      "Fiche sans nom",
    );
  });

  it("les espaces parasites ne fabriquent pas un nom", () => {
    expect(personName({ firstName: "  ", lastName: "" })).toBe("");
    expect(personName({ firstName: "Jean  ", lastName: "  Vidal" })).toBe("Jean Vidal");
  });
});

describe("l'appel d'un message ne pend jamais", () => {
  it("avec un prénom, il le porte", () => {
    expect(greeting({ firstName: "Caroline", lastName: "Miyé" })).toBe("Bonjour Caroline,");
  });

  it("sans prénom, il est nu — jamais « Bonjour — »", () => {
    expect(greeting(BRAND)).toBe("Bonjour,");
  });

  it("aucun appel produit ne contient de tiret ni de blanc final", () => {
    const cases = [
      BRAND,
      { firstName: "", lastName: "Vidal" },
      { firstName: "", lastName: "", email: "hello@vertu.fr" },
      { firstName: "Caroline", lastName: "" },
    ];
    for (const contact of cases) {
      const line = greeting(contact);
      expect(line).not.toMatch(/—|--/);
      expect(line).not.toMatch(/\s,$/);
      expect(line).toMatch(/^Bonjour(,| \S)/);
    }
  });

  it("la marque ne devient pas le destinataire de l'appel", () => {
    // « Bonjour Maison Vertu, » s'écrit à une entreprise, pas à la personne
    // qui lira le message.
    expect(greeting(BRAND)).not.toContain("Maison Vertu");
  });
});

describe("la consigne au modèle est exclusive, comme celle du DM", () => {
  it("prénom connu : elle le donne", () => {
    const rule = greetingRule({ firstName: "Caroline", lastName: "Miyé" });
    expect(rule).toContain("Bonjour Caroline,");
  });

  it("prénom inconnu : elle **interdit** plutôt que d'omettre", () => {
    const rule = greetingRule(BRAND);
    expect(rule).toContain("Bonjour,");
    expect(rule).toContain("N'invente aucun prénom");
    expect(rule).toContain("sans tiret");
    // La marque est nommée pour que le modèle sache de qui l'on parle, sans
    // pour autant en faire l'appel.
    expect(rule).toContain("Maison Vertu");
  });

  it("ni prénom ni marque : elle le dit plutôt que de se taire", () => {
    const rule = greetingRule({ firstName: "", lastName: "" });
    expect(rule).toContain("ni son prénom ni sa marque");
  });
});

describe("la réparation de l'appel est étroite, et elle est imposée", () => {
  const NAMED = { firstName: "Caroline", lastName: "Miyé" };
  const body = (first: string) => `${first}\n\nEn observant Linaé…\n\nBien à vous,`;

  it("répare les appels qui pendent", () => {
    for (const bad of ["Bonjour —", "Bonjour -", "Bonjour ,", "Bonjour", "Bonjour {{prenom}}"]) {
      const fixed = repairGreeting(body(bad), BRAND);
      expect(fixed.split("\n")[0]).toBe("Bonjour,");
    }
  });

  it("avec un prénom connu, elle le pose", () => {
    expect(repairGreeting(body("Bonjour —"), NAMED).split("\n")[0]).toBe("Bonjour Caroline,");
  });

  it("ne touche pas un appel correct", () => {
    const good = body("Bonjour Caroline,");
    expect(repairGreeting(good, NAMED)).toBe(good);
    expect(repairGreeting(body("Bonjour,"), BRAND)).toBe(body("Bonjour,"));
  });

  it("ne touche pas un message qui ne commence pas par un appel", () => {
    // Réécrire plus large mutilerait un texte que quelqu'un vient de relire.
    const direct = "Votre boutique Linaé…\n\nBien à vous,";
    expect(repairGreeting(direct, BRAND)).toBe(direct);
  });

  it("ne mange jamais le reste du message", () => {
    const fixed = repairGreeting(body("Bonjour —"), BRAND);
    expect(fixed).toContain("En observant Linaé…");
    expect(fixed).toContain("Bien à vous,");
    expect(fixed.split("\n").length).toBe(body("x").split("\n").length);
  });

  it("aucun brouillon réparé ne garde un tiret orphelin sur sa première ligne", () => {
    for (const contact of [BRAND, NAMED, { firstName: "", lastName: "", email: "a@b.fr" }]) {
      for (const bad of ["Bonjour —", "Bonjour", "Bonjour  -  "]) {
        expect(repairGreeting(body(bad), contact).split("\n")[0]).not.toMatch(/—|--|\s-\s|\s,/);
      }
    }
  });
});

describe("sans prénom connu, l'appel ne nomme personne", () => {
  const body = (first: string) => `${first}\n\nEn observant Linaé…\n\nBien à vous,`;

  it("un prénom fabriqué depuis la marque est retiré", () => {
    // Trouvé à la vérification du jalon 50 : le brouillon s'ouvrait sur
    // « Bonjour Maison, » pour la fiche « Maison Vertu ». Ça ressemble à un
    // prénom, donc ça passe la relecture — et ça se lit chez le destinataire
    // comme un publipostage mal fusionné.
    expect(repairGreeting(body("Bonjour Maison,"), BRAND).split("\n")[0]).toBe("Bonjour,");
    expect(repairGreeting(body("Bonjour Maison Vertu,"), BRAND).split("\n")[0]).toBe("Bonjour,");
    expect(repairGreeting(body("Bonjour l'équipe,"), BRAND).split("\n")[0]).toBe("Bonjour,");
  });

  it("« Bonjour, » exact est laissé tel quel", () => {
    const good = body("Bonjour,");
    expect(repairGreeting(good, BRAND)).toBe(good);
  });

  it("avec un prénom connu, un vrai nom n'est jamais touché", () => {
    // La règle stricte ne vaut que pour les fiches sans personne : ailleurs,
    // réécrire un appel correct serait une régression.
    const named = { firstName: "Caroline", lastName: "Miyé" };
    const good = body("Bonjour Caroline,");
    expect(repairGreeting(good, named)).toBe(good);
  });

  it("le reste du message survit dans tous les cas", () => {
    for (const first of ["Bonjour Maison,", "Bonjour —", "Bonjour l'équipe,"]) {
      const fixed = repairGreeting(body(first), BRAND);
      expect(fixed).toContain("En observant Linaé…");
      expect(fixed).toContain("Bien à vous,");
    }
  });
});
