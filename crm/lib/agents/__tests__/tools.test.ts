import { describe, expect, it } from "vitest";
import { ALL_TOOLS, READ_TOOL_NAMES, WRITE_TOOL_NAMES, findTool, toolsFor } from "../tools";

/**
 * Ces tests portent sur le contrat du registre — modes, schémas, validation —
 * sans toucher la base. Les implémentations Prisma sont exercées par le test
 * d'acceptation en production.
 */

describe("registre d'outils", () => {
  it("expose les treize lectures et les sept écritures attendues", () => {
    expect(READ_TOOL_NAMES).toEqual([
      // Jalon 2 : affaires, sociétés, tâches, indicateurs.
      "search_contacts",
      "get_company",
      "list_deals",
      "get_deal_detail",
      "list_tasks",
      "get_kpis",
      "get_stuck_deals",
      // Ouverts après les jalons 3 à 6 : relances, alertes, chronologies,
      // séquences, portefeuille.
      "list_reminders",
      "list_neglected_contacts",
      "list_alerts",
      "get_timeline",
      "list_sequences",
      "list_clients",
    ]);
    expect(WRITE_TOOL_NAMES).toEqual([
      "create_task",
      "log_interaction",
      "move_deal_stage",
      "update_deal",
      "create_contact",
      "set_reminder",
      "run_sequence",
    ]);
  });

  /**
   * Le conseil doit voir ce que le CRM sait faire. Ce test tombe le jour où un
   * jalon ajoute une capacité sans l'ouvrir aux agents — la régression exacte
   * qui a laissé Sacha aveugle aux relances pendant quatre jalons.
   */
  it("couvre les capacités livrées : relances, alertes, chronologie, séquences, clients", () => {
    for (const capability of [
      "list_reminders",
      "list_neglected_contacts",
      "list_alerts",
      "get_timeline",
      "list_sequences",
      "list_clients",
    ]) {
      expect(findTool(capability), capability).toBeDefined();
    }
  });

  it("classe chaque outil dans un mode et un seul", () => {
    for (const tool of ALL_TOOLS) {
      const isRead = READ_TOOL_NAMES.includes(tool.name);
      const isWrite = WRITE_TOOL_NAMES.includes(tool.name);
      expect(isRead !== isWrite, tool.name).toBe(true);
      expect(tool.mode, tool.name).toBe(isRead ? "read" : "write");
    }
  });

  it("décrit chaque outil en français, assez longuement pour guider le modèle", () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.description.length, tool.name).toBeGreaterThan(60);
    }
  });

  it("produit un schéma JSON objet, sans clé $schema que l'API rejetterait", () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.inputSchema.type, tool.name).toBe("object");
      expect(tool.inputSchema, tool.name).not.toHaveProperty("$schema");
    }
  });

  it("filtre par liste blanche en conservant l'ordre du registre", () => {
    const subset = toolsFor(["get_kpis", "search_contacts", "inexistant"]);
    expect(subset.map((tool) => tool.name)).toEqual(["search_contacts", "get_kpis"]);
  });
});

describe("validation avant exécution", () => {
  it("refuse une entrée invalide sans jamais atteindre la base", async () => {
    const tool = findTool("create_task");
    expect(tool).toBeDefined();
    if (tool === undefined) return;

    const outcome = await tool.run({ title: "", due: "pas une date", owner: "" });
    expect(outcome.ok).toBe(false);
    expect(JSON.stringify(outcome.data)).toContain("Arguments invalides");
  });

  it("signale une date illisible plutôt que de l'ignorer", async () => {
    const tool = findTool("log_interaction");
    const outcome = await tool?.run({
      type: "call",
      date: "hier",
      notes: "test",
      owner: "Yanis",
    });
    expect(outcome?.ok).toBe(false);
    expect(JSON.stringify(outcome?.data)).toContain("Date invalide");
  });

  it("rejette un type d'interaction inconnu", async () => {
    const tool = findTool("log_interaction");
    const outcome = await tool?.run({
      type: "pigeon voyageur",
      date: "2026-01-01",
      notes: "test",
      owner: "Yanis",
    });
    expect(outcome?.ok).toBe(false);
  });
});

describe("cartes de confirmation", () => {
  it("résume une création de tâche de façon lisible", async () => {
    const tool = findTool("create_task");
    const summary = await tool?.summarize({
      title: "Relancer Sophie",
      due: "2026-09-30",
      priority: "haute",
      owner: "Yanis",
    });

    expect(summary?.headline).toContain("Relancer Sophie");
    expect(summary?.details.join(" ")).toContain("haute");
    expect(summary?.details.join(" ")).toContain("Yanis");
  });

  it("ne laisse jamais une carte sans intitulé, même sur entrée invalide", async () => {
    for (const name of WRITE_TOOL_NAMES) {
      const summary = await findTool(name)?.summarize({});
      expect(summary?.headline.length, name).toBeGreaterThan(0);
    }
  });
});

/**
 * Régression : une vacation doit pouvoir écarter une action mal formée **avant**
 * de la proposer. `summarize()` ne sert pas à cela — c'est le piège qui a laissé
 * passer une action invalide jusqu'à la carte de confirmation, où elle
 * n'échouait qu'au clic.
 */
describe("validation des arguments avant proposition", () => {
  const setReminder = findTool("set_reminder");

  it("`accepts` refuse une entrée invalide et accepte une entrée valide", () => {
    expect(setReminder).toBeDefined();
    expect(
      setReminder?.accepts({ contactId: "c1", contactName: "Awa", date: "pas-une-date" }),
    ).toBe(false);
    expect(setReminder?.accepts({ contactId: "c1", contactName: "Awa", date: "2026-09-15" })).toBe(
      true,
    );
  });

  it("`summarize` ne lève pas sur une entrée invalide — d'où l'existence de `accepts`", async () => {
    const summary = await setReminder?.summarize({ date: "pas-une-date" });
    expect(summary?.headline).toContain("arguments invalides");
  });

  it("`run` refuse sans lever, en renvoyant ok: false", async () => {
    const result = await setReminder?.run({ date: "pas-une-date" });
    expect(result?.ok).toBe(false);
  });
});
