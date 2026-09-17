import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * **Une cible, une liste d'exclusion, une règle de déduction.**
 *
 * Le jalon 75 ajoute une troisième source à la recherche — le domaine porté par
 * l'adresse électronique — et c'est exactement le genre d'ajout qui se
 * dédouble : une seconde liste de fournisseurs grand public quelque part, une
 * seconde résolution de cible dans le service, une seconde règle de déduction
 * dans le rattrapage. Aucun de ces trois défauts ne lève, aucun ne casse un
 * type, et le premier des trois enverrait Alex documenter `gmail.com`.
 *
 * Même famille que `research-single-source`, `cost-single-source` et
 * `signature-block-source` : une garde statique pour un défaut statique.
 */

const ROOT = path.join(__dirname, "..");

function sourceOf(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("une seule liste de fournisseurs grand public", () => {
  it("elle vit dans `domain-guess`, et la cible de recherche l'emprunte", () => {
    const target = sourceOf("lib/domain/research-target.ts");
    expect(target).toMatch(/import \{[\s\S]{0,80}isFreeProvider[\s\S]{0,80}\} from "\.\/domain-guess"/);
    // Une seconde liste finirait par diverger, et c'est toujours la seconde
    // qu'on oublie de compléter.
    expect(target).not.toMatch(/gmail\.com/);
  });

  it("aucun autre fichier ne redéfinit d'exclusion", () => {
    for (const file of ["lib/api/research.ts", "lib/api/maintenance.ts"]) {
      expect(sourceOf(file)).not.toMatch(/gmail\.com|hotmail|wanadoo/);
    }
  });
});

describe("une seule résolution de cible", () => {
  const service = sourceOf("lib/api/research.ts");

  it("le service la demande au domaine plutôt que de la recomposer", () => {
    expect(service).toMatch(/resolveResearchTarget\(\{/);
    // L'ancienne chaîne à deux branches, recopiée dans le service.
    expect(service).not.toMatch(/function siteOf/);
  });

  it("les trois sources sont passées, et l'adresse en fait partie", () => {
    expect(service).toMatch(/resolveResearchTarget\(\{[\s\S]{0,400}emails:/);
  });

  it("la cible et sa provenance sont enregistrées", () => {
    expect(service).toMatch(/targetHost: input\.target\?\.host/);
    expect(service).toMatch(/targetSource: input\.target\?\.source/);
  });

  it("une cible déduite est annoncée comme telle au modèle", () => {
    // Sans cette mise en garde, une page qui n'est pas le site du prospect
    // serait documentée comme si elle l'était.
    expect(service).toMatch(/target\.source === "email"/);
  });
});

describe("la carte dit quelle adresse a été lue, et d'où elle venait", () => {
  it("le domaine compose la phrase, l'écran ne la recompose pas", () => {
    expect(sourceOf("lib/domain/research.ts")).toMatch(/describeTarget\(research\.target\)/);
    const note = sourceOf("components/sequences/research-note.tsx");
    expect(note).toMatch(/research\.target/);
  });

  it("aucune source n'est affirmée quand rien n'a été enregistré", () => {
    const domain = sourceOf("lib/domain/research-target.ts");
    expect(domain).toMatch(/if \(host === ""\) return null/);
  });
});

describe("le rattrapage écrit la déduction, jamais la supposition", () => {
  const maintenance = sourceOf("lib/api/maintenance.ts");

  it("il filtre sur la règle `email`", () => {
    // La règle `name` fabrique `bacha.com` à partir de « Bacha » : elle n'a
    // jamais eu le droit de s'appliquer sans relecture (jalons 25 et 26).
    expect(maintenance).toMatch(/proposal\.rule !== "email"/);
  });

  it("il réutilise la règle du jalon 25 au lieu d'en écrire une seconde", () => {
    expect(maintenance).toMatch(/proposeDomain\(/);
    expect(maintenance).not.toMatch(/function proposeDomain/);
  });

  it("l'écriture passe par le seul écrivain de domaine du produit", () => {
    // `acceptDomain` porte la garde de concurrence, le miroir de recherche, la
    // clé de tri et l'effacement du refus. Les réécrire ici en oublierait un.
    expect(maintenance).toMatch(/await acceptDomain\(row\.id, row\.value\)/);
    // Le corps de la fonction, isolé : une assertion sur tout le fichier
    // attraperait l'écriture légitime du bloc « Site depuis les Notes ».
    const body = maintenance.slice(maintenance.indexOf("export async function applyCompanyDomainFix"));
    expect(body).not.toMatch(/prisma\./);
  });

  it("il ne touche que des sociétés au domaine vide", () => {
    expect(maintenance).toMatch(/planCompanyDomainFix[\s\S]{0,400}where: \{ domain: "" \}/);
  });
});
