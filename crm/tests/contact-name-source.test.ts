import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **Un seul endroit recompose le nom d'une fiche.**
 *
 * `${contact.firstName} ${contact.lastName}` est exactement ce qui produit le
 * « — » orphelin quand la fiche n'a pas encore de personne : chaque endroit qui
 * recompose le nom lui-même est un endroit qui oubliera le cas vide. Il y en
 * avait **trente-neuf** avant le jalon 50, répartis dans vingt fichiers ; les
 * corriger un par un aurait tenu jusqu'au prochain écran ajouté.
 *
 * La garde est statique parce que le défaut l'est : les deux champs sont des
 * `string`, le typecheck ne peut rien voir, et une chaîne vide ne lève pas.
 * Même famille que `status-single-source`, `cost-single-source` et
 * `message-id-source` — et même raison : ce qu'on ferme ici, c'est le chemin
 * par lequel la faute est réellement arrivée.
 */
const ROOTS = ["lib", "app", "components"];

/**
 * Les seuls fichiers autorisés à composer un nom à partir des deux champs.
 *
 * `contact-identity.ts` **est** la règle. Les trois autres raisonnent sur les
 * colonnes elles-mêmes plutôt que sur la personne : rapprocher une ligne de
 * tableur, exporter les colonnes brutes, comparer deux orthographes. Leur objet
 * est le champ, pas l'affichage — les faire passer par `contactTitle()`
 * remplacerait une valeur absente par « Fiche sans nom » dans un export, ce qui
 * serait une invention.
 */
const ALLOWED = new Set([
  join("lib", "domain", "contact-identity.ts"),
  // Rapprochement de fiches contre une transcription de feuille : compare des
  // orthographes, n'affiche rien.
  join("lib", "api", "maintenance.ts"),
  // Export CSV : rend les colonnes telles qu'elles sont en base, pour que
  // l'aller-retour tableur → CRM → tableur ne modifie pas le fichier source.
  join("lib", "api", "csv-export.ts"),
  // Import : dédoublonne sur le couple nom + société, deux colonnes.
  join("lib", "api", "contact-import.ts"),
]);

/**
 * Les formes qui recomposent un nom.
 *
 * On cherche les deux champs **proches l'un de l'autre** sur une même ligne,
 * ce qui est la signature d'une concaténation : un fichier qui ne lit que
 * `firstName` (un tri, un `select`, un formulaire) n'est pas concerné.
 */
const PATTERNS: ReadonlyArray<{ readonly name: string; readonly re: RegExp }> = [
  { name: "interpolation `${…firstName} ${…lastName}`", re: /\$\{[^}]*firstName[^}]*\}[^`\n]{0,4}\$\{[^}]*lastName[^}]*\}/ },
  { name: "JSX `{…firstName} {…lastName}`", re: /\{[^{}\n]*firstName[^{}\n]*\}\s*\{[^{}\n]*lastName[^{}\n]*\}/ },
  { name: "concaténation firstName + lastName", re: /firstName[^\n]{0,12}\+[^\n]{0,20}lastName/ },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "__tests__") continue;
      out.push(...walk(full));
      continue;
    }
    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe("le nom d'une fiche se compose à un seul endroit", () => {
  it("aucun fichier hors liste blanche ne recompose `firstName` + `lastName`", () => {
    const offenders: string[] = [];

    for (const root of ROOTS) {
      for (const file of walk(root)) {
        if (ALLOWED.has(file)) continue;
        const lines = readFileSync(file, "utf8").split("\n");
        for (const [index, line] of lines.entries()) {
          for (const { name, re } of PATTERNS) {
            if (re.test(line)) {
              offenders.push(
                `${file}:${index + 1} — ${name}. Utilisez contactTitle() de lib/domain/contact-identity.ts.`,
              );
            }
          }
        }
      }
    }

    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("la garde reconnaît bien les trois formes qu'elle interdit", () => {
    // Sans ce cas, une expression régulière devenue fausse rendrait le test
    // vert pour toujours — il cesserait de démontrer quoi que ce soit.
    const samples = [
      "  const nom = `${contact.firstName} ${contact.lastName}`.trim();",
      "        {contact.firstName} {contact.lastName}",
      "  const nom = firstName + \" \" + lastName;",
    ];
    for (const [index, sample] of samples.entries()) {
      const pattern = PATTERNS[index];
      expect(pattern, `motif ${index} manquant`).toBeDefined();
      expect(pattern?.re.test(sample), `motif ${index} n'attrape pas : ${sample}`).toBe(true);
    }
  });

  it("elle laisse passer une lecture d'un seul champ", () => {
    // Un tri, un `select` Prisma, un `defaultValue` de formulaire : ce ne sont
    // pas des recompositions, et les signaler rendrait la garde inutilisable.
    const innocents = [
      '  orderBy: [{ lastName: "asc" }, { firstName: "asc" }],',
      '  <input name="firstName" defaultValue={contact?.firstName ?? ""} />',
      "  select: { firstName: true, lastName: true, email: true },",
    ];
    for (const line of innocents) {
      for (const { re } of PATTERNS) expect(re.test(line), line).toBe(false);
    }
  });
});
