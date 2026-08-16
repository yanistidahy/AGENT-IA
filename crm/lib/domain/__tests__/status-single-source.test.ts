import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * **Une seule porte vers le statut affiché.**
 *
 * Même discipline que `no-duplicate-thresholds.test.ts` : la règle « un cycle de
 * vie terminal n'affiche jamais de statut de relance » ne vaut que si aucune
 * surface ne peut la contourner. Or elle se contourne d'une seule façon —
 * appeler `resolveStatus()` directement, qui ne connaît que le couple
 * saisi/calculé et ignore le cycle de vie.
 *
 * C'est exactement ce que faisaient `/clients`, `/accueil` et le tableau des
 * contacts pour la couleur d'alerte : la pastille était correcte, la ligne
 * autour ne l'était pas.
 *
 * Ce test échoue donc si un fichier hors de la liste blanche importe
 * `resolveStatus` — c'est-à-dire dès qu'une surface se remet à lire la valeur
 * stockée sans passer par la règle. Éprouvé en réintroduisant l'ancien appel
 * dans `clients-table.tsx` : le test le désigne par fichier et par ligne.
 *
 * `status.ts` reste la couche basse (saisi contre calculé) et garde toute sa
 * valeur ; ce qui change, c'est qu'on n'y accède plus qu'au travers de
 * `contact-status.ts`, qui ajoute le cycle de vie.
 */

/** Les seuls fichiers autorisés à appeler la couche basse directement. */
const ALLOWED = [
  // Le décideur : c'est lui qui ajoute la règle terminale par-dessus.
  "lib/domain/contact-status.ts",
  // Le module lui-même.
  "lib/domain/status.ts",
  // Les corrections de données raisonnent sur la valeur **stockée**, pas sur
  // ce qui s'affiche : c'est précisément leur objet.
  "lib/api/maintenance.ts",
];

const ROOTS = ["lib", "app", "components"];
const EXTENSIONS = [".ts", ".tsx"];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Les tests ont le droit d'exercer la couche basse : c'est leur travail.
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...walk(full));
      continue;
    }
    if (EXTENSIONS.some((extension) => entry.endsWith(extension))) out.push(full);
  }
  return out;
}

describe("le statut affiché n'a qu'une source", () => {
  it("aucune surface n'importe resolveStatus directement", () => {
    const offenders: string[] = [];

    for (const root of ROOTS) {
      for (const file of walk(root)) {
        if (ALLOWED.includes(file)) continue;

        const lines = readFileSync(file, "utf8").split("\n");
        lines.forEach((line, index) => {
          // Un import, pas une occurrence quelconque : c'est l'accès au module
          // qui compte, et le chercher ainsi évite de se déclencher sur un
          // commentaire qui nomme la fonction — comme ceux qui l'expliquent.
          if (/^\s*import\b.*\bresolveStatus\b/.test(line)) {
            offenders.push(`${file}:${index + 1} importe resolveStatus`);
          }
        });
      }
    }

    expect(offenders).toEqual([]);
  });

  it("ContactStatusTag exige un cycle de vie", () => {
    // La seconde moitié de la garantie, et celle que TypeScript tient seul : un
    // appelant qui omet `lifecycle` ne compile pas. Ce test fixe le contrat pour
    // qu'on ne le rende pas facultatif « pour dépanner » un jour de fatigue.
    const source = readFileSync("components/ui/primitives.tsx", "utf8");
    expect(source).toContain("lifecycle: Lifecycle;");
    expect(source).not.toContain("lifecycle?: Lifecycle;");
  });
});
