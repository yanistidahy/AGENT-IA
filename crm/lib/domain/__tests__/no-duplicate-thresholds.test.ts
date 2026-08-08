import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Personne ne recalcule les seuils dans son coin.
 *
 * La cohérence entre écrans ne tient pas parce qu'on l'a testée une fois : elle
 * tient parce qu'un seul module décide. Ce test échoue le jour où une nouvelle
 * vue réécrit `joursÉcoulés >= coldDays` au lieu d'appeler `followUpStatus()` ou
 * `needsAttention()` — la régression exacte qui faisait afficher « Relance
 * prévue » en bleu dans une colonne et le même contact en rouge dans la suivante.
 *
 * Trois modules ont le droit de comparer aux seuils, et eux seuls :
 * `follow-up.ts` (statut des contacts), `pipeline.ts` (chaleur des affaires) et
 * `alerts.ts` (générateurs d'alertes). Le reste les consomme.
 */

const ROOT = process.cwd();

const OWNERS = [
  path.join("lib", "domain", "follow-up.ts"),
  path.join("lib", "domain", "pipeline.ts"),
  path.join("lib", "domain", "alerts.ts"),
];

/**
 * L'infraction visée est précise : **appliquer un seuil configuré à un
 * enregistrement**, c'est-à-dire comparer une ancienneté à `settings.coldDays`
 * ou `settings.staleDays`. Deux usages voisins sont légitimes et ne doivent pas
 * être signalés :
 *
 * - `lib/api/settings.ts` compare les deux seuils **entre eux** pour garantir
 *   l'invariant `staleDays < coldDays` — il valide le réglage, il ne le sert pas ;
 * - `get_stuck_deals` compare à `input.staleDays`, un paramètre fourni par
 *   l'agent dans sa requête, pas la valeur enregistrée.
 *
 * D'où la qualification explicite par `settings.`.
 */
const THRESHOLD_COMPARISON = /[<>]=?\s*settings\.(?:coldDays|staleDays)\b/;

const SEARCHED = ["lib", "components", "app"];

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      files.push(...(await sourceFiles(full)));
    } else if (/\.tsx?$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe("un seul module décide des seuils", () => {
  it("aucune vue ne compare elle-même à coldDays ou staleDays", async () => {
    const offenders: string[] = [];

    for (const root of SEARCHED) {
      for (const file of await sourceFiles(path.join(ROOT, root))) {
        const relative = path.relative(ROOT, file);
        if (OWNERS.includes(relative)) continue;

        const lines = (await readFile(file, "utf8")).split("\n");
        lines.forEach((line, index) => {
          // Les commentaires expliquent souvent la règle : ils ne l'appliquent pas.
          const code = line.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
          if (THRESHOLD_COMPARISON.test(code)) {
            offenders.push(`${relative}:${index + 1} — ${line.trim()}`);
          }
        });
      }
    }

    expect(offenders, "utilisez followUpStatus() / needsAttention() / dealHeat()").toEqual([]);
  });

  it("les trois modules propriétaires comparent bien, eux", async () => {
    // Garde-fou du garde-fou : si la détection ne trouve plus rien nulle part,
    // c'est que l'expression régulière a cessé de fonctionner.
    const found: string[] = [];
    for (const owner of OWNERS) {
      const content = await readFile(path.join(ROOT, owner), "utf8");
      if (content.split("\n").some((line) => THRESHOLD_COMPARISON.test(line))) {
        found.push(owner);
      }
    }
    expect(found.length).toBeGreaterThan(0);
  });
});
