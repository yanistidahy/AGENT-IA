import { afterEach, describe, expect, it } from "vitest";
import { AGENTS, DEFAULT_AGENT_ID, agentSummaries, findAgent, isUnlocked, systemPromptFor } from "../registry";
import { READ_TOOL_NAMES, WRITE_TOOL_NAMES, findTool } from "../tools";

const ORIGINAL = process.env.AGENT_ETIENNE_ENABLED;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.AGENT_ETIENNE_ENABLED;
  else process.env.AGENT_ETIENNE_ENABLED = ORIGINAL;
});

describe("composition du conseil", () => {
  it("compte huit agents, aux identifiants uniques", () => {
    expect(AGENTS).toHaveLength(8);
    expect(new Set(AGENTS.map((a) => a.id)).size).toBe(8);
  });

  it("prend Alfred par défaut", () => {
    expect(findAgent(DEFAULT_AGENT_ID)?.name).toBe("Alfred");
  });

  it("n'autorise que des outils qui existent réellement", () => {
    for (const agent of AGENTS) {
      for (const tool of agent.tools) {
        expect(findTool(tool), `${agent.id} → ${tool}`).toBeDefined();
      }
    }
  });
});

describe("droits d'écriture", () => {
  it("donne tout à Alfred", () => {
    const alfred = findAgent("alfred");
    expect(alfred?.tools).toEqual([...READ_TOOL_NAMES, ...WRITE_TOOL_NAMES]);
  });

  it("laisse Brutus en lecture seule — il commente, il n'agit pas", () => {
    const brutus = findAgent("brutus");
    expect(brutus).toBeDefined();
    for (const tool of brutus?.tools ?? []) {
      expect(findTool(tool)?.mode).toBe("read");
    }
    expect(agentSummaries().find((a) => a.id === "brutus")?.readOnly).toBe(true);
  });

  it("donne à Sacha le nécessaire du pipeline, sans création de contact", () => {
    const sacha = findAgent("sacha")?.tools ?? [];
    expect(sacha).toContain("move_deal_stage");
    expect(sacha).toContain("log_interaction");
    expect(sacha).toContain("create_task");
    expect(sacha).not.toContain("create_contact");
  });

  it("limite Victor et Héloïse à la lecture plus la création de tâche", () => {
    for (const id of ["victor", "heloise"]) {
      const writes = (findAgent(id)?.tools ?? []).filter(
        (tool) => findTool(tool)?.mode === "write",
      );
      expect(writes, id).toEqual(["create_task"]);
    }
  });
});

describe("verrou d'Étienne", () => {
  it("reste verrouillé quand le drapeau est absent, vide ou mal orthographié", () => {
    const etienne = findAgent("etienne");
    expect(etienne).toBeDefined();
    if (etienne === undefined) return;

    for (const value of [undefined, "", "false", "TRUE", "1", "oui"]) {
      if (value === undefined) delete process.env.AGENT_ETIENNE_ENABLED;
      else process.env.AGENT_ETIENNE_ENABLED = value;
      expect(isUnlocked(etienne), `valeur ${String(value)}`).toBe(false);
    }
  });

  it("ne se déverrouille que sur la chaîne exacte « true »", () => {
    const etienne = findAgent("etienne");
    process.env.AGENT_ETIENNE_ENABLED = "true";
    expect(etienne !== undefined && isUnlocked(etienne)).toBe(true);
  });

  it("est le seul agent verrouillé", () => {
    delete process.env.AGENT_ETIENNE_ENABLED;
    const locked = agentSummaries().filter((a) => a.locked);
    expect(locked.map((a) => a.id)).toEqual(["etienne"]);
  });
});

describe("prompts système", () => {
  it("fait 200 à 400 mots de personnalité pour chaque agent actif", () => {
    for (const agent of AGENTS.filter((a) => a.flag === undefined)) {
      const words = agent.persona.trim().split(/\s+/).length;
      expect(words, `${agent.id} : ${words} mots`).toBeGreaterThanOrEqual(200);
      expect(words, `${agent.id} : ${words} mots`).toBeLessThanOrEqual(400);
    }
  });

  it("ajoute le socle commun à chaque prompt", () => {
    for (const agent of AGENTS) {
      const prompt = systemPromptFor(agent);
      expect(prompt, agent.id).toContain("Les données avant tout");
      expect(prompt, agent.id).toContain("vide: true");
    }
  });

  it("interdit explicitement d'inventer des données", () => {
    const prompt = systemPromptFor(AGENTS[0]!);
    expect(prompt).toContain("n'inventes jamais");
  });

  it("dit qu'une écriture n'a lieu qu'après confirmation", () => {
    const prompt = systemPromptFor(AGENTS[0]!);
    expect(prompt).toContain("carte de confirmation");
  });

  it("ne contient aucune consigne d'auto-vérification (calibrage Opus 5)", () => {
    for (const agent of AGENTS) {
      const prompt = systemPromptFor(agent).toLowerCase();
      expect(prompt, agent.id).not.toContain("vérifie ton travail");
      expect(prompt, agent.id).not.toContain("double-vérifie");
    }
  });
});
