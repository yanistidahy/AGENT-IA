import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * **Une seule recherche, une seule carte, deux chemins.**
 *
 * Le défaut du jalon 74 n'était pas un calcul faux : la recherche partait bien
 * depuis le tiroir de contact comme depuis une campagne, puisque les deux
 * passent par `draftEmail`. Ce qui divergeait, c'est ce que l'écran en disait —
 * la file l'affichait, le tiroir rien du tout — et la façon dont chacun jugeait
 * qu'une recherche était « exploitable ». Un brouillon générique, une recherche
 * en panne et une société sans site se ressemblaient donc tous les trois.
 *
 * Trois façons de refaire ce défaut, aucune ne lève ni ne casse un type :
 *
 * 1. **un second point d'appel** — une route qui appellerait `researchCompany`
 *    de son côté, avec ses propres garde-fous, dont le second oublierait un
 *    cas ;
 * 2. **une seconde carte** — une surface qui recomposerait la phrase, et qui
 *    cesserait un jour de dire la même chose que l'autre ;
 * 3. **un échec muet** — un appel refusé rangé sous le même manque qu'une fiche
 *    sans site, donc invisible.
 *
 * Même famille que `cost-single-source`, `status-single-source` et
 * `signature-block-source` : une garde statique pour un défaut statique.
 */

const ROOT = path.join(__dirname, "..");

function sourceOf(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("une seule recherche, appelée par les deux chemins", () => {
  it("la rédaction est le seul appelant de `researchCompany`", () => {
    // Les deux surfaces passent par `draftEmail` : le tiroir de contact via
    // `/api/emails`, la campagne via `composeDepartures`. La recherche vit donc
    // dans la rédaction, et nulle part ailleurs.
    const draft = sourceOf("lib/agents/email-draft.ts");
    expect(draft).toMatch(/await researchCompany\(companyId\)/);

    for (const file of ["app/api/emails/route.ts", "lib/api/departures.ts"]) {
      expect(sourceOf(file)).not.toMatch(/researchCompany/);
    }
  });

  it("les deux chemins demandent leur brouillon à la même fonction", () => {
    expect(sourceOf("app/api/emails/route.ts")).toMatch(/draftEmail\(/);
    expect(sourceOf("lib/api/departures.ts")).toMatch(/draftEmail\(/);
  });
});

describe("une seule carte, rendue par les deux surfaces", () => {
  it("la décision appartient au domaine", () => {
    const domain = sourceOf("lib/domain/research.ts");
    expect(domain).toMatch(/export function researchCard\(/);
  });

  it("aucune surface ne recompose le verdict d'exploitabilité", () => {
    // La version fautive jugeait sur le seul `gap`, sans regarder les faits :
    // la file pouvait annoncer une lecture au-dessus d'un brouillon générique.
    for (const file of ["lib/api/departures.ts", "lib/agents/email-draft.ts"]) {
      expect(sourceOf(file)).toMatch(/researchCard\(/);
      expect(sourceOf(file)).not.toMatch(/usable:\s*gap === null/);
    }
  });

  it("le tiroir de contact monte la note, comme la file", () => {
    for (const file of [
      "components/emails/compose-panel.tsx",
      "components/sequences/departures-view.tsx",
    ]) {
      expect(sourceOf(file)).toMatch(/<ResearchNote/);
    }
  });

  it("la note distingue les trois états, sans en fondre deux", () => {
    const note = sourceOf("components/sequences/research-note.tsx");
    expect(note).toMatch(/research\.state === "read"/);
    expect(note).toMatch(/research\.state === "failed"/);
    // L'échec porte la raison exacte, sinon il se lit comme une fiche
    // incomplète — c'est précisément la confusion à fermer.
    expect(note).toMatch(/failed[\s\S]{0,400}\{research\.detail\}/);
  });
});

describe("un échec se nomme, et ne se fige pas", () => {
  const service = sourceOf("lib/api/research.ts");

  it("un appel qui échoue est rangé sous `failed`, avec sa raison", () => {
    expect(service).toMatch(/catch[\s\S]{0,600}gap: "failed"/);
    expect(service).toMatch(/describeAnthropicError\(error\)/);
  });

  it("un refus de budget aussi : ce n'est pas une fiche sans site", () => {
    expect(service).toMatch(/budgetRefusal\(\)[\s\S]{0,300}gap: "failed"/);
  });

  it("un échec est retenté au lieu d'être gardé comme un résultat", () => {
    const domain = sourceOf("lib/domain/research.ts");
    expect(domain).toMatch(/if \(gap === "failed"\) return age > RETRY_MINUTES/);
    // Sans cela, une coupure d'une minute gèlerait la maison sur le repli
    // générique pour toute la fenêtre de fraîcheur.
    expect(domain).toMatch(/RETRY_MINUTES = \d+/);
  });
});

describe("les identifiants d'outil sont ceux du SDK installé", () => {
  it("ils figurent dans l'union de types du paquet, pas dans un souvenir", () => {
    // Un nom d'outil périmé fait échouer l'appel, et le repli rend exactement
    // le brouillon générique qu'on cherche à quitter. Le vérifier contre le SDK
    // coûte une lecture de fichier ; le vérifier en production coûte une
    // journée.
    const sdk = readFileSync(
      path.join(ROOT, "node_modules/@anthropic-ai/sdk/resources/messages/messages.d.ts"),
      "utf8",
    );
    const service = sourceOf("lib/api/research.ts");
    for (const tool of ["web_fetch_20260209", "web_search_20260209"]) {
      expect(service).toContain(tool);
      expect(sdk).toContain(`type: '${tool}'`);
    }
  });
});
