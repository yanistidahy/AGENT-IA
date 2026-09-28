import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **Un départ vide ne part pas, et les trois chemins partagent ce contrôle.**
 *
 * Le défaut mesuré avant ce jalon : le corps d'un départ porte **toujours** la
 * signature (imposée à la composition, jalon 33), donc un brouillon composé
 * depuis une étape sans texte rend trois lignes non vides, et le seul contrôle
 * existant, un schéma Zod dans `email-send.ts`, les accepte. Un tel départ
 * **est réellement parti** : le destinataire a reçu une signature seule.
 *
 * Trois façons de le refaire sans qu'aucun type ne bronche, et chacune a sa
 * garde ici :
 *
 * 1. **poser le contrôle dans la route de l'humain.** Il y serait juste, et
 *    l'ordonnanceur (jalon 93) enverrait toujours des signatures seules. Le
 *    contrôle vit donc dans `sendDeparture`, la fonction que les trois modes
 *    traversent — clic humain, composition, ordonnanceur ;
 * 2. **doubler le chemin d'envoi.** Un second `sendEmailToContact` pour
 *    l'automate compilerait parfaitement et n'aurait aucun des garde-fous ;
 * 3. **juger la chaîne brute.** Sans retirer la signature avant de juger, le
 *    contrôle ne voit jamais un corps vide : c'est exactement pourquoi il a
 *    manqué pendant trois ans de jalons.
 *
 * Éprouvée sur les trois défauts exacts avant d'être livrée.
 */

const ROOT = join(__dirname, "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** Le corps d'une fonction, borné à l'export suivant quel qu'il soit. */
function bodyOf(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`);
  expect(start, `${name} introuvable`).toBeGreaterThan(-1);
  const end = source.indexOf("\nexport ", start + 1);
  return source.slice(start, end === -1 ? source.length : end);
}

describe("la règle du vide vit dans le domaine, pure", () => {
  it("elle ne connaît ni base ni écran", () => {
    const source = read("lib/domain/departure-content.ts");
    expect(source).toContain("export function emptyDepartureReason(");
    expect(source).toContain("export function bodyWithoutSignature(");
    for (const forbidden of ["prisma", "server-only", "react", "@/lib/api"]) {
      expect(source, `le domaine ne doit pas connaître « ${forbidden} »`).not.toContain(forbidden);
    }
  });

  it("elle retire la signature avant de juger", () => {
    const source = read("lib/domain/departure-content.ts");
    // Sans cette ligne, le contrôle juge un corps que la composition a signé,
    // donc jamais vide. C'est le défaut exact du jalon 96.
    expect(source).toMatch(/bodyWithoutSignature\(departure\.body, signatureBlocks\)/);
  });
});

describe("le clic humain et l'envoi automatique partagent le contrôle", () => {
  it("il est posé dans `sendDeparture`, avant l'envoi", () => {
    const service = read("lib/api/departures.ts");
    const body = bodyOf(service, "sendDeparture");

    expect(body).toContain("emptyDepartureReason(");
    expect(body).toContain("emptyDepartureRefusal(");

    const check = body.indexOf("emptyDepartureReason(");
    const send = body.indexOf("sendEmailToContact(");
    expect(send, "sendDeparture doit bien envoyer").toBeGreaterThan(-1);
    expect(
      check,
      "le contrôle doit précéder l'envoi : refuser après avoir envoyé ne refuse rien",
    ).toBeLessThan(send);
  });

  it("un départ refusé reste en file avec sa cause, jamais `failed`", () => {
    const body = bodyOf(read("lib/api/departures.ts"), "sendDeparture");
    const refusal = body.slice(body.indexOf("emptyDepartureReason("));
    const guard = refusal.slice(0, refusal.indexOf("checkRate("));
    // `failed` signifie « brouillon non composé » pour la carte, qui désactive
    // alors tous ses boutons : on ne pourrait plus le réécrire (jalon 91).
    expect(guard).not.toContain('status: "failed"');
    expect(guard).toContain("detail: refusal");
  });

  it("il n'existe qu'un seul chemin d'envoi d'un départ", () => {
    const service = read("lib/api/departures.ts");
    expect(
      service.match(/sendEmailToContact\(/g)?.length ?? 0,
      "un second envoi n'aurait aucun des garde-fous de `sendDeparture`",
    ).toBe(1);

    // L'ordonnanceur et la composition passent par la même fonction.
    const auto = read("lib/api/auto-send.ts");
    expect(auto).toContain("sendDeparture(");
    expect(auto).not.toContain("sendEmailToContact");
    expect(read("app/api/departures/route.ts")).toContain('sendDeparture(id, "human")');
  });

  it("la carte annonce le refus que l'envoi rendrait, pas une seconde appréciation", () => {
    const service = read("lib/api/departures.ts");
    const list = bodyOf(service, "listDepartures");
    expect(list).toContain("emptyDepartureReason(");
    expect(read("components/sequences/departure-card.tsx")).toContain(
      "Ce départ est vide : réécrivez-le",
    );
  });
});

describe("un départ périmé se dit, et se réécrit", () => {
  it("l'empreinte est écrite à la composition et comparée à la lecture", () => {
    const service = read("lib/api/departures.ts");
    expect(service).toContain("templateHash: fingerprint");
    expect(bodyOf(service, "listDepartures")).toContain("isStaleDeparture(");
  });

  it("l'avertissement de phrase retirée se taît sur un départ périmé", () => {
    const list = bodyOf(read("lib/api/departures.ts"), "listDepartures");
    // Un avertissement de carte doit décrire ce qui partira : calculé sur le
    // gabarit du jour, il parlerait d'un texte que ce départ ne porte pas.
    expect(list).toMatch(/stale \|\| template === undefined/);
  });

  it("une empreinte vide n'est jamais « périmé »", () => {
    const source = read("lib/domain/departure-content.ts");
    expect(source).toMatch(/if \(stored === ""\) return false;/);
  });
});

describe("« Données de démonstration » ne se dit que d'une fiche de démonstration", () => {
  it("le libellé de la carte ne confond plus la fiche et ce qu'Alex avait", () => {
    const card = read("components/sequences/departure-card.tsx");
    expect(card).toContain("Boutique à citer :");
    expect(card).toContain("departure.demoData");
    // Le libellé fautif ne doit pas revenir sur la ligne du `demoSource`.
    expect(card).not.toMatch(/Données de démonstration : \{departure\.demoSource\}/);
  });

  it("la nature de la fiche se décide sur un fait, jamais sur l'absence de site", () => {
    const source = read("lib/domain/demo-data.ts");
    expect(source).toContain("export function isDemoContact(");
    for (const forbidden of ["website", "companyDomain", "demoTarget"]) {
      expect(source, `« ${forbidden} » ne dit rien de la nature d'une fiche`).not.toContain(
        forbidden,
      );
    }
  });
});

describe("la recherche ne prétend plus avoir mesuré ce qu'elle n'a pas lu", () => {
  it("« rien tenté » et « rien d'exploitable » sont deux états", () => {
    const source = read("lib/domain/research.ts");
    expect(source).toContain('export type ResearchState = "absent" | "none" | "failed" | "read"');
    expect(source).toMatch(/state: "absent"/);
  });

  it("seul l'état mesuré affirme qu'aucune adresse n'était déductible", () => {
    const note = read("components/sequences/research-note.tsx");
    const attempted = note.slice(note.indexOf('research.state === "absent"'));
    expect(attempted).toContain("mesuré : ni site, ni domaine, ni adresse");
    const measured = attempted.slice(attempted.indexOf("La cible a été"));
    expect(measured).toContain("professionnelle à en déduire");
  });
});
