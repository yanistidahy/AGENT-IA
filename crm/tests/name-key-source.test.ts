import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * **Un nom écrit sans sa clé de tri est une fiche qui tombe en fin de liste.**
 *
 * Le jalon 12 a payé cette leçon une fois : `searchText` était composé à la
 * main sur chaque chemin d'écriture, deux l'oubliaient — l'import de contacts
 * et la création de société à la volée — et les fiches entrées par là
 * restaient **introuvables** sans que rien ne paraisse anormal. Le même piège
 * guette `nameKey`, en plus discret encore : la fiche s'affiche, elle est
 * simplement reléguée après toutes les autres.
 *
 * La garde est statique parce que le défaut l'est : deux colonnes de type
 * `String`, aucune exception levée, aucun type violé, aucun test rouge.
 */

const ROOT = path.join(__dirname, "..");
const API = path.join(ROOT, "lib", "api");

function sourceOf(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

/** Les fichiers de service, hors tests. */
function serviceFiles(): string[] {
  return readdirSync(API)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => path.join("lib", "api", name));
}

describe("toute écriture d'un nom écrit aussi sa clé de tri", () => {
  it("les écritures de société portent nameKey", () => {
    const offenders: string[] = [];
    for (const file of serviceFiles()) {
      const source = sourceOf(file);
      // Une écriture de société se reconnaît à son miroir de recherche : les
      // deux colonnes se tiennent, et l'une sans l'autre est le défaut.
      const writes = source.match(/searchText:\s*(companySearchText|searchText\(\[company\.name)/g);
      if (writes === null) continue;
      const keys = source.match(/nameKey:\s*companyNameKey/g) ?? [];
      if (keys.length < writes.length) {
        offenders.push(`${file} : ${writes.length} miroir(s), ${keys.length} clé(s)`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("les écritures de contact portent nameKey", () => {
    const offenders: string[] = [];
    for (const file of serviceFiles()) {
      const source = sourceOf(file);
      const writes = source.match(/searchText:\s*(contactSearchText|searchText\(\[\s*(parsed|String\(merged))/g);
      if (writes === null) continue;
      const keys = source.match(/nameKey:\s*contactNameKey/g) ?? [];
      if (keys.length < writes.length) {
        offenders.push(`${file} : ${writes.length} miroir(s), ${keys.length} clé(s)`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("la campagne écrit sa clé à la création comme au renommage", () => {
    const source = sourceOf("lib/api/campaigns.ts");
    expect(source.match(/nameKey:\s*campaignNameKey/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("la composition des clés vit à un seul endroit", () => {
    // Un service qui appellerait `sortKey` directement pour composer une clé
    // de modèle recréerait la divergence que `name-keys.ts` existe pour fermer.
    const offenders = serviceFiles()
      .filter((file) => !file.endsWith("name-keys.ts"))
      .filter((file) => /nameKey:\s*sortKey\(/.test(sourceOf(file)));
    expect(offenders).toEqual([]);
  });
});

describe("les écrans d'urgence gardent leur ordre chronologique", () => {
  it("la file des départs trie par date d'échéance", () => {
    const source = sourceOf("lib/api/departures.ts");
    expect(source).toMatch(/orderBy:\s*\[\{\s*createdAt:\s*"asc"\s*\}\]/);
    expect(source).not.toMatch(/orderBy[\s\S]{0,80}nameKey/);
  });

  it("le journal des emails reste antichronologique par défaut", () => {
    const source = sourceOf("lib/api/email-list.ts");
    // Le défaut : `sort === "date"` en `desc`. Le tri par nom reste un choix
    // explicite de l'utilisateur, jamais l'ordre d'arrivée.
    expect(source).toMatch(/query\.dir \?\? \(sort === "date" \? "desc" : "asc"\)/);
    expect(source).toMatch(/default:\s*return a\.sentAt\.getTime\(\) - b\.sentAt\.getTime\(\)/);
  });

  it("la file d'accueil garde son ordre d'urgence", () => {
    const source = sourceOf("lib/api/dashboard.ts");
    expect(source).not.toMatch(/nameKey/);
  });
});
