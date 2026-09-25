import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * **Alex n'écrit que ce qu'il a lu, et la chaîne qui le garantit ne se coupe
 * pas en silence.**
 *
 * Trois façons de rater ce jalon, aucune ne lève d'exception et aucune ne fait
 * échouer un type :
 *
 * 1. **la consigne devient inconditionnelle** — un prompt qui parle de la
 *    recherche sans la forme négative laisse le modèle deviner quand il n'a
 *    rien lu, et c'est exactement le brouillon qui parle de probiotiques à une
 *    marque de bougies ;
 * 2. **le fait perd sa source** — un fait sans URL est indiscernable d'un fait
 *    inventé, et il atteindrait le prompt comme les autres ;
 * 3. **le garde-fou cesse d'être posé** — le brouillon reste correct à l'écran,
 *    simplement plus personne ne vérifie.
 *
 * C'est la même famille que `em-dash-source`, `signature-block-source` et
 * `contact-name-source` : une garde statique pour un défaut statique.
 */

const ROOT = path.join(__dirname, "..");

function sourceOf(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("la consigne de recherche existe sous ses deux formes", () => {
  const draft = sourceOf("lib/agents/email-draft.ts");

  it("le cas négatif est une interdiction explicite, pas une omission", () => {
    // Une absence de ligne se lit comme une absence d'information ; une ligne
    // qui dit « rien » se lit comme une règle (jalons 48 et 53).
    expect(draft).toMatch(/AUCUNE RECHERCHE EXPLOITABLE/);
    expect(draft).toMatch(/N'écris donc \*\*aucun\*\* fait/);
  });

  it("le cas positif borne ce qui peut être écrit", () => {
    expect(draft).toMatch(/CE QUE TU AS LU SUR CETTE ENTREPRISE/);
    expect(draft).toMatch(/tu ne le sais pas/);
  });

  it("la consigne est branchée sur l'instruction de rédaction", () => {
    expect(draft).toMatch(/\$\{researchRule\(research\)\}/);
  });

  it("la règle se décide sur la donnée, jamais sur le jugement du modèle", () => {
    // `isUsable` tranche ; un `if` recopié ailleurs finirait par diverger.
    expect(draft).toMatch(/researchRule[\s\S]{0,400}isUsable\(research\)/);
  });
});

describe("un fait sans source n'atteint jamais le prompt", () => {
  it("la rédaction filtre les faits avant de les écrire dans la consigne", () => {
    const draft = sourceOf("lib/agents/email-draft.ts");
    expect(draft).toMatch(/researchRule[\s\S]{0,300}usableFacts\(research\.facts\)/);
  });

  it("le service filtre aussi, avant d'enregistrer", () => {
    // Les deux bouts : ce qu'on stocke et ce qu'on envoie. Filtrer d'un seul
    // côté laisserait la base porter des faits qu'aucune page ne soutient.
    const service = sourceOf("lib/api/research.ts");
    expect(service).toMatch(/usableFacts\(toFacts\(/);
  });
});

describe("le garde-fou est posé, et sur ce qui partira vraiment", () => {
  it("la rédaction compare le brouillon au texte réellement lu", () => {
    const draft = sourceOf("lib/agents/email-draft.ts");
    expect(draft).toMatch(/ungroundedClaims\(result\.draft\.body, corpus\)/);
    // Le corpus, pas le résumé : un résumé aurait déjà perdu le mot cherché.
    expect(draft).toMatch(/readCorpus\(scope\)/);
  });

  it("la file recalcule l'alerte à la lecture, retouches comprises", () => {
    // Recalculée plutôt que stockée : c'est ce qui fait qu'une retouche à la
    // main est vérifiée elle aussi (même principe que la virgule, jalon 68).
    const departures = sourceOf("lib/api/departures.ts");
    expect(departures).toMatch(/ungrounded: describeUngrounded\(/);
    expect(departures).toMatch(/ungroundedClaims\([\s\S]{0,200}corpus/);
  });

  it("la carte montre les sources et l'alerte", () => {
    const note = sourceOf("components/sequences/research-note.tsx");
    expect(note).toMatch(/Sources/);
    expect(note).toMatch(/ungrounded/);
  /*
    **La file est rendue par deux fichiers depuis le jalon 88** : la vue porte
    l'état et les groupes, la carte porte une ligne. La garde lit donc les deux
    ensemble — porter sur la seule vue la rendrait verte le jour où ce qu'elle
    vérifie déménagerait dans la carte.
  */
    const view = sourceOf("components/sequences/departures-view.tsx") +
      sourceOf("components/sequences/departure-card.tsx");
    expect(view).toMatch(/<ResearchNote/);
  });
});

describe("la recherche se paie une fois par portée", () => {
  it("la société quand il y en a une, la fiche seulement à défaut", () => {
    /*
      **Le sens a changé au jalon 84.** La règle d'origine — « attachée à la
      société, pas au contact » — protégeait le cache : trois collègues d'une
      même maison ne paient qu'une lecture. Elle avait un effet de bord que
      personne n'avait vu : une fiche **sans** maison n'était pas documentée du
      tout, parce que la recherche prenait un identifiant de société. Le cache
      par société est conservé, et une seconde ancre est ajoutée pour ces
      fiches-là. Les deux clés restent uniques : on ne paie jamais deux fois la
      même portée.
    */
    const schema = readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
    expect(schema).toMatch(/model CompanyResearch[\s\S]{0,600}companyId String\?\s+@unique/);
    expect(schema).toMatch(/model CompanyResearch[\s\S]{0,900}contactId\s+String\?\s+@unique/);
    // La société reste la portée par défaut : c'est elle qui fait le partage.
    const draft = sourceOf("lib/agents/email-draft.ts");
    expect(draft).toMatch(/contact\.company === null \? \{ contactId \} : \{ companyId/);
  });

  it("le cache est consulté avant tout appel", () => {
    const service = sourceOf("lib/api/research.ts");
    expect(service).toMatch(/if \(stored !== null && options\.force !== true && !isStale/);
  });

  it("l'estimation compte des sociétés dédoublonnées", () => {
    const departures = sourceOf("lib/api/departures.ts");
    expect(departures).toMatch(/const toResearch = new Set<string>\(\)/);
    expect(departures).toMatch(/researches: toResearch\.size/);
  });
});

describe("les règles des jalons précédents tiennent", () => {
  const draft = sourceOf("lib/agents/email-draft.ts");

  it("la recherche s'ajoute au cadre, elle ne le remplace pas", () => {
    // Le DM, l'angle de rôle, la supposition d'équipe, le collègue, l'appel :
    // toutes les consignes précédentes sont toujours dans l'instruction.
    for (const rule of [
      "demoTargetRule",
      "subjectRule",
      "dmRule",
      "angleRule",
      "teamMentionRule",
      "colleagueRule",
      "greeting",
    ]) {
      expect(draft).toContain(rule);
    }
  });

  it("les garanties de retour sont intactes", () => {
    expect(draft).toMatch(/stripDashes\(/);
    expect(draft).toMatch(/enforceSignature\(/);
    expect(draft).toMatch(/repairGreeting\(/);
  });
});
