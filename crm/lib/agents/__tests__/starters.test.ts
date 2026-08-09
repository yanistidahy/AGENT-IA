import { describe, expect, it } from "vitest";
import { AGENTS } from "../registry";
import { startersFor, STARTERS } from "../starters";

/**
 * Les amorces sont ce qu'on voit avant d'avoir écrit un mot : si elles sont
 * génériques, l'écran d'ouverture ne dit rien de plus que l'ancien.
 */

describe("amorces de conversation", () => {
  it("donne quatre amorces à chacun des huit agents", () => {
    for (const agent of AGENTS) {
      expect(agent.starters, agent.slug).toHaveLength(4);
    }
    expect(Object.keys(STARTERS).sort()).toEqual(AGENTS.map((a) => a.slug).sort());
  });

  it("porte une question et un sous-titre non vides, sans doublon", () => {
    for (const agent of AGENTS) {
      const questions = agent.starters.map((starter) => {
        expect(starter.question.trim(), agent.slug).not.toBe("");
        expect(starter.subtitle.trim(), agent.slug).not.toBe("");
        return starter.question;
      });
      expect(new Set(questions).size, `${agent.slug} : questions dupliquées`).toBe(4);
    }
  });

  /**
   * Le piège que ce test ferme : recopier les mêmes quatre questions partout.
   * Chaque amorce doit appartenir à un seul agent — sinon elles ne viennent pas
   * du périmètre, elles viennent d'un gabarit.
   */
  it("n'emploie aucune question sur deux agents à la fois", () => {
    const seen = new Map<string, string>();
    for (const agent of AGENTS) {
      for (const starter of agent.starters) {
        const owner = seen.get(starter.question);
        expect(owner, `« ${starter.question} » partagée avec ${owner ?? ""}`).toBeUndefined();
        seen.set(starter.question, agent.slug);
      }
    }
    expect(seen.size).toBe(AGENTS.length * 4);
  });

  it("évite les formules creuses qui n'engagent à rien", () => {
    const hollow = [/^que peux-tu faire/i, /^aide-moi$/i, /^bonjour/i, /^présente-toi/i];
    for (const agent of AGENTS) {
      for (const starter of agent.starters) {
        for (const pattern of hollow) {
          expect(pattern.test(starter.question), `${agent.slug} : « ${starter.question} »`).toBe(
            false,
          );
        }
      }
    }
  });

  it("garde les quatre amorces de Sarah telles qu'elles ont été spécifiées", () => {
    expect(startersFor("sarah").map((s) => s.question)).toEqual([
      "Qu'est-ce que je fais aujourd'hui ?",
      "Qui ai-je oublié ?",
      "Quels prospects abandonner ?",
      "Prépare mon prochain appel",
    ]);
  });

  it("rend un tableau vide — jamais undefined — pour un slug inconnu", () => {
    expect(startersFor("personne")).toEqual([]);
  });
});
