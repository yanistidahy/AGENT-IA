import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **Un objet ne devient du texte que par `renderSubject`.**
 *
 * Le défaut que cette garde ferme est **statique et muet** : un chemin d'envoi
 * qui lit `step.subject` et le pose tel quel dans un `Subject:` compile, ne lève
 * pas, et fait partir `{societe}` chez le prospect — qui lit une accolade et
 * sait qu'il est le n-ième d'une liste. Aucun test ne rougirait : les deux
 * valeurs sont des `string`.
 *
 * Même famille que `manual-step-source` (jalon 87), `video-display-source`
 * (jalon 99) et `mailbox-cap-source` (jalon 100). Cinq invariants :
 *
 * 1. `renderSubject` est la seule fonction qui rend un objet, et le seul
 *    endroit qui décide des replis neutres ;
 * 2. aucun chemin d'écriture ne lit `step.subject` directement : ils passent par
 *    `threadTemplate`, qui applique l'objet de l'étape 1 ;
 * 3. l'aperçu rend l'objet avec la même fonction que l'envoi ;
 * 4. le contrôle de vide du jalon 96 porte sur l'objet **rendu** ;
 * 5. `{video}` est refusée dans un objet, par l'éditeur **et** par la route.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
/** Le source sans ses commentaires : une garde ne doit pas lire sa propre doc. */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(join(process.cwd(), dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(process.cwd(), rel)).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      walk(rel, out);
    } else if (rel.endsWith(".ts") || rel.endsWith(".tsx")) out.push(rel);
  }
  return out;
}

describe("l'objet se rend au même endroit pour tout le monde", () => {
  it("une seule fonction rend un objet, et une seule décide des replis", () => {
    const domain = read("lib/domain/merge-tags.ts");
    expect((domain.match(/export function renderSubject\(/g) ?? []).length).toBe(1);
    // Les replis neutres sont une table, pas une suite de `if` recopiés.
    expect(domain).toContain("const SUBJECT_FALLBACKS");
    expect(domain).toContain("votre marque");
    expect(domain).toContain("votre site");
  });

  it("aucun chemin d'envoi ne compose un objet de son côté", () => {
    /*
      La liste est celle des fichiers qui écrivent ou envoient un message. Un
      `subject:` qui y serait construit par concaténation contournerait le
      rendu — et le premier symptôme serait une accolade chez le prospect.
    */
    for (const path of [
      "lib/api/departures.ts",
      "lib/api/manual-resync.ts",
      "lib/api/email-send.ts",
      "lib/api/auto-send.ts",
      "lib/api/mail.ts",
    ]) {
      const source = code(path);
      expect(source, `${path} rend un objet de son côté`).not.toContain("renderSubject(");
      expect(source, `${path} recopie un repli d'objet`).not.toContain("votre marque");
    }
    // Le rendu vit dans le service du gabarit manuel, et nulle part ailleurs.
    expect(code("lib/api/manual-step.ts")).toContain("renderSubject(");
  });

  it("les trois chemins d'écriture passent par threadTemplate", () => {
    /*
      `threadTemplate` porte la règle du fil : l'objet de l'étape 1 pour toutes
      les étapes. Lire `step.subject` directement la contournerait, et la
      relance ouvrirait une seconde conversation chez le destinataire.
    */
    for (const path of ["lib/api/departures.ts", "lib/api/manual-resync.ts"]) {
      const source = code(path);
      expect(source, `${path} n'applique pas l'objet du fil`).toContain("threadTemplate(");
      expect(source, `${path} lit step.subject sans passer par le fil`).not.toMatch(
        /subject:\s*step\??\.?\.?subject/,
      );
    }
    const compose = code("lib/api/departures.ts");
    expect((compose.match(/threadTemplate\(/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("l'aperçu rend l'objet avec la fonction de l'envoi", () => {
    expect(code("components/settings/manual-step-editor.tsx")).toContain("renderSubject(");
    expect(code("components/settings/variant-tabs.tsx")).toContain("renderSubject(");
  });

  it("un repli employé est nommé partout où l'on relit le texte", () => {
    for (const path of [
      "components/settings/manual-step-editor.tsx",
      "components/settings/variant-tabs.tsx",
      "components/sequences/departure-card.tsx",
    ]) {
      expect(code(path), `${path} ne nomme pas les replis d'objet`).toMatch(
        /subjectFallbacks|subjectFallbacks\.length/,
      );
    }
  });

  it("le contrôle de vide porte sur l'objet rendu", () => {
    /*
      `emptyDepartureReason` lit l'objet **du départ**, qui est déjà rendu par
      `renderManualStep` : c'est ce qui fait qu'un objet réduit à une balise sans
      valeur ne part jamais vide. Le contrôle ne doit donc jamais lire le
      gabarit.
    */
    const check = code("lib/domain/departure-content.ts");
    expect(check).toContain("departure.subject.trim()");
    expect(check).not.toContain("{societe}");
    expect(check).not.toContain("renderSubject");
  });

  it("{video} est refusée dans un objet, par l'écran et par la route", () => {
    expect(code("components/settings/manual-step-editor.tsx")).toContain("subjectTagErrors(");
    expect(code("lib/api/email-sequences.ts")).toContain("subjectTagErrors(");
    // La raison vient du domaine : deux formulations finiraient par diverger.
    expect(read("lib/domain/merge-tags.ts")).toContain("SUBJECT_FORBIDDEN");
  });

  it("rien d'autre dans le produit ne substitue une balise d'objet", () => {
    /*
      Éprouvé : une seconde substitution posée ailleurs (un `replaceAll` sur
      `{societe}` dans une route) rendrait ce test rouge en nommant le fichier.
      `merge-tags.ts` et ses tests sont les seuls exemptés.
    */
    const allowed = new Set([
      "lib/domain/merge-tags.ts",
      "lib/domain/step-variant-seeds.ts",
    ]);
    const offenders: string[] = [];
    for (const path of [...walk("lib"), ...walk("app")]) {
      if (allowed.has(path)) continue;
      if (/\.replaceAll\(\s*"\{(societe|marque|site|prenom|nom|fonction)\}"/.test(code(path))) {
        offenders.push(path);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/* --------------------------------- l'objet du fil se décide en un endroit ----- */

/**
 * **Un objet de relance ne se calcule que par `threadSubjectFor`.**
 *
 * Le défaut du jalon 101 était exactement là : `subjectForStep` ne lisait que
 * l'objet **par défaut** de l'étape 1, et `threadTemplate` neutralisait les
 * objets de variante. Un groupe dont l'objet vit sur sa variante d'étape 1 se
 * retrouvait donc avec un objet vide — l'éditeur annonçait « l'étape 1 ne porte
 * pas encore d'objet », et le départ était refusé à l'envoi par le contrôle de
 * vide du jalon 96.
 *
 * Rien n'échouait : deux `string`, aucune exception, aucun type violé. D'où une
 * garde statique, et elle porte sur **tous** les chemins — l'éditeur, l'aperçu,
 * la composition, la resynchronisation à l'enregistrement, la réécriture d'un
 * départ, la carte de la file et la validation à l'enregistrement.
 */
describe("l'objet du fil, groupe par groupe", () => {
  /** Les six chemins qui ont un objet de relance à décider. */
  const PATHS = [
    "lib/api/departures.ts",
    "lib/api/manual-resync.ts",
    "lib/api/email-sequences.ts",
    "components/settings/step-message.tsx",
  ];

  it("une seule fonction décide de l'objet du fil", () => {
    const domain = code("lib/domain/step-variants.ts");
    expect(domain, "threadSubjectFor est la règle").toContain("export function threadSubjectFor(");
    // `subjectForStep` reste la notion « objet par défaut de l'étape 1 », et
    // n'est lue que par le décideur : ailleurs, elle ignorerait les variantes.
    for (const path of PATHS) {
      expect(code(path), `${path} calcule un objet de fil sans le décideur`).not.toContain(
        "subjectForStep(",
      );
    }
  });

  it("chaque chemin passe par threadSubjectFor ou threadTemplate", () => {
    for (const path of PATHS) {
      const source = code(path);
      expect(
        source.includes("threadSubjectFor(") || source.includes("threadTemplate("),
        `${path} n'applique pas l'objet du fil`,
      ).toBe(true);
    }
  });

  it("threadTemplate reçoit les variantes de l'étape 1 partout où il est appelé", () => {
    /*
      Sans ce quatrième argument, `threadTemplate` retombe sur une liste vide :
      c'est le défaut d'origine, et il est silencieux. La garde exige donc que
      chaque chemin lise les variantes de l'étape 1.
    */
    for (const path of ["lib/api/departures.ts", "lib/api/manual-resync.ts"]) {
      expect(code(path), `${path} ne lit pas les variantes de l'étape 1`).toContain(
        "firstVariantsOf(",
      );
    }
    expect(code("components/settings/step-message.tsx")).toContain("firstVariants");
  });

  it("l'éditeur d'une relance lit l'objet du fil du groupe édité, et rien d'autre", () => {
    const source = code("components/settings/step-message.tsx");
    expect(source).toContain("threadSubjectFor(");
    // L'onglet édité choisit le groupe : un objet de fil calculé sans lui
    // afficherait celui d'un autre groupe.
    expect(source).toMatch(/tab === "default" \? null : tab/);
  });

  it("le manque porte son geste : « Écrire l'objet dans l'étape 1 »", () => {
    /*
      Un manque nommé sans son geste fait chercher où agir. Le lien ouvre
      l'étape 1 **sur le même groupe**, curseur dans le champ Objet — et il
      n'existe que lorsqu'il y a réellement quelque chose à écrire.
    */
    const editor = code("components/settings/manual-step-editor.tsx");
    expect(editor).toContain("Écrire l&apos;objet dans l&apos;étape 1");
    expect(editor).toContain("data-write-first-subject");
    expect(editor, "le lien ne s'affiche que sur un objet de fil vide").toMatch(
      /lockedSubject === "" && onWriteFirstSubject !== undefined/,
    );
    const steps = code("components/settings/sequence-steps.tsx");
    expect(steps, "l'étape 1 est dépliée avant d'y demander le focus").toContain(
      "current.includes(0) ? current : [0, ...current]",
    );
  });

  it("l'aperçu par groupe montre le gabarit du fil, pas celui de l'étape", () => {
    const source = code("components/settings/step-message.tsx");
    expect(source).toContain("threadTemplate(");
    expect(source, "l'aperçu lirait le gabarit de l'étape").toMatch(
      /step=\{thread\.step\}[\s\S]{0,80}variants=\{thread\.variants\}/,
    );
  });
});
