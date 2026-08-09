import { afterEach, describe, expect, it } from "vitest";
import {
  AGENTS,
  DEFAULT_AGENT_SLUG,
  findAgent,
  initialsOf,
  isReadOnly,
  isUnlocked,
  systemPromptFor,
} from "../registry";
import { READ_TOOL_NAMES, WRITE_TOOL_NAMES, findTool } from "../tools";

const ORIGINAL = process.env.AGENT_ETIENNE_ENABLED;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.AGENT_ETIENNE_ENABLED;
  else process.env.AGENT_ETIENNE_ENABLED = ORIGINAL;
});

describe("composition du conseil", () => {
  it("compte huit agents, aux identifiants uniques", () => {
    expect(AGENTS).toHaveLength(8);
    expect(new Set(AGENTS.map((a) => a.slug)).size).toBe(8);
  });

  it("prend Sabrina par défaut", () => {
    expect(findAgent(DEFAULT_AGENT_SLUG)?.name).toBe("Sabrina");
  });

  it("n'autorise que des outils qui existent réellement", () => {
    for (const agent of AGENTS) {
      for (const tool of agent.tools) {
        expect(findTool(tool), `${agent.slug} → ${tool}`).toBeDefined();
      }
    }
  });
});

describe("droits d'écriture", () => {
  it("donne tout à Sabrina", () => {
    expect(findAgent("sabrina")?.tools).toEqual([...READ_TOOL_NAMES, ...WRITE_TOOL_NAMES]);
  });

  it("laisse Brutus en lecture seule — il commente, il n'agit pas", () => {
    const brutus = findAgent("brutus");
    expect(brutus).toBeDefined();
    for (const tool of brutus?.tools ?? []) {
      expect(findTool(tool)?.mode).toBe("read");
    }
    expect(isReadOnly(findAgent("brutus")!)).toBe(true);
  });

  it("donne à Sarah le nécessaire du pipeline, sans création de contact", () => {
    const sacha = findAgent("sarah")?.tools ?? [];
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
    const locked = AGENTS.filter((agent) => !isUnlocked(agent));
    expect(locked.map((agent) => agent.slug)).toEqual(["etienne"]);
  });
});

describe("prompts système", () => {
  it("fait 200 à 400 mots de personnalité pour chaque agent actif", () => {
    for (const agent of AGENTS.filter((a) => a.flag === undefined)) {
      const words = agent.persona.trim().split(/\s+/).length;
      expect(words, `${agent.slug} : ${words} mots`).toBeGreaterThanOrEqual(200);
      expect(words, `${agent.slug} : ${words} mots`).toBeLessThanOrEqual(400);
    }
  });

  it("ajoute le socle commun à chaque prompt", () => {
    for (const agent of AGENTS) {
      const prompt = systemPromptFor(agent, { name: agent.name, role: agent.specialty, colleagues: [] });
      expect(prompt, agent.slug).toContain("Les données avant tout");
      expect(prompt, agent.slug).toContain("vide: true");
    }
  });

  it("interdit explicitement d'inventer des données", () => {
    const prompt = systemPromptFor(AGENTS[0]!, { name: "Sabrina", role: "Opérations", colleagues: [] });
    expect(prompt).toContain("n'inventes jamais");
  });

  it("dit qu'une écriture n'a lieu qu'après confirmation", () => {
    const prompt = systemPromptFor(AGENTS[0]!, { name: "Sabrina", role: "Opérations", colleagues: [] });
    expect(prompt).toContain("carte de confirmation");
  });

  it("ne contient aucune consigne d'auto-vérification (calibrage Opus 5)", () => {
    for (const agent of AGENTS) {
      const prompt = systemPromptFor(agent, {
        name: agent.name,
        role: agent.specialty,
        colleagues: [],
      }).toLowerCase();
      expect(prompt, agent.slug).not.toContain("vérifie ton travail");
      expect(prompt, agent.slug).not.toContain("double-vérifie");
    }
  });
});

/**
 * L'identité est de la donnée : ces tests fixent la règle qui rend le renommage
 * sûr — le prompt suit le nom réglé, la personnalité ne le contient pas.
 */
describe("identité injectée", () => {
  const ident = (name: string, role: string) => ({ name, role, colleagues: [] });

  it("présente l'agent sous le nom qu'on lui donne", () => {
    const prompt = systemPromptFor(findAgent("sarah")!, ident("Sandra", "Relance"));
    expect(prompt.startsWith("Tu es Sandra, Relance d'AuraFLOW AI.")).toBe(true);
  });

  it("ne laisse aucun nom d'agent figé dans les personnalités", () => {
    // Le piège que ce test ferme : une personnalité qui s'ouvrirait encore sur
    // « Tu es Sacha » contredirait l'écran après un renommage.
    for (const agent of AGENTS) {
      for (const stale of ["Tu es Sacha", "Tu es Alfred", "Tu es Sarah", "Tu es Sabrina"]) {
        expect(agent.persona, `${agent.slug} contient « ${stale} »`).not.toContain(stale);
      }
    }
  });

  it("liste les collègues pour que le renvoi porte sur des noms exacts", () => {
    const prompt = systemPromptFor(findAgent("brutus")!, {
      name: "Brutus",
      role: "Scale",
      colleagues: [{ name: "Sandra", role: "Relance" }],
    });
    expect(prompt).toContain("**Sandra** — Relance");
  });
});

describe("initiales", () => {
  it("prend la première lettre des deux premiers mots", () => {
    expect(initialsOf("Sabrina Duval")).toBe("SD");
    expect(initialsOf("Sarah")).toBe("S");
    expect(initialsOf("Jean-Pierre Meunier")).toBe("JP");
  });

  it("garde les accents des prénoms français", () => {
    expect(initialsOf("Héloïse")).toBe("H");
    expect(initialsOf("Étienne Roux")).toBe("ÉR");
  });

  it("ne rend jamais une chaîne vide sur un nom non vide", () => {
    expect(initialsOf("  Zoé  ")).toBe("Z");
  });
});
