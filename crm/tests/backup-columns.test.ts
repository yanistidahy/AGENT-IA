import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { backupSchema } from "@/lib/api/backup";
import {
  BACKED_UP_TABLES,
  NOT_BACKED_UP,
  declaredModels,
} from "@/lib/domain/backup-coverage";

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

/**
 * Les modèles sauvegardés et leur clé de payload viennent de
 * `lib/domain/backup-coverage.ts` : **une seule liste**, lue par le test, par
 * l'écran des réglages et par la documentation de la restauration. Recopier
 * les noms ici en ferait une seconde source de vérité, donc une occasion de
 * diverger — le défaut que ce fichier existe pour empêcher.
 */
const BACKED_UP = BACKED_UP_TABLES;


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

/**
 * **Une table absente de la sauvegarde est une table perdue.**
 *
 * La garde des colonnes (ci-dessus) ne voyait pas ce cas : elle vérifie les
 * tables qu'on lui désigne, et se tait sur celles qu'on ne lui désigne pas.
 * C'est exactement par là que `email_sends` est passé — jamais sauvegardé,
 * donc jamais comparé, pendant que la restauration supprimait les contacts et
 * laissait chaque envoi orphelin (mesuré au jalon 109 : 33 événements
 * re-dérivables avant une restauration, 11 après).
 *
 * La règle est donc : **tout modèle du schéma est déclaré**, sauvegardé ou
 * explicitement écarté avec sa conséquence écrite. Ajouter une table sans
 * choisir fait échouer ce test en la nommant.
 */
describe("la sauvegarde couvre toutes les tables", () => {
  function prismaModels(): readonly string[] {
    return [...SCHEMA.matchAll(/^model (\w+) \{/gm)].map((match) => match[1] ?? "");
  }

  it("aucun modèle du schéma n'est laissé sans décision", () => {
    const declared = new Set(declaredModels());
    const undeclared = prismaModels().filter((model) => !declared.has(model));

    expect(
      undeclared,
      `Ces tables ne sont ni sauvegardées ni écartées : ${undeclared.join(", ")}. ` +
        `Ajoutez-les à BACKED_UP_TABLES dans lib/domain/backup-coverage.ts — avec ` +
        `leur schéma Zod et leur restauration dans lib/api/backup.ts — ou à ` +
        `NOT_BACKED_UP en écrivant ce qu'une restauration fera perdre.`,
    ).toEqual([]);
  });

  it("ne déclare aucune table qui n'existe pas", () => {
    // Sans quoi la liste vieillirait en silence après un renommage de modèle.
    const models = new Set(prismaModels());
    const ghosts = declaredModels().filter((model) => !models.has(model));
    expect(ghosts, `déclarés mais absents du schéma : ${ghosts.join(", ")}`).toEqual([]);
  });

  it("ne déclare pas deux fois le même modèle", () => {
    const seen = declaredModels();
    expect(new Set(seen).size, "un modèle est à la fois sauvegardé et écarté").toBe(seen.length);
  });

  it("chaque table écartée dit ce qu'elle fait perdre", () => {
    for (const table of NOT_BACKED_UP) {
      expect(table.label.length, table.model).toBeGreaterThan(3);
      // Une conséquence, pas une justification technique : c'est ce que
      // l'utilisateur lit dans /reglages avant de cliquer.
      expect(table.consequence.length, table.model).toBeGreaterThan(20);
    }
  });

  it("chaque table sauvegardée porte bien une clé dans le fichier", () => {
    const payload = (backupSchema as unknown as { shape: Record<string, unknown> }).shape;
    for (const table of BACKED_UP_TABLES) {
      expect(payload[table.key], `clé « ${table.key} » absente de backupSchema`).toBeDefined();
    }
  });

  /**
   * Garde-fou du garde-fou : la liste doit réellement couvrir l'histoire de
   * prospection, qui est la raison d'être du jalon 110. Un retrait silencieux
   * de l'une de ces tables rouvrirait exactement le même trou.
   */
  it("couvre l'histoire de prospection, nommément", () => {
    const saved = new Set(BACKED_UP_TABLES.map((table) => table.model));
    for (const model of [
      "Campaign",
      "EmailSequence",
      "EmailSequenceStep",
      "EmailStepVariant",
      "SequenceEnrollment",
      "SequenceDeparture",
      "EmailSend",
      "EmailReply",
      "EmailLinkClick",
      "OutreachEvent",
      "Task",
      "Mailbox",
    ]) {
      expect(saved.has(model), `${model} doit être sauvegardé`).toBe(true);
    }
  });
});
