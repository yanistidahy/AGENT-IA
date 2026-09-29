import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **Le clic et l'ordonnanceur partagent le plafond, et l'ordre.**
 *
 * Le défaut que cette garde ferme est **statique et muet** : deux chemins
 * d'envoi qui cessent de partager une règle compilent, ne lèvent pas, et ne
 * font rougir aucun test — ils envoient simplement plus que ce qu'on a réglé,
 * ou dépensent les derniers créneaux du jour sur des inconnus pendant que des
 * relances attendent. C'est la famille de `cost-single-source` (jalon 36),
 * `status-single-source` (jalon 29) et `auto-send-source` (jalon 93).
 *
 * Elle porte sur **quatre invariants**, et pas un de plus :
 *
 * 1. le contrôle de plafond vit dans `sendDeparture`, donc les trois chemins
 *    (clic, composition, ordonnanceur) le partagent par construction ;
 * 2. l'ordre de priorité vient d'une seule fonction, appelée par la file **et**
 *    par l'ordonnanceur ;
 * 3. aucune surface ne recompose la règle « cette boîte est-elle pleine » ;
 * 4. un email écrit à la main n'est **jamais** bloqué, seulement compté.
 */

const root = join(process.cwd());
const read = (path: string) => readFileSync(join(root, path), "utf8");

/**
 * Le corps d'une fonction nommée, du `{` d'ouverture à l'accolade fermante
 * posée **en première colonne**.
 *
 * Compter les accolades serait plus élégant et faux : les corps de ce projet
 * portent des littéraux de gabarit (`${…}`), des expressions régulières et des
 * accolades en commentaire, qui décalent le compte et tronquent la lecture — la
 * garde devient alors verte sur le défaut qu'elle vise.
 */
function bodyOf(source: string, header: string): string {
  const start = source.indexOf(header);
  if (start === -1) return "";
  const end = source.indexOf("\n}\n", start);
  return end === -1 ? source.slice(start) : source.slice(start, end + 2);
}

describe("le plafond par boîte est partagé, jamais recopié", () => {
  it("le refus vit dans sendDeparture, donc les trois chemins le partagent", () => {
    const body = bodyOf(read("lib/api/departures.ts"), "export async function sendDeparture(");
    expect(body).not.toBe("");
    expect(body, "sendDeparture lit la capacité de la boîte de la campagne").toContain(
      "readUsageFor(",
    );
    expect(body, "et refuse quand elle est atteinte").toContain("capReached(");
    expect(body, "en nommant la boîte, le compte, et ce qui arrive ensuite").toContain(
      "capRefusal(",
    );
  });

  it("le départ refusé reste en attente : il est reporté, jamais écarté", () => {
    const body = bodyOf(read("lib/api/departures.ts"), "export async function sendDeparture(");
    const refusal = body.slice(body.indexOf("capRefusal("));
    const closing = refusal.slice(0, refusal.indexOf("const rate"));
    expect(closing, "seul `detail` est écrit").toContain("data: { detail: refusal }");
    expect(
      closing,
      "un départ passé « skipped » disparaîtrait de la file, donc se lirait comme un envoi réussi",
    ).not.toContain('status: "skipped"');
  });

  it("aucun autre chemin d'envoi ne juge le plafond de son côté", () => {
    // `sendEmailToContact` est le chemin de l'email écrit à la main : il compte
    // l'envoi (la ligne `email_sends`) et ne doit **jamais** le refuser.
    const send = read("lib/api/email-send.ts");
    expect(send, "un email écrit à la main n'est jamais bloqué par le plafond").not.toContain(
      "capReached",
    );
    expect(send).not.toContain("capRefusal");
  });

  it("la file et l'ordonnanceur dépensent la capacité dans le même ordre", () => {
    const queue = bodyOf(read("lib/api/departures.ts"), "export async function listDepartures(");
    const scheduler = bodyOf(read("lib/api/auto-send.ts"), "async function queue(");
    expect(queue, "« Départs du jour » trie par priorité").toContain("sortByPriority(");
    expect(scheduler, "l'ordonnanceur aussi").toContain("sortByPriority(");
    // Le tri par date seule est précisément le défaut : il dépense les derniers
    // créneaux du jour sur des premiers contacts pendant que des relances
    // attendent.
    expect(
      scheduler.slice(scheduler.indexOf("const usage")),
      "l'ordonnanceur ne retrie pas lui-même après avoir filtré",
    ).not.toContain(".sort((a, b) => a.createdAt");
  });

  it("l'ordonnanceur saute une boîte pleine et continue avec les autres", () => {
    const scheduler = bodyOf(read("lib/api/auto-send.ts"), "async function queue(");
    expect(scheduler, "il lit la capacité").toContain("readMailboxUsage(");
    expect(scheduler, "et écarte les boîtes pleines de sa file").toContain("capReached(");
    expect(
      scheduler,
      "sans quoi le premier départ d'une boîte pleine occuperait le créneau et l'envoi s'arrêterait pour tout le monde",
    ).toContain("full.has(box)");
  });

  it("« cette boîte est-elle pleine » n'est écrit qu'une fois", () => {
    // Personne ne recompose `sent >= cap` : le verdict vient du domaine.
    for (const path of [
      "lib/api/departures.ts",
      "lib/api/auto-send.ts",
      "lib/api/compose-now.ts",
      "components/sequences/departure-card.tsx",
      "components/sequences/departures-view.tsx",
    ]) {
      const source = read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
      expect(source, `${path} recompose le verdict du plafond`).not.toMatch(
        /\.sent\s*>=\s*[\w.]*cap/i,
      );
    }
  });

  it("la composition ne borne que ce qui est facturé", () => {
    const body = bodyOf(read("lib/api/departures.ts"), "export async function composeDepartures(");
    expect(body, "le budget vient de la capacité restante lue une fois").toContain(
      "remainingOf(",
    );
    // Les étapes écrites à la main ne coûtent rien : les borner laisserait la
    // file incomplète sans aucune économie.
    const bounded = body.slice(body.indexOf("laterForCap += 1"));
    expect(bounded).not.toBe("");
    const before = body.slice(0, body.indexOf("laterForCap += 1"));
    expect(
      before.lastIndexOf("} else {") > before.lastIndexOf("if (isManual) {"),
      "la borne vit dans la branche d'Alex, pas sur le chemin manuel",
    ).toBe(true);
  });
});
