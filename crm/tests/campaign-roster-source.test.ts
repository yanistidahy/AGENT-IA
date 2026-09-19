import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * **Le tableau et la carte comptent les mêmes personnes.**
 *
 * « Personnes écrites 52 » au-dessus d'un tableau de 55 lignes se lit comme un
 * écart inexpliqué, et l'on cesse de croire les deux nombres. Trois façons de
 * refaire le défaut, et la garde les ferme toutes :
 *
 * 1. « a reçu un message » déduit de `lastStep` ou de `lastSentAt` plutôt que
 *    lu dans les envois — deux sources pour un même fait, donc deux nombres ;
 * 2. l'écart entre le sommet et le tableau laissé sans phrase ;
 * 3. le tableau des inscrits qui compterait ses lignes autrement que
 *    `readCampaignFunnel`.
 *
 * Statique parce que le défaut l'est : deux comptages justes chacun de son
 * côté ne lèvent rien, ne font échouer aucun type, et ne deviennent visibles
 * qu'en comparant deux blocs d'un même écran à l'œil.
 */

const ROOT = path.join(__dirname, "..");

function sourceOf(relative: string): string {
  // Les commentaires sont retirés avant l'examen : ce dépôt documente
  // abondamment ses règles, et la garde attraperait sa propre documentation
  // (leçon du jalon 52).
  return readFileSync(path.join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("« a reçu un premier message » a une seule source", () => {
  const campaigns = sourceOf("lib/api/campaigns.ts");

  it("se lit dans les envois, la même carte que « Personnes écrites »", () => {
    expect(campaigns).toMatch(/written:\s*firstSend\.has\(/);
  });

  it("n'est jamais déduit de l'étape atteinte ni de la date d'inscription", () => {
    expect(campaigns).not.toMatch(/written:\s*enrollment\.(lastStep|lastSentAt)/);
  });
});

describe("le tableau et le sommet de l'entonnoir portent le même dénominateur", () => {
  const campaigns = sourceOf("lib/api/campaigns.ts");

  it("les inscrits listés sont comptés avec le filtre de la liste", () => {
    // `listCampaignMembers` exclut les retraits de campagne ; le comptage qui
    // sert de dénominateur doit exclure les mêmes, sans quoi la phrase sous la
    // carte décrirait un tableau qui n'est pas celui du dessous.
    const occurrences = campaigns.match(/status:\s*\{\s*not:\s*REMOVED\s*\}/g) ?? [];
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("« jamais écrit » vient des envois, pas d'un second critère", () => {
    expect(campaigns).toMatch(/neverWritten\s*=\s*listedRows\.filter\([\s\S]*?facts\.firstSend\.has\(/);
  });

  it("l'écart est dit sous la première carte, jamais laissé à deviner", () => {
    expect(campaigns).toMatch(/roster:\s*\{\s*listed,\s*neverWritten\s*\}/);
    const funnel = sourceOf("lib/domain/email-funnel.ts");
    expect(funnel).toContain("jamais écrit");
    expect(funnel).toContain("inscrits");
  });
});

describe("le tableau des inscrits se trie et se filtre depuis le domaine", () => {
  const view = sourceOf("components/campaigns/campaign-members.tsx");

  it("ne réimplémente ni le filtre ni le tri", () => {
    expect(view).toContain("matchesMemberFilter");
    expect(view).toContain("sortMembers");
    // Un `.sort(` local serait un second ordre, donc un ordre qui finirait par
    // ne plus ranger les retraits en fin de tableau.
    expect(view).not.toMatch(/\.sort\(\s*\(/);
  });

  it("chaque colonne triable porte un en-tête cliquable", () => {
    expect(view).toMatch(/onClick=\{\(\) => onSort\(/);
    for (const key of ["lastSentAt", "state", "step", "reply", "opened"]) {
      expect(view).toContain(`sort: "${key}"`);
    }
  });
});
