import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **Le choix est fait, une fois, et il n'est jamais fait à la place de
 * quelqu'un.**
 *
 * Trois façons de refaire le défaut du jalon 87 — un mode manuel livré,
 * vérifié, et introuvable :
 *
 * 1. **un défaut à la création** : une campagne qui naît « en mode Alex » sans
 *    que personne l'ait choisi rend l'autre voie invisible, et c'est exactement
 *    ce qui est arrivé ;
 * 2. **la voie recopiée dans la composition** : `Campaign.mode` dirait alors ce
 *    qui compose, en parallèle de `EmailSequenceStep.mode`. Deux règles pour un
 *    même choix, et c'est toujours la seconde qui finit par mentir (jalon 82) ;
 * 3. **une étape neuve qui n'hérite de rien** : choisir « Manuel » puis obtenir
 *    un éditeur de consigne à l'étape 2 est la même invisibilité, déplacée.
 *
 * Statique, comme `signature-block-source` et `research-single-source` : les
 * trois défauts sont des chaînes et des valeurs par défaut. Rien ne lève, rien
 * ne rougit, et l'écran a l'air de fonctionner.
 */

function sourceOf(file: string): string {
  return readFileSync(join(process.cwd(), file), "utf8");
}

describe("la voie se choisit, elle n'est pas présélectionnée", () => {
  it("le schéma de création l'exige, sans défaut", () => {
    const api = sourceOf("lib/api/campaigns.ts");
    expect(api).toMatch(/mode:\s*z\.enum\(CAMPAIGN_MODES/);
    // `.default(...)` ferait naître des campagnes dont personne n'a choisi la
    // voie : le formulaire pourrait alors ne jamais poser la question.
    expect(api).not.toMatch(/z\.enum\(CAMPAIGN_MODES[\s\S]{0,120}\.default\(/);
  });

  it("l'écran de création n'en présélectionne aucune", () => {
    const view = sourceOf("components/campaigns/campaigns-view.tsx");
    expect(view).toMatch(/useState<CampaignMode \| null>\(null\)/);
    // Et « Créer » n'existe pas tant que rien n'est choisi : un bouton qui
    // échouerait se lit comme une panne (jalon 26).
    expect(view).toMatch(/mode === null \?/);
  });

  it("le choix précède l'éditeur d'étapes, sur l'écran de création", () => {
    const view = sourceOf("components/campaigns/campaigns-view.tsx");
    expect(view).toContain("CampaignPathChoice");
    // L'éditeur de séquence appartient à la page d'une campagne existante.
    expect(view).not.toContain("EmailSequencesPanel");
    expect(view).not.toContain("SequenceSteps");
  });
});

describe("la voie décide du départ, l'étape décide de la composition", () => {
  it("une étape neuve hérite de la voie de la campagne", () => {
    expect(sourceOf("lib/api/campaigns.ts")).toMatch(/mode:\s*stepModeFor\(input\.mode\)/);
    expect(sourceOf("components/settings/sequence-steps.tsx")).toMatch(
      /mode:\s*stepModeFor\(campaignMode\)/,
    );
  });

  it("la composition ne lit que le mode de l'étape", () => {
    /*
      `Campaign.mode` n'a aucune autorité ici : il a servi une fois, à la
      création. Le lire dans la boucle ferait deux sources pour « qui écrit ce
      message », et l'écart ne se verrait qu'à la réception.
    */
    const compose = sourceOf("lib/api/departures.ts");
    expect(compose).not.toMatch(/campaign[^\n]*\.mode/);
  });

  it("le mode par étape reste changeable, en second geste", () => {
    // La demande est explicite : mélanger les modes sur une campagne existante
    // est une action secondaire, pas un retrait de fonctionnalité.
    const steps = sourceOf("components/settings/sequence-steps.tsx");
    expect(steps).toMatch(/secondaire/);
  });
});
