import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Le bloc de signature se compose **à un seul endroit**.
 *
 * ## Le défaut que ce test ferme
 *
 * Le panneau de rédaction assemblait son propre bloc — nom et titre, deux
 * lignes — hérité d'avant le jalon 62, pendant que le serveur en composait
 * quatre (nom, titre, téléphone, adresse). `replaceSignature` compare des blocs
 * **entiers** : il ne trouvait donc jamais la signature du brouillon, et il en
 * **ajoutait** une seconde en dessous. Le message partait signé deux fois.
 *
 * Rien n'échouait : deux chaînes, deux assemblages corrects chacun de son côté,
 * aucun type violé, aucun test rouge. C'est exactement la famille de défauts que
 * les gardes statiques de ce projet existent pour attraper — `cost-single-source`,
 * `status-single-source`, `contact-name-source`, `message-id-source`.
 */

const ROOT = path.resolve(__dirname, "..");
const SCANNED = ["app", "components", "lib"];

/** Les deux seuls fichiers autorisés à assembler les lignes d'une signature. */
const ALLOWED = new Set([
  // La définition.
  "lib/domain/signatory-choice.ts",
  // La façade du dossier d'Alex, qui délègue en une ligne.
  "lib/agents/prompts/company.ts",
]);

function sources(dir: string): string[] {
  const full = path.join(ROOT, dir);
  return readdirSync(full).flatMap((entry) => {
    const child = path.join(full, entry);
    if (statSync(child).isDirectory()) return sources(path.join(dir, entry));
    if (!/\.tsx?$/.test(entry)) return [];
    if (child.includes("__tests__")) return [];
    return [path.join(dir, entry)];
  });
}

/** Le commentaire est retiré : un fichier qui *décrit* la règle n'y contrevient pas. */
function code(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("le bloc de signature ne se compose qu'à un seul endroit", () => {
  const files = SCANNED.flatMap(sources).filter((file) => !ALLOWED.has(file));

  it("aucun écran ne recompose nom + titre + téléphone + adresse", () => {
    // Un assemblage de signature se reconnaît à ce qu'il enchaîne au moins deux
    // des champs de la signature dans un même littéral ou un même tableau.
    // L'ordre des champs n'entre pas en compte : la première version de cette
    // garde ne voyait que « nom puis titre », et la réintroduction du défaut
    // écrivait « titre puis nom ». Une garde sensible à l'ordre se contourne
    // sans le vouloir.
    const near = (source: string, holder: string): boolean => {
      const a = `\\b${holder}\\.name\\b`;
      const b = `\\b${holder}\\.title\\b`;
      return (
        new RegExp(`${a}[\\s\\S]{0,150}${b}`).test(source) ||
        new RegExp(`${b}[\\s\\S]{0,150}${a}`).test(source)
      );
    };

    const guilty = files.filter((file) => {
      const source = code(file);
      return ["signatory", "signature", "entry", "box", "mailbox"].some((holder) =>
        near(source, holder),
      );
    });
    expect(guilty).toEqual([]);
  });

  it("le panneau de rédaction passe par la fonction du domaine", () => {
    const panel = code("components/emails/compose-panel.tsx");
    expect(panel).toContain("signatureText(");
    // Et il cherche les formes **connues**, pas les siennes : sans cela, une
    // signature héritée ne serait pas remplacée mais doublée.
    expect(panel).toContain("knownSignatureBlocks(");
  });

  it("la liste des formes connues n'existe qu'une fois", () => {
    const api = code("lib/api/signatories.ts");
    expect(api).toContain("knownSignatureBlocks(");
    // La façade délègue : elle ne redresse pas sa propre liste de variantes.
    expect(api).not.toMatch(/phone:\s*""/);
  });
});
