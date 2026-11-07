import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { PUBLIC_PATHS } from "@/lib/auth/config";
import { NON_KPI_TYPES } from "@/lib/domain/outreach";
import { BACKED_UP_TABLES, NOT_BACKED_UP } from "@/lib/domain/backup-coverage";

/**
 * **La synchronisation lemlist, sous garde statique.**
 *
 * Quatre façons de défaire ce jalon sans qu'aucun test ne rougisse, sans
 * qu'aucun type ne soit violé et sans qu'aucune exception ne lève. Ce sont
 * elles que cette garde ferme :
 *
 * 1. **la clé sort du serveur.** Elle est lue à un seul endroit, et seulement
 *    pour composer un en-tête. Un `console.log` de l'en-tête, un message
 *    d'erreur qui recopie le corps de la requête, un champ renvoyé « pour
 *    déboguer » : trois façons de la publier sans le vouloir ;
 * 2. **un indicateur se met à compter les ouvertures.** Le jalon 109 les a
 *    retirées des indicateurs ; les réimporter ne les y remet pas, et c'est
 *    cette garde qui le tient ;
 * 3. **une seconde règle d'arrêt apparaît.** « Une réponse lemlist arrête la
 *    séquence » passe par `latestReply`, le prédicat du jalon 106, et par lui
 *    seul ;
 * 4. **le webhook s'ouvre.** Il est public au sens du middleware ; son secret
 *    est donc la seule porte, et elle doit se comparer à temps constant.
 *
 * Même famille que `cost-single-source`, `status-single-source`,
 * `reply-stop-source` et `pilotage-source`.
 */

const ROOT = path.join(__dirname, "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

const client = read("lib/api/lemlist-client.ts");
const sync = read("lib/api/lemlist-sync.ts");
const domain = read("lib/domain/lemlist.ts");
const panel = read("components/settings/lemlist-panel.tsx");
const webhook = read("app/api/lemlist/webhook/route.ts");
const testRoute = read("app/api/lemlist/test/route.ts");
const departures = read("lib/api/departures.ts");
const enrol = read("lib/api/email-sequences.ts");

/* --------------------------------------------------------------- la clé ---- */

describe("la clé ne quitte pas le serveur", () => {
  /**
   * Un seul module la lit. Deux lectures, c'est deux endroits où l'oublier
   * dans un journal, et c'est la leçon du jalon 12 appliquée à un secret.
   */
  it("n'est lue que par le client, et une seule fois", () => {
    const sources = walk(path.join(ROOT, "lib"))
      .concat(walk(path.join(ROOT, "app")))
      .concat(walk(path.join(ROOT, "components")))
      .concat(walk(path.join(ROOT, "scripts")));
    const guilty = sources.filter((file) => {
      if (file.endsWith("lib/api/lemlist-client.ts")) return false;
      return readFileSync(file, "utf8").includes("LEMLIST_API_KEY");
    });
    /*
      Les modules qui ont le *droit* de **nommer** la variable sans la lire :
      ils écrivent la phrase « clé absente », qui dit quoi faire. Nommer n'est
      pas lire, et la seconde partie de ce test le vérifie — aucun d'eux ne
      contient `process.env.LEMLIST_API_KEY`.
    */
    const allowed = [
      "lib/domain/lemlist.ts",
      "components/settings/lemlist-panel.tsx",
    ];
    const unexpected = guilty
      .map((file) => path.relative(ROOT, file))
      .filter((file) => !allowed.includes(file));
    expect(unexpected).toEqual([]);

    for (const file of allowed) {
      expect(read(file), `${file} lit la clé`).not.toContain("process.env.LEMLIST_API_KEY");
    }

    // Et dans le client, une seule lecture de `process.env`.
    const reads = client.match(/process\.env\.LEMLIST_API_KEY/g) ?? [];
    expect(reads).toHaveLength(1);
  });

  it("ne part dans aucun journal ni dans aucune réponse", () => {
    for (const [name, source] of [
      ["client", client],
      ["sync", sync],
      ["webhook", webhook],
      ["test", testRoute],
      ["panel", panel],
    ] as const) {
      // Ni la variable, ni la valeur lue, ne traversent un `console.*`.
      const logs = source.match(/console\.[a-z]+\([^)]*\)/g) ?? [];
      for (const line of logs) {
        expect(line, `${name} journalise quelque chose de suspect`).not.toMatch(/key|Key|secret|Secret|authHeader|Authorization/);
      }
      // Aucune réponse ne porte un champ qui ressemble à une clé.
      expect(source, name).not.toMatch(/\bkey:\s*key\b/);
      expect(source, name).not.toMatch(/apiKey:/);
    }
  });

  /**
   * La clé n'entre que dans `authHeader`. Un `fetch` qui la glisserait dans
   * l'URL la publierait dans tous les journaux de proxy du chemin.
   */
  it("n'entre que dans l'en-tête d'authentification", () => {
    expect(client).toContain("function authHeader(key: string)");
    const interpolations = client.match(/\$\{key\}/g) ?? [];
    expect(interpolations).toHaveLength(1);
    expect(client).toContain("Buffer.from(`:${key}`");
    // Jamais dans l'URL ni dans un paramètre de requête.
    expect(client).not.toMatch(/searchParams\.set\([^)]*key/);
  });

  /**
   * **Un 401 se dit sans se citer.** Le message de l'API répète parfois le
   * début du jeton : c'est l'écart déjà fixé au jalon 16 pour Anthropic.
   */
  it("ne recopie pas le corps de lemlist dans le message d'un refus", () => {
    expect(client).toContain("Clé refusée par lemlist");
    expect(client).not.toMatch(/await response\.text\(\)/);
  });

  it("le panneau ne lit ni la base ni la clé", () => {
    expect(panel).not.toContain("prisma.");
    expect(panel).not.toContain('from "@/lib/db"');
    expect(panel).not.toMatch(/process\.env\.LEMLIST_API_KEY\s*(\?\?|\|\||\))/);
  });

  /** La clé n'est pas en base, donc elle n'est pas dans la sauvegarde. */
  it("n'est dans aucune table sauvegardée", () => {
    const declared = [...BACKED_UP_TABLES.map((t) => t.model), ...NOT_BACKED_UP.map((t) => t.model)];
    expect(declared).toContain("LemlistSync");
    expect(declared).toContain("LemlistIssue");
    // Le modèle de l'état ne porte aucune colonne de secret.
    const schema = read("prisma/schema.prisma");
    const model = schema.slice(schema.indexOf("model LemlistSync {"));
    const body = model.slice(0, model.indexOf("\n}"));
    expect(body).not.toMatch(/apiKey|secret|password|token/i);
  });
});

/* --------------------------------------------- les ouvertures, hors KPI ---- */

describe("les ouvertures entrent et ne comptent pas", () => {
  /**
   * Chaque chiffre de `lib/domain/pilotage.ts` énumère les types qu'il
   * additionne. Qu'aucun n'énumère les types hors indicateur n'est donc pas une
   * promesse : c'est vérifiable sur le fichier.
   */
  it("aucune fonction du pilotage ne sélectionne un type hors indicateur", () => {
    const pilotage = read("lib/domain/pilotage.ts");
    for (const type of NON_KPI_TYPES) {
      expect(pilotage, `pilotage.ts nomme ${type}`).not.toContain(`"${type}"`);
    }
  });

  it("les pages de pilotage ne les nomment pas non plus", () => {
    const files = [
      ...walk(path.join(ROOT, "app/(crm)/pilotage")),
      ...walk(path.join(ROOT, "components/pilotage")),
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const type of NON_KPI_TYPES) {
        expect(source, `${path.relative(ROOT, file)} nomme ${type}`).not.toContain(`"${type}"`);
      }
    }
  });
});

/* ------------------------------------------------- une seule règle d'arrêt - */

describe("une réponse lemlist passe par le prédicat du jalon 106", () => {
  it("le relevé de réponse lit la troisième source et la passe à latestReply", () => {
    expect(departures).toContain('source: "lemlist"');
    expect(departures).toContain('type: "reply_received"');
    expect(departures).toContain("latestReply(");
    // Variadique : c'est ce qui a permis d'ajouter une source sans ajouter une
    // règle. Trois arguments passent à l'appel.
    expect(departures).toMatch(/latestReply\([\s\S]{0,200}imported\?\.occurredAt/);
  });

  it("la synchronisation n'écrit aucune seconde trace de réponse", () => {
    // Écrire aussi une interaction ou une `EmailReply` compterait la réponse
    // deux fois dans le pilotage, et ferait deux arrêts là où il en faut un.
    expect(sync).not.toContain("prisma.activity.create");
    expect(sync).not.toContain("prisma.emailReply.create");
    expect(sync).not.toContain("logActivity");
  });

  it("l'inscription refuse un contact actif dans lemlist, en nommant la campagne", () => {
    expect(enrol).toContain("activeLemlistCampaign(");
    expect(enrol).toMatch(/campagne lemlist «\s*\$\{lemlistCampaign\}/);
  });
});

/* ----------------------------------------------------- la porte du webhook - */

describe("le webhook est public, et fermé par son secret", () => {
  it("est déclaré public au middleware", () => {
    expect(PUBLIC_PATHS).toContain("/api/lemlist/webhook");
    expect(PUBLIC_PATHS).toContain("/api/cron/lemlist");
    // Les deux boutons de l'écran restent derrière le verrou.
    expect(PUBLIC_PATHS).not.toContain("/api/lemlist/sync");
    expect(PUBLIC_PATHS).not.toContain("/api/lemlist/test");
    expect(PUBLIC_PATHS).not.toContain("/api/lemlist/status");
  });

  it("compare le secret à temps constant, et ferme si la variable manque", () => {
    expect(webhook).toContain("constantTimeEqual(");
    expect(webhook).not.toMatch(/presented\s*===\s*secret/);
    // Une variable absente ferme : la posture du jalon 9.
    expect(webhook).toMatch(/secret\.trim\(\) === ""\)\s*return false/);
    expect(webhook).toContain("status: 401");
  });

  /** Le même écrivain que le relevé : pas de second chemin d'écriture. */
  it("écrit par le même écrivain que le relevé", () => {
    expect(webhook).toContain("applyWebhook(");
    expect(sync).toContain("export async function applyActivities");
    expect(sync).toMatch(/applyWebhook[\s\S]{0,400}applyActivities\(raws\)/);
    expect(webhook).not.toContain("prisma.");
  });

  it("pose source et externalId sur chaque événement écrit", () => {
    expect(sync).toContain('source: "lemlist"');
    expect(sync).toContain("externalId: activity.externalId");
  });
});

/* ------------------------------------------- les limites d'appel, tenues --- */

describe("les limites d'appel de lemlist sont respectées", () => {
  it("les appels sont sérialisés et espacés", () => {
    expect(client).toContain("function queue<T>");
    expect(client).toContain("const SPACING_MS");
    // Aucun `Promise.all` de requêtes : une rafale consommerait le budget
    // d'une clé que l'utilisateur partage avec son propre outillage.
    expect(client).not.toMatch(/Promise\.all\([\s\S]{0,200}fetch\(/);
  });

  it("honore Retry-After plutôt que de deviner", () => {
    expect(client).toContain('headers.get("retry-after")');
    // `X-RateLimit-Reset` est au format humain : la documentation le signale
    // elle-même, et `Date.parse` n'en est pas portable.
    expect(client).not.toContain('headers.get("x-ratelimit-reset")');
  });

  it("nomme le plafond documenté dans le module, pour qu'il se relise", () => {
    expect(client).toContain("20 requêtes par 2 secondes");
    expect(domain).toContain("ActivityType");
  });
});

/** Les fichiers TypeScript d'un dossier, récursivement. */
function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (full.endsWith(".ts") || full.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}
