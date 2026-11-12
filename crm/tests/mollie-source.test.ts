import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { PUBLIC_PATHS, isPublicPath } from "@/lib/auth/config";
import { NOT_BACKED_UP } from "@/lib/domain/backup-coverage";

/**
 * **Les abonnements Mollie, sous garde statique.**
 *
 * Cinq façons de défaire ce jalon sans qu'aucun type ne soit violé et sans
 * qu'aucune exception ne lève. Ce sont elles que cette garde ferme :
 *
 * 1. **la clé sort du serveur** — lue à un seul endroit, utilisée pour un seul
 *    en-tête, jamais citée dans un journal ni dans un message ;
 * 2. **le webhook se met à croire ce qu'il reçoit** — il ne porte qu'un
 *    identifiant ; tout ce qu'il décide doit venir d'un paiement relu chez Mollie ;
 * 3. **l'ouverture de la page crée un paiement** — les aperçus de lien (messagerie,
 *    antivirus) la chargent avant le client ;
 * 4. **la redirection devient ouverte** — l'adresse de paiement vient d'une
 *    réponse réseau, elle doit être vérifiée avant de servir de destination ;
 * 5. **un abonnement se rattache à une société par clé étrangère** — une
 *    restauration supprime puis recrée les sociétés et emporterait la ligne.
 *
 * Même famille que `lemlist-source`, `cost-single-source` et `reply-stop-source`.
 */

const ROOT = path.join(__dirname, "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

const client = read("lib/api/mollie-client.ts");
const service = read("lib/api/subscriptions.ts");
const webhook = read("app/api/mollie/webhook/route.ts");
const pageRoute = read("app/api/abonnement/[token]/route.ts");
const listRoute = read("app/api/subscriptions/route.ts");
const panel = read("components/subscriptions/subscription-panel.tsx");

/** Le corps du modèle Subscription, sans ses commentaires de documentation. */
function subscriptionModel(): string {
  const schema = read("prisma/schema.prisma");
  const start = schema.indexOf("model Subscription {");
  expect(start, "modèle Subscription introuvable").toBeGreaterThanOrEqual(0);
  return schema
    .slice(start, schema.indexOf("\n}", start))
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

/** Le corps d'une fonction nommée, jusqu'à la prochaine déclaration de même niveau. */
function bodyOf(source: string, signature: string): string {
  const start = source.indexOf(signature);
  expect(start, `${signature} introuvable`).toBeGreaterThanOrEqual(0);
  const rest = source.slice(start + signature.length);
  const next = rest.search(/\n(export )?(async )?function /);
  return next === -1 ? rest : rest.slice(0, next);
}

describe("la clé Mollie ne quitte pas le serveur", () => {
  it("n'est nommée que par le client, et lue une seule fois", () => {
    const sources = ["lib", "app", "components", "scripts"].flatMap((dir) => walk(path.join(ROOT, dir)));
    const named = sources
      .filter((file) => readFileSync(file, "utf8").includes("MOLLIE_API_KEY"))
      .map((file) => path.relative(ROOT, file));
    expect(named).toEqual(["lib/api/mollie-client.ts"]);

    expect(client.match(/process\.env\.MOLLIE_API_KEY/g) ?? []).toHaveLength(1);
    expect(client).toContain('import "server-only"');
  });

  it("n'entre que dans l'en-tête Authorization", () => {
    expect(client.match(/\$\{key\}/g) ?? []).toHaveLength(1);
    expect(client).toContain("Authorization: `Bearer ${key}`");
    expect(client).not.toMatch(/searchParams\.set\([^)]*key/);
  });

  it("ne part dans aucun journal, aucune réponse", () => {
    for (const [name, source] of [
      ["client", client],
      ["service", service],
      ["webhook", webhook],
      ["page", pageRoute],
      ["panel", panel],
    ] as const) {
      const logs = source.match(/console\.[a-z]+\([^)]*\)/g) ?? [];
      for (const line of logs) {
        expect(line, `${name} journalise quelque chose de suspect`).not.toMatch(
          /apiKey|Authorization|mollieKey|MOLLIE_API_KEY|headers/,
        );
      }
      expect(source, name).not.toMatch(/apiKey:/);
    }
    // Un 401 se dit sans se citer, et le corps de l'erreur n'est repris que sur 400/422.
    expect(client).toContain("Clé refusée par Mollie");
    expect(client).not.toMatch(/await response\.text\(\)/);
  });

  it("le panneau ne lit ni la base ni la clé", () => {
    expect(panel).not.toContain("prisma.");
    expect(panel).not.toContain("process.env");
  });
});

describe("le webhook ne croit que ce que Mollie confirme", () => {
  it("est public au middleware, sans ouvrir la route de génération", () => {
    expect(PUBLIC_PATHS).toContain("/api/mollie/webhook");
    expect(isPublicPath("/api/abonnement/abc")).toBe(true);
    expect(isPublicPath("/api/subscriptions")).toBe(false);
  });

  it("relit le paiement chez Mollie avant toute écriture", () => {
    const body = bodyOf(service, "export async function applyPaymentWebhook");
    const fetched = body.indexOf("getPayment(paymentId)");
    const firstRead = body.indexOf("prisma.subscription.");
    expect(fetched).toBeGreaterThanOrEqual(0);
    expect(fetched).toBeLessThan(firstRead);
    // La route elle-même ne touche pas la base : tout passe par le service.
    expect(webhook).not.toContain("prisma.");
    expect(webhook).toContain("isMolliePaymentId(id)");
  });

  it("recoupe le montant et le client avant de créer l'abonnement", () => {
    const body = bodyOf(service, "async function activate");
    expect(body).toContain("payment.amountCents !== row.amountCents");
    expect(body).toContain("payment.customerId !== row.mollieCustomerId");
  });

  it("réclame l'activation atomiquement, et adopte avant de créer", () => {
    const body = bodyOf(service, "async function activate");
    expect(body).toContain("updateMany(");
    expect(body).toContain("activationClaimedAt");
    expect(body.indexOf("findSubscriptionByRef(")).toBeLessThan(body.indexOf("createMollieSubscription("));
    expect(client).toContain('"Idempotency-Key"');
  });

  it("répond 500 pour faire rejouer, 200 sinon", () => {
    expect(webhook).toContain('outcome === "retry" ? 500 : 200');
  });
});

describe("ouvrir la page de paiement ne crée rien", () => {
  it("GET n'appelle jamais beginCheckout", () => {
    const get = pageRoute.slice(pageRoute.indexOf("export async function GET"), pageRoute.indexOf("export async function POST"));
    expect(get.length).toBeGreaterThan(0);
    expect(get).not.toContain("beginCheckout");
    expect(get).not.toContain("prisma.");
  });

  it("le POST seul ouvre un paiement", () => {
    const post = pageRoute.slice(pageRoute.indexOf("export async function POST"));
    expect(post).toContain("beginCheckout(token)");
    expect(post).toContain("status: 303");
  });
});

describe("la destination du paiement est vérifiée", () => {
  it("chaque adresse de paiement passe par isTrustedCheckoutUrl", () => {
    const uses = service.match(/isTrustedCheckoutUrl\(/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(2);
    expect(client).toContain('url.hostname.endsWith(".mollie.com")');
  });
});

describe("la table survit à une restauration", () => {
  it("n'a aucune clé étrangère vers les sociétés", () => {
    const body = subscriptionModel();
    expect(body).not.toContain("@relation");
    expect(body).not.toMatch(/\bCompany\b\s/);
  });

  it("est déclarée hors sauvegarde, avec sa raison", () => {
    const entry = NOT_BACKED_UP.find((table) => table.model === "Subscription");
    expect(entry).toBeDefined();
    expect(entry?.consequence ?? "").toContain("clé étrangère");
  });

  it("ne garde ni clé ni mot de passe en base", () => {
    expect(subscriptionModel()).not.toMatch(/apiKey|secret|password|card|iban/i);
  });
});

describe("la génération du lien refuse ce qui échouerait au clic du client", () => {
  it("exige la clé et l'adresse publique", () => {
    const body = bodyOf(service, "export async function createSubscriptionLink");
    expect(body).toContain("hasMollieKey()");
    expect(body).toContain('publicBaseUrl() === ""');
    expect(listRoute).toContain("status: 503");
  });
});

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
