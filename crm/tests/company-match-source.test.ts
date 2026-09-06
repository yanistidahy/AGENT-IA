import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { normalizeCompanyName } from "@/lib/api/company-resolve";

/**
 * **Une société se rapproche par une seule règle.**
 *
 * Deux chemins créent des sociétés : le formulaire, qui envoie un nom saisi à
 * la volée, et l'import, qui en reçoit des centaines d'un coup. Ils avaient
 * divergé sans que rien ne le signale — le formulaire normalisait en mémoire
 * (casse **et** accents, jalon 6), l'import comparait en SQL avec
 * `mode: "insensitive"`, donc à la casse seule.
 *
 * Conséquence mesurée avant correction, sur quatre lignes d'une même maison :
 * « Miye », « MIYE », « MiYé », « Miye Care » donnaient **trois** sociétés. Le
 * doublon accentué est précisément celui qu'un fichier d'enrichissement produit
 * — et il casse tout ce que ce jalon construit, puisqu'une campagne par compte
 * ne peut pas travailler un compte éclaté en deux fiches.
 *
 * Aucun type ne pouvait l'attraper : les deux chemins rendent un `string`, et
 * un doublon n'est pas une erreur, c'est une ligne de plus. D'où cette garde,
 * de la même famille que `status-single-source` et `cost-single-source`.
 */

const ROOT = process.cwd();

/** Le code seul : blocs `/* … *\/` et lignes `//` retirés. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function sourceOf(relative: string): string {
  return stripComments(readFileSync(path.join(ROOT, relative), "utf8"));
}

describe("le rapprochement de société n'a qu'une source", () => {
  it("l'import ne compare pas les noms lui-même", () => {
    const source = sourceOf("lib/api/contact-import.ts");

    // La forme exacte du défaut : une égalité SQL insensible à la casse — donc
    // aveugle aux accents — sur le nom de la société.
    expect(
      /company\.findFirst|company\.findMany/.test(source),
      "lib/api/contact-import.ts interroge la table des sociétés lui-même : " +
        "le rapprochement appartient à resolveCompanyDetailed().",
    ).toBe(false);

    // La garde porte sur `prisma.company`, pas sur `mode: "insensitive"` en
    // général : le fichier s'en sert légitimement pour rapprocher les
    // **contacts** (adresse, puis nom), où la casse est la seule variation à
    // absorber. Interdire la tournure partout aurait été une garde qui décrit
    // mal ce qu'elle protège — et qu'on finit par contourner.
    expect(
      /prisma\.company\b/.test(source),
      "lib/api/contact-import.ts touche la table des sociétés directement : " +
        "c'est par là que la comparaison aveugle aux accents est revenue.",
    ).toBe(false);
  });

  it("l'import ne crée pas de société lui-même", () => {
    // Créer ailleurs, c'est aussi oublier `searchText` ailleurs : les sociétés
    // créées par l'import restaient introuvables à la recherche jusqu'à leur
    // prochaine modification, alors que le jalon 12 avait fermé ce défaut —
    // dans l'autre chemin seulement.
    expect(
      /company\.create\(/.test(sourceOf("lib/api/contact-import.ts")),
      "lib/api/contact-import.ts crée une société sans passer par la source unique, " +
        "donc sans son miroir de recherche.",
    ).toBe(false);
  });

  it("la source unique écrit toujours le miroir de recherche", () => {
    // Vérifié sur le texte parce que l'oubli est silencieux : une société sans
    // `searchText` s'affiche normalement et ne se trouve jamais.
    const source = sourceOf("lib/api/company-resolve.ts");
    const create = /company\.create\(\{[\s\S]*?\}\)/.exec(source)?.[0] ?? "";
    expect(create).not.toBe("");
    expect(
      /searchText/.test(create),
      "resolveCompanyDetailed() crée une société sans searchText : elle serait introuvable.",
    ).toBe(true);
  });

  it("la normalisation absorbe la casse et les accents, et rien de plus", () => {
    // Les quatre formes de la mesure, fixées ici pour que la règle reste
    // vérifiable sans base.
    expect(normalizeCompanyName("MiYé")).toBe(normalizeCompanyName("Miye"));
    expect(normalizeCompanyName("MIYE")).toBe(normalizeCompanyName("miye"));
    expect(normalizeCompanyName("  Miye  ")).toBe("miye");

    // « Miye Care » reste une société distincte : c'est un autre nom, pas une
    // variante d'écriture. Les rapprocher serait deviner — la faute que le
    // jalon 25 s'est interdite sur les domaines. Le rapprochement des noms
    // réellement proches est une fusion de fiches, et c'est un jalon à part.
    expect(normalizeCompanyName("Miye Care")).not.toBe(normalizeCompanyName("Miye"));
  });
});
