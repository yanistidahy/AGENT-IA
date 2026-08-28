import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * **Alex ne doit jamais affirmer un DM qui n'a pas eu lieu.**
 *
 * C'est un petit mensonge et une faute fatale : « je vous ai écrit sur
 * Instagram » se vérifie en trois secondes, et ce qui tombe alors n'est pas
 * l'email, c'est la relation. La garantie ne peut pas venir du modèle — elle
 * vient de la **structure de la requête** : le fait est cherché en base, il est
 * annoncé dans le dossier sous ses deux formes, et l'une des deux consignes
 * seulement atteint le modèle.
 *
 * Ces gardes sont statiques parce que le défaut le serait aussi. Retirer la
 * branche négative ne casse aucun type, ne lève aucune exception et ne rend
 * aucun test rouge : elle produit seulement des brouillons qui inventent un
 * message. Même famille que `message-id-source` et `reply-repair-source`.
 */
const DRAFT = readFileSync(join(__dirname, "..", "lib/agents/email-draft.ts"), "utf8");

describe("la mention du DM est commandée par la donnée", () => {
  it("le DM est cherché en base, pas déduit de l'historique affiché", () => {
    // Le déduire des dix dernières interactions serait un pari : sur une fiche
    // bavarde le DM en sort, et Alex se met à mentionner un message incertain.
    expect(DRAFT).toMatch(/prisma\.activity\.findFirst\(/);
    expect(DRAFT).toMatch(/type: "instagram"/);
  });

  it("le dossier porte le fait **dans les deux sens**", () => {
    // Une absence de ligne se lit comme une absence d'information ; une ligne
    // qui dit « non » se lit comme une interdiction.
    expect(DRAFT).toMatch(/AUCUN n'a été envoyé à cette personne/);
    expect(DRAFT).toMatch(/DM Instagram : envoyé le/);
  });

  it("la consigne négative est une interdiction explicite", () => {
    expect(DRAFT).toMatch(/Aucun DM Instagram n'a été envoyé/);
    expect(DRAFT).toMatch(/N'en mentionne donc aucun/);
  });

  it("les deux consignes sont exclusives, décidées par un booléen de la base", () => {
    expect(DRAFT).toMatch(/function dmRule\(dmSent: boolean\)/);
    expect(DRAFT).toMatch(/if \(dmSent\)/);
    expect(DRAFT).toMatch(/dmSent: dm !== null/);
  });
});

describe("le site de la démonstration ne s'invente pas", () => {
  it("il est calculé par le domaine et passé comme une consigne", () => {
    expect(DRAFT).toMatch(/demoTarget\(\{/);
    expect(DRAFT).toMatch(/demoTargetRule\(context\.target\)/);
  });

  it("le dossier annonce explicitement l'absence de site", () => {
    expect(DRAFT).toMatch(/AUCUN site connu/);
  });
});
