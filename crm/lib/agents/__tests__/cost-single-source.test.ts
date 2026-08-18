import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **Aucun appel au modèle n'échappe au compteur.**
 *
 * C'est la garde statique de ce jalon, dans la lignée de
 * `status-single-source.test.ts` (jalon 29) et de
 * `no-duplicate-thresholds.test.ts` (jalon 7). Elle ferme le chemin par lequel
 * le défaut est réellement arrivé : `email-draft.ts` s'était mis, au jalon 32,
 * à appeler l'API directement — son propre modèle, son propre plafond, son
 * propre effort — pendant que `request.ts` prétendait être le seul endroit où
 * ces quatre choses se décident. Le chemin le plus cher du produit était donc
 * le seul à n'être gouverné par rien, et personne ne l'a vu parce que rien ne
 * regardait.
 *
 * Deux exigences, sur tout fichier qui appelle `messages.create` ou
 * `messages.stream` :
 *
 * 1. il compose sa requête avec `requestFor()` ou `shiftRequest()` ;
 * 2. il consigne ce qu'elle a coûté avec `recordUsage()`.
 */

const ROOTS = ["lib", "app"];

/**
 * Le diagnostic de `/reglages` est la seule exception, et elle est nommée.
 *
 * Il envoie cinq requêtes **délibérément malformées ou minimales**, chacune
 * ajoutant un champ à la précédente, pour désigner celui que l'API refuse.
 * Les faire passer par le socle commun supprimerait précisément ce qu'elles
 * mesurent. Elles coûtent 16 jetons chacune et ne sont lancées qu'au clic.
 */
const ALLOWED = ["lib/agents/runtime/diagnostic.ts"];

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      found.push(...walk(path));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      found.push(path);
    }
  }
  return found;
}

const CALLERS = ROOTS.flatMap(walk)
  .map((path) => ({ path, source: readFileSync(path, "utf8") }))
  .filter(({ source }) => /messages\.(create|stream)\s*\(/.test(source))
  .filter(({ path }) => !ALLOWED.includes(path.replace(/\\/g, "/")));

describe("un seul socle de requête, un seul compteur", () => {
  it("trouve bien les appelants — sans quoi le test ne prouverait rien", () => {
    // Un balayage qui ne trouve rien serait vert et vide de sens.
    expect(CALLERS.length).toBeGreaterThanOrEqual(3);
  });

  it("chaque appel compose sa requête avec le socle commun", () => {
    for (const { path, source } of CALLERS) {
      const composed = /requestFor\s*\(|shiftRequest\s*\(/.test(source);
      expect(composed, `${path} appelle l'API sans passer par request.ts`).toBe(true);
    }
  });

  it("chaque appel consigne ce qu'il a coûté", () => {
    for (const { path, source } of CALLERS) {
      expect(
        /recordUsage\s*\(/.test(source),
        `${path} appelle l'API sans consigner son coût`,
      ).toBe(true);
    }
  });

  /**
   * Le plafond mensuel ne sert à rien s'il ne couvre que les vacations — c'est
   * l'état d'avant ce jalon, et la rédaction d'emails était précisément ce qui
   * coûtait.
   */
  it("chaque appel vérifie le plafond avant de partir", () => {
    for (const { path, source } of CALLERS) {
      expect(
        /budgetRefusal\s*\(/.test(source),
        `${path} appelle l'API sans vérifier le plafond mensuel`,
      ).toBe(true);
    }
  });
});
