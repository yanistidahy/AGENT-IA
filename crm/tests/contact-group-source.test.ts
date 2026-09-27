import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * **Un seul classificateur, un seul choix de variante.**
 *
 * Le groupe d'un contact se déduit de sa fonction à trois endroits — l'import,
 * le recalcul, la fiche — et la variante d'une étape se choisit à deux — la
 * composition, l'aperçu. Rien dans le typage n'empêche l'un des cinq de
 * recomposer la règle à sa façon : ce sont des `string` comparés à des `string`.
 *
 * Trois façons de refaire le défaut, aucune ne lève ni ne casse un type :
 *
 * 1. **un second classement** — un `title.includes("directeur")` glissé dans un
 *    service ou un écran, et la même personne tombe dans deux groupes selon la
 *    porte d'entrée ;
 * 2. **un second pli** — une normalisation d'intitulé écrite à côté de
 *    `words.ts`, qui finirait par reconnaître « coo » dans « coordinatrice » ;
 * 3. **un second choix de variante** — un écran qui déciderait lui-même quel
 *    texte montrer, et qui montrerait donc un aperçu que l'envoi ne produit pas.
 *
 * Même famille que `cost-single-source`, `status-single-source`,
 * `research-single-source` et `signature-block-source`.
 */

const ROOT = path.join(__dirname, "..");

function sourceOf(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

/** Tous les fichiers de code des dossiers surveillés. */
function walk(relative: string): string[] {
  const base = path.join(ROOT, relative);
  const out: string[] = [];
  const visit = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry !== "__tests__" && entry !== "node_modules") visit(full);
      } else if (/\.tsx?$/.test(entry)) out.push(path.relative(ROOT, full));
    }
  };
  visit(base);
  return out;
}

const WATCHED = [...walk("lib"), ...walk("app"), ...walk("components")];

describe("le groupe de fonction n'est classé qu'à un seul endroit", () => {
  it("les trois portes d'entrée appellent le classificateur du domaine", () => {
    // L'import classe à la création et au remplissage ; le recalcul classe en
    // masse ; la fiche pose une correction à la main, donc `manual`.
    expect(sourceOf("lib/api/contact-import.ts")).toContain("groupOfTitle(");
    expect(sourceOf("lib/api/contact-groups.ts")).toContain("classifyTitle(");
    expect(sourceOf("lib/api/contact-groups.ts")).toContain('groupSetBy: "manual"');
  });

  it("aucun fichier ne classe un intitulé de son côté", () => {
    const offenders = WATCHED.filter((file) => {
      if (file === "lib/domain/contact-group.ts") return false;
      const source = sourceOf(file);
      // Une comparaison d'intitulé faite à la main : c'est exactement ce que
      // `classifyTitle` existe pour empêcher.
      return /\btitle\b[^\n]*\.(includes|startsWith|match)\s*\(/.test(source);
    });

    expect(
      offenders,
      `Ces fichiers classent un intitulé de fonction eux-mêmes : ${offenders.join(", ")}. ` +
        "Appelez `classifyTitle` ou `groupOfTitle` (lib/domain/contact-group.ts) — trois " +
        "classements légèrement différents mettraient la même personne dans trois groupes " +
        "selon la porte d'entrée.",
    ).toEqual([]);
  });

  it("le classificateur passe par le pli partagé, jamais par le sien", () => {
    const source = sourceOf("lib/domain/contact-group.ts");
    expect(source).toContain('from "./words"');
    // Une seconde normalisation ferait divergence avec les notes d'angle par
    // rôle, qui lisent les mêmes intitulés depuis le jalon 53.
    expect(source).not.toContain("normalize(");
    expect(source).not.toContain("toLowerCase()");
  });

  it("« jamais classé » n'est pas « Autre », et le libellé les distingue", () => {
    const source = sourceOf("lib/domain/contact-group.ts");
    expect(source).toContain('if (source === "none") return "Non classé"');
    // Le défaut du schéma : une fiche d'avant ce jalon est `none`, pas `autre`.
    expect(sourceOf("prisma/schema.prisma")).toContain('groupSetBy String @default("none")');
  });

  it("le recalcul ne touche jamais une correction faite à la main", () => {
    const source = sourceOf("lib/api/contact-groups.ts");
    expect(source).toContain('if (row.groupSetBy === "manual")');
    expect(source).toContain("manualKept += 1");
  });
});

describe("un seul choix de variante", () => {
  it("la composition et l'aperçu appellent `templateFor`", () => {
    // La composition passe par `renderManualStep`, qui choisit avec le groupe lu
    // sur la fiche ; l'aperçu appelle la même fonction.
    expect(sourceOf("lib/api/manual-step.ts")).toContain("templateFor(");
    expect(sourceOf("components/settings/variant-tabs.tsx")).toContain("templateFor(");
  });

  it("aucun écran ne choisit un texte par groupe de son côté", () => {
    const offenders = WATCHED.filter((file) => {
      if (file === "lib/domain/step-variants.ts") return false;
      const source = sourceOf(file);
      // Le motif du défaut : chercher la variante soi-même puis retomber sur
      // l'étape, chaque copie oubliant un jour le repli ou la fiche non classée.
      return /variants\s*\.\s*find\s*\(.*(\?\?|\|\|)/.test(source);
    });

    expect(
      offenders,
      `Ces fichiers choisissent la variante d'un groupe eux-mêmes : ${offenders.join(", ")}. ` +
        "Appelez `templateFor` (lib/domain/step-variants.ts) : le repli vers le message par " +
        "défaut et le cas « jamais classé » y sont écrits une seule fois.",
    ).toEqual([]);
  });

  it("une fiche jamais classée reçoit le défaut, pas la variante « Autre »", () => {
    expect(sourceOf("lib/api/manual-step.ts")).toContain('contact.groupSetBy === "none" ? null');
  });
});
