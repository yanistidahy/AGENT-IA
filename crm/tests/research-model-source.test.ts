import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  MODELS,
  RESEARCH_FALLBACK_MODEL,
  findModel,
  researchModelFor,
  supportsResearchTools,
} from "../lib/domain/model-pricing";

/**
 * **Le modèle de la prose ne décide pas de ce que la lecture peut faire.**
 *
 * Le jalon 73 a choisi `web_fetch_20260209` / `web_search_20260209` sans jamais
 * les exercer contre l'API, et le jalon 74 n'a pu vérifier que leur présence
 * dans l'union de types du SDK. La première vraie recherche a rendu la réponse
 * que ni l'un ni l'autre ne pouvait obtenir :
 *
 * > 'claude-haiku-4-5-20251001' does not support programmatic tool calling.
 * > The following tools have `allowed_callers` that require it: web_fetch,
 * > web_search.
 *
 * Deux défauts, et il fallait les deux : les outils étaient déclarés **sans**
 * `allowed_callers`, donc avec un jeu d'appelants qui exige l'appel d'outil
 * programmatique ; et la recherche héritait du modèle de rédaction, qui peut
 * être un modèle sans ces outils du tout.
 *
 * Trois façons de refaire le défaut, aucune ne lève ni ne casse un type :
 *
 * 1. **les outils redéclarés sans `allowed_callers`** — la requête repart avec
 *    l'exigence implicite ;
 * 2. **la recherche recollée au modèle de rédaction sans garde** — un réglage
 *    de prose remet la lecture en panne ;
 * 3. **l'écran muet** — le réglage passe, et l'on découvre la panne sur un mur
 *    de cartes rouges.
 *
 * Même famille que `cost-single-source`, `status-single-source` et
 * `research-single-source` : une garde statique pour un défaut statique.
 */

const ROOT = path.join(__dirname, "..");

function sourceOf(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("les outils nomment leurs appelants", () => {
  const service = sourceOf("lib/api/research.ts");

  it("chaque outil serveur porte `allowed_callers: [\"direct\"]`", () => {
    // Omis, l'API exige l'appel d'outil programmatique et refuse la requête
    // entière : ce n'est pas une option de confort, c'est la moitié du
    // correctif.
    const declarations = service.match(/type: "web_(fetch|search)_20260209"[\s\S]{0,220}?\}/g) ?? [];
    expect(declarations).toHaveLength(2);
    for (const declaration of declarations) {
      expect(declaration).toMatch(/allowed_callers: \["direct"\]/);
    }
  });

  it("aucun environnement d'exécution n'est déclaré à côté", () => {
    // « direct » n'est vrai que parce que nous n'en déclarons aucun.
    expect(service).not.toMatch(/code_execution/);
  });
});

describe("la recherche tourne sur un modèle qui sait chercher", () => {
  it("le choix passe par la capacité, jamais par le seul réglage de rédaction", () => {
    const reference = sourceOf("lib/api/reference.ts");
    expect(reference).toMatch(/research: researchModelFor\(row\.modelDraft\)/);
    // La version fautive : `research: row.modelDraft`.
    expect(reference).not.toMatch(/research: row\.modelDraft\b/);
  });

  it("un modèle sans les outils retombe sur un modèle capable", () => {
    expect(supportsResearchTools("claude-haiku-4-5")).toBe(false);
    expect(researchModelFor("claude-haiku-4-5")).toBe(RESEARCH_FALLBACK_MODEL);
    // Un identifiant inconnu ne part pas à l'API pour se faire refuser.
    expect(researchModelFor("claude-inconnu-9")).toBe(RESEARCH_FALLBACK_MODEL);
  });

  it("un modèle capable est conservé tel quel", () => {
    // Sans ce cas, « retomber toujours » passerait le test précédent tout en
    // ignorant le réglage de l'utilisateur.
    for (const id of ["claude-sonnet-5", "claude-opus-5"]) {
      expect(supportsResearchTools(id)).toBe(true);
      expect(researchModelFor(id)).toBe(id);
    }
  });

  it("le repli est lui-même capable, et fait partie de la liste", () => {
    expect(findModel(RESEARCH_FALLBACK_MODEL)).not.toBeNull();
    expect(supportsResearchTools(RESEARCH_FALLBACK_MODEL)).toBe(true);
  });

  it("chaque modèle proposé déclare sa capacité", () => {
    // Un modèle ajouté demain sans ce champ serait supposé capable par
    // défaut — et la panne reviendrait par la porte de derrière.
    for (const model of MODELS) expect(typeof model.researchTools).toBe("boolean");
  });
});

describe("le réglage incompatible se dit avant de produire des cartes rouges", () => {
  const form = sourceOf("components/settings/models-form.tsx");

  it("l'écran interroge la même fonction que le service", () => {
    expect(form).toMatch(/supportsResearchTools\(models\.draft\)/);
    expect(form).toMatch(/researchModelFor\(models\.draft\)/);
  });

  it("l'avertissement nomme le modèle et ce qui se passera", () => {
    expect(form).toMatch(/ne sait pas lire le site/);
    expect(form).toMatch(/recherche\s+continuera/);
  });
});
