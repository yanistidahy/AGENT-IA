import { describe, expect, it } from "vitest";
import { ALL_TOOLS } from "../tools";
import {
  describeViolation,
  findKeyViolations,
  findNameViolation,
  inspectTool,
  TOOL_KEY_PATTERN,
} from "@/lib/domain/tool-schema";

/**
 * Garde de forme des schémas d'outils.
 *
 * Ce test existe à cause d'un incident réel. `list_neglected_contacts` déclarait
 * une propriété `catégorie` ; l'API refuse toute clé hors de
 * `^[a-zA-Z0-9_.-]{1,64}$`, et le conseil entier était donc inutilisable — la
 * requête était rejetée avant d'atteindre le modèle. Le défaut a survécu à
 * quatre jalons parce qu'aucun appel réel n'avait été passé et que le serveur
 * de substitution acceptait tout.
 *
 * La leçon est celle du test de parité SQL/mémoire : une contrainte qu'on ne
 * peut vérifier qu'en production n'est pas vérifiée. Celle-ci est purement
 * syntaxique — elle appartient à `vitest`.
 */

describe("forme des outils exposés à l'API", () => {
  it("n'expose aucune clé de propriété hors du motif autorisé", () => {
    const violations = ALL_TOOLS.flatMap((tool) =>
      inspectTool(tool.name, tool.inputSchema).map((v) => describeViolation(tool.name, v)),
    );

    // Le message d'échec nomme l'outil et la clé : le prochain à tomber
    // dedans n'aura pas à rejouer l'enquête.
    expect(violations).toEqual([]);
  });

  it("n'expose aucun nom d'outil hors du motif autorisé", () => {
    for (const tool of ALL_TOOLS) {
      expect(findNameViolation(tool.name), tool.name).toBeNull();
    }
  });

  it("couvre bien les vingt-et-un outils du registre", () => {
    // Sans ce compte, un registre vidé par erreur ferait passer le test
    // ci-dessus pour un succès.
    expect(ALL_TOOLS.length).toBe(21);
    for (const tool of ALL_TOOLS) {
      expect(tool.inputSchema, tool.name).toHaveProperty("type", "object");
    }
  });
});

/**
 * Éprouvé en réintroduisant volontairement le défaut : sans ces cas, rien ne
 * prouverait que la garde détecte quoi que ce soit.
 */
describe("la garde détecte ce qu'elle prétend détecter", () => {
  it("repère un accent à la racine — le défaut exact de l'incident", () => {
    const schema = {
      type: "object",
      properties: { catégorie: { type: "string" }, limit: { type: "integer" } },
    };
    const violations = findKeyViolations(schema);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.key).toBe("catégorie");
  });

  it("repère un accent dans un objet imbriqué", () => {
    const schema = {
      type: "object",
      properties: {
        filtre: { type: "object", properties: { propriétaire: { type: "string" } } },
      },
    };
    expect(findKeyViolations(schema).map((v) => v.key)).toEqual(["propriétaire"]);
  });

  it("descend dans les tableaux — anyOf, items", () => {
    const schema = {
      type: "object",
      properties: {
        cible: {
          anyOf: [
            { type: "null" },
            { type: "object", properties: { "nom société": { type: "string" } } },
          ],
        },
        lignes: { type: "array", items: { type: "object", properties: { "montant€": { type: "number" } } } },
      },
    };
    expect(findKeyViolations(schema).map((v) => v.key).sort()).toEqual(["montant€", "nom société"]);
  });

  it("refuse espace, apostrophe et clé trop longue", () => {
    for (const key of ["deux mots", "l'outil", "é", "a".repeat(65)]) {
      expect(TOOL_KEY_PATTERN.test(key), key).toBe(false);
    }
  });

  it("accepte ce que l'API accepte : lettres, chiffres, _ . -", () => {
    for (const key of ["category", "due_date", "v1.2", "a-b", "a".repeat(64)]) {
      expect(TOOL_KEY_PATTERN.test(key), key).toBe(true);
    }
  });

  it("repère un nom d'outil fautif", () => {
    expect(findNameViolation("liste_société")?.key).toBe("liste_société");
    expect(findNameViolation("list_companies")).toBeNull();
  });
});
