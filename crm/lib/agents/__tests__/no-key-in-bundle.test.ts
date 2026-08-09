import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Aucune clé Anthropic ne doit atteindre le navigateur.
 *
 * Le test lit la sortie de build réelle — `.next/static`, ce que le client
 * télécharge — et y cherche le préfixe des clés Anthropic ainsi que le nom de
 * la variable. `server-only` en tête de lib/agents/runtime/client.ts fait
 * échouer le build en cas de fuite ; ce test est la seconde barrière, celle qui
 * vérifie le résultat plutôt que l'intention.
 *
 * Il est ignoré quand `.next/static` n'existe pas, pour ne pas transformer
 * « je n'ai pas encore buildé » en échec de test.
 */

const STATIC_DIR = path.join(process.cwd(), ".next", "static");

const FORBIDDEN = [
  "sk-ant-", // préfixe des clés Anthropic
  "ANTHROPIC_API_KEY",
];

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(full)));
    else if (/\.(js|mjs|css|json|txt)$/.test(entry.name)) files.push(full);
  }
  return files;
}

async function bundleExists(): Promise<boolean> {
  try {
    return (await stat(STATIC_DIR)).isDirectory();
  } catch {
    return false;
  }
}

describe("étanchéité du bundle client", () => {
  it("ne contient ni clé Anthropic ni nom de la variable d'environnement", async () => {
    if (!(await bundleExists())) {
      // Build absent : rien à vérifier ici, la chaîne CI construit avant de tester.
      expect(true).toBe(true);
      return;
    }

    const files = await collectFiles(STATIC_DIR);
    expect(files.length).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of files) {
      const content = await readFile(file, "utf8");
      for (const needle of FORBIDDEN) {
        if (content.includes(needle)) {
          offenders.push(`${path.relative(process.cwd(), file)} contient « ${needle} »`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("ne laisse pas non plus fuiter la valeur réelle si elle est définie à l'exécution", async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    if (key === undefined || key.length < 12 || !(await bundleExists())) {
      expect(true).toBe(true);
      return;
    }

    const files = await collectFiles(STATIC_DIR);
    const leaked = [];
    for (const file of files) {
      if ((await readFile(file, "utf8")).includes(key)) {
        leaked.push(path.relative(process.cwd(), file));
      }
    }
    expect(leaked).toEqual([]);
  });
});
