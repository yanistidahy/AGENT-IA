import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { NO_TEAM_RULE, noteAllowsTeam, sizeFact, teamMentionRule } from "@/lib/domain/team-mention";

/**
 * **Le discours ne suppose pas d'équipe.**
 *
 * « Votre équipe doit certainement gérer un volume important de questions
 * récurrentes » se lit faux à une marque de trois personnes, et la moitié du
 * vivier en est une. Le prospect sait qu'il n'a pas d'équipe : la phrase le lui
 * rappelle, et le message est mort à la première ligne.
 *
 * La garde est statique parce que le défaut l'est : une phrase de prompt est du
 * texte, elle ne lève rien, ne casse aucun type, et ne se voit qu'à la lecture
 * d'un brouillon parti chez un vrai prospect.
 */

const ROOT = path.join(__dirname, "..");

function sourceOf(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8");
}

describe("aucune phrase du discours ne présume une équipe", () => {
  const company = sourceOf("lib/agents/prompts/company.ts");

  it("la formule fautive a disparu du mail de référence et des règles", () => {
    // Elle ne doit plus apparaître **qu'en interdiction** — jamais comme
    // modèle à suivre.
    expect(company).not.toContain("Votre équipe doit certainement");
    expect(company).not.toContain("dont l'équipe gère un volume important");
  });

  it("chaque mention restante d'« équipe » est une interdiction", () => {
    const lines = company.split("\n").filter((line) => /équipe/i.test(line));
    expect(lines.length).toBeGreaterThan(0);
    const forbidding = lines.filter((line) =>
      /jamais|ne présume|n'a pas d'équipe|présume|interdit|AuraFLOW AI/i.test(line),
    );
    // Une ligne qui parle d'équipe sans l'interdire est une ligne qui l'autorise.
    expect(forbidding.length).toBe(lines.length);
  });

  it("le ciblage dit que les cibles sont le plus souvent petites", () => {
    expect(company).toMatch(/le plus souvent petites/i);
  });
});

describe("la consigne est émise dans les deux sens", () => {
  it("sans autorisation, elle interdit explicitement", () => {
    const rule = teamMentionRule("");
    expect(rule).toBe(NO_TEAM_RULE);
    expect(rule).toContain("N'évoque ni équipe, ni volume, ni échelle");
    // Le cas négatif doit être une règle, pas un silence : une absence de ligne
    // se lit comme une absence d'information (jalons 48 et 53).
    expect(rule).toContain("votre équipe");
  });

  it("seule la note écrite à la main autorise la mention", () => {
    expect(noteAllowsTeam("Marque établie, a une équipe support dédiée")).toBe(true);
    expect(teamMentionRule("a une équipe qui traite les demandes")).toContain(
      "La note écrite à la main affirme",
    );
    // Ni la taille, ni une prose quelconque ne l'autorisent.
    expect(noteAllowsTeam("Vue au salon, très sympathique")).toBe(false);
    expect(noteAllowsTeam("j'ai vu leur équipe au salon")).toBe(false);
    expect(noteAllowsTeam("")).toBe(false);
  });

  it("la taille est un fait, jamais une permission", () => {
    expect(sizeFact("")).toContain("NON RENSEIGNÉE");
    expect(sizeFact("")).toContain("surtout pas une équipe");
    const big = sizeFact("250 personnes");
    expect(big).toContain("250 personnes");
    expect(big).toContain("il n'autorise pas à parler d'équipe");
    // Une taille imposante ne doit pas suffire : c'est la décision prise.
    expect(teamMentionRule("")).toBe(NO_TEAM_RULE);
  });
});

describe("une seule surface de rédaction", () => {
  it("la file rouvre le panneau existant plutôt qu'un second", () => {
    const view = sourceOf("components/sequences/departures-view.tsx");
    expect(view).toContain("ComposePanel");
    expect(view).toContain("departureId");
    // Un second éditeur dans la file serait un second endroit où la reprise,
    // la signature et le retour en arrière finiraient par diverger.
    expect(view).not.toContain("useAgentChat");
    expect(view).not.toContain("<textarea");
  });

  it("rouvrir un départ n'appelle aucun modèle", () => {
    const departures = sourceOf("lib/api/departures.ts");
    const body = departures.slice(
      departures.indexOf("export async function departureDraft"),
      departures.indexOf("export interface DepartureDraft"),
    );
    // Le brouillon existe et a été payé : le rouvrir doit rendre *ce* texte.
    expect(body).not.toContain("draftEmail");
    expect(body).toContain("departure.subject");
  });

  it("enregistrer un départ n'envoie rien", () => {
    const departures = sourceOf("lib/api/departures.ts");
    const body = departures.slice(departures.indexOf("export async function saveDeparture"));
    expect(body).not.toContain("sendEmailToContact");
    expect(body).not.toContain("sendDeparture");
    expect(body).toMatch(/sequenceDeparture\s*\.\s*update/);
  });
});
