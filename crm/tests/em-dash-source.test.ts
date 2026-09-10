import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { hasDash, stripDashes } from "@/lib/domain/em-dash";
import { COMPANY_CONTEXT, SALES_WRITING_RULES, WRITING_SHAPE } from "@/lib/agents/prompts/company";
import { ALEX } from "@/lib/agents/prompts/alex";
import { SHARED_RULES } from "@/lib/agents/prompts/shared";
import { NO_TEAM_RULE, TEAM_ALLOWED_RULE, sizeFact } from "@/lib/domain/team-mention";

/**
 * **Aucun tiret long, ni dans ce qu'Alex lit, ni dans ce qu'il rend.**
 *
 * Deux façons de rater cette règle, et aucune ne lève d'exception :
 *
 * 1. **la consigne sans la garantie** : le prompt demande, le modèle oublie une
 *    fois sur vingt, et le tiret part chez un prospect qui lit beaucoup de
 *    démarchage. C'est la leçon de la signature au jalon 33 ;
 * 2. **l'exemple qui contredit la consigne** : un prompt qui interdit le tiret
 *    tout en en contenant apprend au modèle à en écrire. On ne montre pas ce
 *    qu'on interdit.
 */

const ROOT = path.join(__dirname, "..");

/** Tout ce qui compose le prompt système d'Alex, plus les règles injectées. */
const READ_BY_ALEX: ReadonlyArray<readonly [string, string]> = [
  ["COMPANY_CONTEXT", COMPANY_CONTEXT],
  ["SALES_WRITING_RULES", SALES_WRITING_RULES],
  ["WRITING_SHAPE", WRITING_SHAPE],
  ["ALEX", ALEX],
  ["SHARED_RULES", SHARED_RULES],
  ["NO_TEAM_RULE", NO_TEAM_RULE],
  ["TEAM_ALLOWED_RULE", TEAM_ALLOWED_RULE],
  ["sizeFact(vide)", sizeFact("")],
  ["sizeFact(renseignée)", sizeFact("250 personnes")],
];

describe("rien de ce qu'Alex lit ne contient de tiret long", () => {
  for (const [name, text] of READ_BY_ALEX) {
    it(`${name} en est exempt`, () => {
      expect(hasDash(text)).toBe(false);
    });
  }

  it("les fichiers de prompt eux-mêmes en sont exempts, commentaires compris", () => {
    // Le fichier entier, pas seulement les chaînes : un tiret dans un
    // commentaire ne part pas sur le fil, mais il finit recopié dans la chaîne
    // voisine à la prochaine retouche.
    const files = [
      "lib/agents/prompts/company.ts",
      "lib/agents/prompts/alex.ts",
      "lib/agents/prompts/shared.ts",
      "lib/domain/team-mention.ts",
      "lib/domain/demo-target.ts",
      "lib/domain/role-angles.ts",
      "lib/agents/email-draft.ts",
      // Ces trois-là composent aussi du texte lu par le modèle : l'appel, la
      // consigne d'accroche entre collègues, la phrase d'ouverture citée. La
      // recette les a désignés en comptant les tirets partis sur le fil.
      "lib/domain/contact-identity.ts",
      "lib/api/departures.ts",
      "lib/api/account.ts",
    ];
    const guilty = files.filter((file) =>
      hasDash(readFileSync(path.join(ROOT, file), "utf8")),
    );
    expect(guilty).toEqual([]);
  });

  it("la consigne nomme les caractères sans les montrer", () => {
    // La règle vit dans la forme attendue, avec les autres règles de rédaction.
    expect(WRITING_SHAPE).toContain("Aucun tiret long");
    expect(WRITING_SHAPE).toContain("cadratin");
    // Le trait d'union ordinaire reste permis, et la consigne le dit.
    expect(WRITING_SHAPE).toContain("e-commerce");
  });
});

describe("le brouillon rendu est nettoyé, pas seulement demandé", () => {
  it("la ponctuation remplace le tiret sans abîmer la phrase", () => {
    expect(stripDashes("Ce sont des ventes, on ne les voit jamais")).toBe(
      "Ce sont des ventes, on ne les voit jamais",
    );
    expect(stripDashes("69 % des visiteurs — c'est beaucoup")).toBe(
      "69 % des visiteurs, c'est beaucoup",
    );
    expect(stripDashes("un mot–un autre")).toBe("un mot, un autre");
    expect(hasDash(stripDashes("a — b – c"))).toBe(false);
  });

  it("le trait d'union ordinaire n'est jamais touché", () => {
    expect(stripDashes("e-commerce, dites-le-moi")).toBe("e-commerce, dites-le-moi");
  });

  it("une puce en tête de ligne redevient un tiret ordinaire", () => {
    expect(stripDashes("— premier point")).toBe("- premier point");
  });

  it("l'enforcement est câblé sur le retour du modèle, objet compris", () => {
    // Statique : la seule façon de vérifier qu'aucun brouillon ne sort sans
    // passer par là, sans appeler le modèle.
    const source = readFileSync(path.join(ROOT, "lib/agents/email-draft.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
    expect(source).toMatch(/subject:\s*stripDashes\(/);
    expect(source).toMatch(/body:\s*stripDashes\(/);
  });
});
