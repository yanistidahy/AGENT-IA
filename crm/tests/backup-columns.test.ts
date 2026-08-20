import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { backupSchema } from "@/lib/api/backup";

/**
 * **Une colonne absente de la sauvegarde est une colonne effacée.**
 *
 * Le mécanisme, en trois temps : `exportBackup()` lit la ligne entière et le
 * JSON la porte entière ; `backupSchema` **retire les clés qu'il ne connaît
 * pas** ; `restoreBackup()` supprime la ligne puis la recrée à partir de ce qui
 * reste, laissant Prisma remplir le vide avec les valeurs par défaut du schéma.
 * Rien n'échoue, rien ne s'affiche, et la donnée est perdue.
 *
 * Mesuré en production au jalon 42 : la table `settings` portait 44 colonnes,
 * la sauvegarde en connaissait 11. Une restauration a donc vidé la
 * configuration SMTP et IMAP — coupant du même coup l'envoi et la détection des
 * réponses — pendant que `contacts` perdait ses statuts saisis, ses motifs de
 * perte, ses étiquettes et ses miroirs de recherche, et `activities` son issue,
 * c'est-à-dire la trace de qui avait répondu.
 *
 * Ce test compare **le schéma Prisma** aux schémas Zod de la sauvegarde. Il
 * échoue en nommant chaque colonne manquante. C'est la même famille de garde
 * que `no-duplicate-thresholds`, `status-single-source` et
 * `cost-single-source` : une règle qu'on ne peut pas vérifier autrement qu'en
 * production n'est pas vérifiée.
 */

const ROOT = join(__dirname, "..");
const SCHEMA = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");

/** Les modèles Prisma que la sauvegarde prétend porter, et leur clé de payload. */
const BACKED_UP: ReadonlyArray<{ model: string; key: string }> = [
  { model: "Stage", key: "stages" },
  { model: "Company", key: "companies" },
  { model: "Contact", key: "contacts" },
  { model: "Deal", key: "deals" },
  { model: "Activity", key: "activities" },
  { model: "Task", key: "tasks" },
  { model: "Sequence", key: "sequences" },
  { model: "SequenceStep", key: "sequenceSteps" },
  { model: "SettingsList", key: "settingsLists" },
  { model: "Settings", key: "settings" },
];

/**
 * Les colonnes scalaires d'un modèle Prisma.
 *
 * Les relations sont écartées par leur type — il désigne un modèle, pas un
 * scalaire — parce qu'une relation n'est pas une colonne : elle est portée par
 * la clé étrangère, qui, elle, en est une et doit donc être sauvegardée.
 */
function prismaColumns(model: string): readonly string[] {
  const block = new RegExp(`\\nmodel ${model} \\{([\\s\\S]*?)\\n\\}`).exec(SCHEMA);
  if (block === null) throw new Error(`modèle ${model} introuvable dans schema.prisma`);

  return (block[1] ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("/") && !line.startsWith("@@"))
    .map((line) => line.split(/\s+/))
    .filter((parts): parts is [string, string, ...string[]] => parts.length >= 2)
    .filter(([name]) => /^[a-z][A-Za-z0-9]*$/.test(name))
    .filter(([, type]) =>
      /^(String|Int|Boolean|DateTime|Float|Decimal|BigInt|Bytes|Json)/.test(type),
    )
    .map(([name]) => name);
}

interface ShapeCarrier {
  readonly shape?: Record<string, unknown>;
  readonly element?: ShapeCarrier;
  unwrap?: () => ShapeCarrier;
}

/**
 * Les clés d'un schéma Zod, à travers `array()`, `optional()` et `nullable()`.
 *
 * Lues **à l'exécution sur le schéma lui-même** plutôt que recopiées dans une
 * liste : une liste serait une seconde source de vérité, donc une seconde
 * occasion de diverger — exactement le défaut que ce test existe pour empêcher.
 */
function zodKeys(node: ShapeCarrier): readonly string[] {
  let current = node;
  for (let depth = 0; depth < 8; depth += 1) {
    if (current.shape !== undefined) return Object.keys(current.shape);
    if (current.element !== undefined) current = current.element;
    else if (typeof current.unwrap === "function") current = current.unwrap();
    else break;
  }
  throw new Error("schéma sans forme lisible");
}

describe("la sauvegarde porte toutes les colonnes", () => {
  const payload = (backupSchema as unknown as { shape: Record<string, ShapeCarrier> }).shape;

  for (const { model, key } of BACKED_UP) {
    it(`${model} — aucune colonne ne manque`, () => {
      const carrier = payload[key];
      expect(carrier, `la sauvegarde n'a pas de clé « ${key} »`).toBeDefined();

      const saved = new Set(zodKeys(carrier as ShapeCarrier));
      const missing = prismaColumns(model).filter((column) => !saved.has(column));

      expect(
        missing,
        `Ces colonnes de ${model} seraient **effacées** par une restauration : ` +
          `${missing.join(", ")}. Ajoutez-les au schéma correspondant dans ` +
          `lib/api/backup.ts — en optionnel, pour que les sauvegardes plus ` +
          `anciennes restent restaurables.`,
      ).toEqual([]);
    });
  }

  /**
   * Garde-fou du garde-fou : sans lui, une erreur d'extraction rendant des
   * listes vides ferait passer le test au vert en ne comparant rien.
   */
  it("lit réellement des colonnes des deux côtés", () => {
    expect(prismaColumns("Settings").length).toBeGreaterThan(30);
    expect(prismaColumns("Contact")).toContain("searchText");
    expect(zodKeys(payload.contacts as ShapeCarrier)).toContain("searchText");
    expect(zodKeys(payload.settings as ShapeCarrier)).toContain("smtpHost");
    // Une relation n'est pas une colonne, mais sa clé étrangère en est une.
    expect(prismaColumns("Deal")).not.toContain("stage");
    expect(prismaColumns("Deal")).toContain("stageId");
  });
});
