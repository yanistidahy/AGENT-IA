import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * **Une réponse arrête les relances, par tous les chemins.**
 *
 * La garde ferme les trois façons de défaire le jalon 106 sans qu'aucun test ne
 * rougisse, sans qu'aucun type ne soit violé et sans qu'aucune exception ne
 * lève — les trois sont arrivées, et la dernière a réellement fait partir une
 * relance à quelqu'un qui venait de répondre :
 *
 * 1. **la borne redevient exclusive** — `date > lastSentAt` sur une date à la
 *    seconde perd la réponse arrivée dans la même seconde que l'envoi ;
 * 2. **une seule source est relue** — `Activity.outcome` sans `EmailReply`, donc
 *    rien n'arrête la séquence quand l'interaction n'a pas pu être écrite ;
 * 3. **un chemin d'envoi cesse de lire l'état** — une inscription arrêtée ou un
 *    départ écarté redeviennent envoyables par leur identifiant.
 *
 * Même famille que `cost-single-source`, `status-single-source`,
 * `departure-send-source` et `manual-resync-source`.
 */

const ROOT = path.join(__dirname, "..");
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8");

const departures = read("lib/api/departures.ts");
const scheduler = read("lib/api/auto-send.ts");
const domain = read("lib/domain/reply-stop.ts");

/** Le corps d'une fonction exportée, bornée à la suivante. */
function bodyOf(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  expect(start, `${name} introuvable`).toBeGreaterThan(-1);
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

describe("la règle vit dans le domaine, et nulle part ailleurs", () => {
  it("le module pur porte la borne, la réunion des sources et les deux états", () => {
    for (const symbol of [
      "export function replyFloor",
      "export function latestReply",
      "export function enrollmentBlocksSend",
      "export function departureBlocksSend",
      "export function stateRefusal",
    ]) {
      expect(domain, symbol).toContain(symbol);
    }
    // Pur : la règle se teste sans base, et c'est ce qui la rend vérifiable.
    expect(domain).not.toContain("prisma");
    expect(domain).not.toContain("server-only");
  });

  it("aucun service ne recompose la borne à la seconde", () => {
    for (const file of ["lib/api/departures.ts", "lib/api/auto-send.ts", "lib/api/inbox.ts"]) {
      expect(read(file), file).not.toContain("setMilliseconds(0)");
    }
  });
});

describe("la lecture des réponses", () => {
  const replied = bodyOf(departures, "composeDepartures").length > 0
    ? departures.slice(departures.indexOf("async function repliedAfter("))
    : "";
  const body = replied.slice(0, replied.indexOf("\n}\n") + 3);

  it("la borne vient du domaine, et la comparaison est inclusive", () => {
    expect(body).toContain("replyFloor(since)");
    expect(body).toContain("gte: floor");
    // C'est le défaut mesuré : 328 ms d'écart suffisaient à perdre la réponse.
    expect(body, "une borne exclusive perd la réponse de la même seconde").not.toContain("gt: since");
  });

  it("les deux sources sont lues, et réunies par le domaine", () => {
    expect(body).toContain("prisma.activity.findFirst");
    expect(body, "EmailReply est le fait relevé, pas un reflet").toContain("prisma.emailReply.findFirst");
    expect(body).toContain("latestReply(");
  });
});

describe("les chemins d'envoi lisent l'état", () => {
  const send = bodyOf(departures, "sendDeparture");

  it("sendDeparture demande son verdict au domaine, avant toute composition", () => {
    expect(send).toContain("stateRefusal(");
    const verdict = send.indexOf("stateRefusal(");
    const sending = send.indexOf("sendEmailToContact(");
    expect(sending).toBeGreaterThan(-1);
    expect(verdict, "le verdict précède l'envoi").toBeLessThan(sending);
  });

  it("l'ordonnanceur et la file lisent la même constante que l'envoi", () => {
    expect(scheduler).toContain("SENDING_ENROLLMENT_STATUS");
    expect(bodyOf(departures, "listDepartures")).toContain("SENDING_ENROLLMENT_STATUS");
    // Une chaîne en dur se désaccorderait du jour où la règle changerait.
    expect(scheduler).not.toContain('enrollment: { status: "active"');
  });

  it("il n'existe qu'une fonction qui envoie un départ", () => {
    // La même exigence que `departure-send-source` : les trois chemins passent
    // par `sendDeparture`, donc le verdict d'état les couvre tous les trois.
    const callers = [
      "app/api/departures/route.ts",
      "lib/api/auto-send.ts",
      "lib/api/departures.ts",
    ];
    for (const file of callers) {
      expect(read(file), file).toContain("sendDeparture(");
    }
    expect(read("lib/api/auto-send.ts")).not.toContain("sendEmailToContact(");
  });
});
