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
    /*
      Le rendu vit dans le service du gabarit manuel, et nulle part ailleurs.
      Depuis le jalon 104 il passe par `renderSubjectPlan`, qui reçoit
      `renderSubject` et applique en plus le repli de vide : la fonction de rendu
      n'est donc plus appelée en direct, elle est **passée** au décideur.
    */
    const manual = code("lib/api/manual-step.ts");
    expect(manual).toContain("renderSubjectPlan(");
    expect(manual, "la fonction de rendu est bien celle du domaine").toContain("renderSubject,");
  });

  it("aucun chemin d'écriture ne lit step.subject pour composer un objet", () => {
    /*
      Lire `step.subject` directement contournerait le décideur : la relance
      partirait avec son propre objet alors qu'elle doit, par défaut, garder
      celui de l'étape 1 — et le destinataire verrait deux conversations.
    */
    for (const path of ["lib/api/departures.ts", "lib/api/manual-resync.ts"]) {
      const source = code(path);
      expect(source, `${path} lit step.subject sans passer par le décideur`).not.toMatch(
        /subject:\s*step\??\.?\.?subject/,
      );
    }
  });

  it("l'aperçu rend l'objet avec les fonctions de l'envoi", () => {
    expect(code("components/settings/manual-step-editor.tsx")).toContain("renderSubject(");
    const preview = code("components/settings/variant-tabs.tsx");
    expect(preview).toContain("renderSubjectPlan(");
    expect(preview).toContain("subjectForGroup(");
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

/* --------------------------------- l'objet se décide en un seul endroit ----- */

/**
 * **L'objet d'une étape ne se calcule que par `subjectForGroup`.**
 *
 * Deux défauts fermés ici, et aucun ne faisait rougir quoi que ce soit :
 *
 * - **jalon 103** : `subjectForStep` ne lisait que l'objet par défaut de
 *   l'étape 1, donc un groupe dont l'objet vit sur sa variante se retrouvait
 *   avec un objet vide — départ refusé à l'envoi par le contrôle du jalon 96 ;
 * - **jalon 104** : une relance peut désormais porter **son** objet. Le mode se
 *   lit sur l'étape, et un chemin qui l'ignorerait enverrait un objet que
 *   personne n'a choisi — soit en ouvrant une conversation qu'on voulait garder,
 *   soit en gardant celle qu'on voulait quitter.
 *
 * Rien n'échouait dans les deux cas : des `string`, aucune exception, aucun type
 * violé. D'où une garde statique, et elle porte sur **tous** les chemins —
 * l'éditeur, l'aperçu, la composition, la resynchronisation à l'enregistrement,
 * la réécriture d'un départ, la carte de la file et la validation.
 */
describe("l'objet d'une étape, décidé en un seul endroit", () => {
  /** Les chemins qui ont un objet d'étape à décider. */
  const PATHS = [
    "lib/api/manual-step.ts",
    "lib/api/departures.ts",
    "lib/api/email-sequences.ts",
    "components/settings/step-message.tsx",
    "components/settings/variant-tabs.tsx",
  ];

  it("une seule fonction décide, et c'est subjectForGroup", () => {
    const domain = code("lib/domain/step-variants.ts");
    expect(domain, "subjectForGroup est la règle").toContain("export function subjectForGroup(");
    expect(domain, "et le repli de vide est appliqué à un seul endroit").toContain(
      "export function renderSubjectPlan(",
    );
    /*
      `subjectForStep` n'existe plus comme décideur : elle ignorait les variantes
      **et** le mode. Toute réapparition en dehors du domaine serait un second
      calcul d'objet.
    */
    for (const path of PATHS) {
      expect(code(path), `${path} calcule un objet sans le décideur`).not.toContain(
        "subjectForStep(",
      );
    }
  });

  it("chaque chemin passe par le décideur", () => {
    for (const path of PATHS) {
      const source = code(path);
      expect(
        source.includes("subjectForGroup(") || source.includes("threadTemplate("),
        `${path} n'applique pas le décideur`,
      ).toBe(true);
    }
    // Le rendu, lui, applique le repli de vide — jamais un `Subject:` vide.
    for (const path of ["lib/api/manual-step.ts", "components/settings/variant-tabs.tsx"]) {
      expect(code(path), `${path} rend un objet sans le repli de vide`).toContain(
        "renderSubjectPlan(",
      );
    }
  });

  it("le mode de l'étape est lu, jamais supposé", () => {
    const domain = code("lib/domain/step-variants.ts");
    // Une valeur inconnue vaut « garder le fil » : jamais une conversation de plus.
    expect(domain).toContain("export function toSubjectMode(");
    expect(domain).toMatch(/value === "custom" \? "custom" : "thread"/);
    // Le mode voyage jusqu'au décideur, et il est validé à l'enregistrement.
    expect(code("lib/api/email-sequences.ts")).toContain("subjectMode");
    expect(code("lib/api/email-sequences.ts")).toContain("z.enum(SUBJECT_MODES)");
  });

  it("le mode fait l'aller-retour avec l'écran", () => {
    /*
      **Trouvé au clic, pas à la lecture.** Les étapes sont réécrites d'un bloc
      à chaque enregistrement : un champ que la charge utile ne renvoie pas
      retombe au défaut de la colonne — donc « Garder ». Le choix se cochait, la
      conséquence s'affichait, l'aperçu rendait l'objet personnalisé, et
      l'enregistrement l'effaçait en silence. Rien n'échouait : deux objets
      valides, aucun type violé, aucun test rouge.
    */
    const panel = code("components/settings/email-sequences-panel.tsx");
    expect(panel, "la charge utile porte le mode").toMatch(
      /subjectMode: step\.subjectMode \?\? "thread"/,
    );
    expect(panel, "et le brouillon d'étape le déclare").toMatch(/subjectMode\?: string/);
  });

  it("le mode entre dans l'empreinte de péremption", () => {
    /*
      Sans lui, basculer « Garder » ↔ « Objet personnalisé » changerait l'objet
      des départs en attente sans qu'aucune carte le dise (jalon 96).
    */
    const source = code("lib/api/departures.ts");
    expect(source).toContain("toSubjectMode(step.subjectMode");
  });

  it("une étape en mode « Garder » ignore son objet stocké", () => {
    /*
      La règle vit dans le décideur, et elle est vérifiée sur le comportement par
      les tests du domaine. Ici on ferme le contournement : aucun écran ne
      réimplémente la bascule.
    */
    const editor = code("components/settings/step-message.tsx");
    expect(editor).toContain("subjectForGroup(");
    expect(editor, "le champ n'est verrouillé qu'en mode « Garder »").toMatch(
      /position === 1 \|\| mode === "custom"/,
    );
  });

  it("l'éditeur dit la conséquence d'un objet personnalisé", () => {
    const domain = code("lib/domain/step-variants.ts");
    expect(domain).toContain("export const CUSTOM_SUBJECT_WARNING");
    expect(domain).toContain("nouvelle conversation");
    // Dite dans le domaine, affichée par l'écran : une seule formulation.
    expect(code("components/settings/step-message.tsx")).toContain("CUSTOM_SUBJECT_WARNING");
  });

  it("aucun chemin d'envoi ne pose d'en-tête de fil", () => {
    /*
      **Le produit n'a jamais posé `In-Reply-To` ni `References`** : le
      rattachement repose sur l'objet et les participants, ce que les messageries
      font seules. Un objet personnalisé n'a donc rien à défaire — et la garde
      interdit qu'on en ajoute, ce qui recréerait un fil que l'objet vient
      précisément de quitter.
    */
    for (const path of ["lib/api/mail.ts", "lib/api/email-send.ts", "lib/api/departures.ts"]) {
      const source = code(path);
      expect(source, `${path} pose un en-tête de fil`).not.toMatch(/inReplyTo|In-Reply-To/);
      expect(source, `${path} pose un en-tête de fil`).not.toMatch(/references:\s/i);
    }
  });

  it("le manque porte son geste : « Écrire l'objet dans l'étape 1 »", () => {
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
});
