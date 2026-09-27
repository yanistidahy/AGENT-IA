import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **Un envoi qui échoue le dit sur sa carte, et n'appelle jamais le modèle.**
 *
 * Deux familles de défauts, et les deux produisent du code qui compile, ne lève
 * pas, et laisse tous les tests verts :
 *
 * 1. **l'échec muet.** Le refus part dans un bandeau rendu en tête de page,
 *    hors du champ de vision sur un écran qui fait plusieurs hauteurs depuis le
 *    jalon 88 ; ou bien la route rend un 400 nu, donc l'écran garde son état
 *    d'avant le clic et la carte s'affiche comme si rien n'avait été tenté.
 *    Dans les deux cas l'utilisateur lit « rien ne se passe », et un échec
 *    ressemble à un bouton mort. C'est le défaut exact du jalon 91 ;
 * 2. **un appel au modèle sur le chemin d'envoi.** Envoyer un départ d'étape
 *    **écrite à la main** (jalon 87) ne doit rien coûter : le texte est déjà
 *    écrit, et le seul appel légitime vient de « Retravailler avec Alex » ou de
 *    la composition d'une étape `alex`. Un appel glissé dans l'envoi facturerait
 *    chaque validation, et le compteur du jalon 36 le verrait *après*.
 *
 * Statique, comme `compose-source`, `manual-step-source` et
 * `research-single-source` : aucun de ces défauts ne viole un type, et aucun ne
 * se voit à la relecture d'un diff.
 */

function sourceOf(file: string): string {
  return readFileSync(join(process.cwd(), file), "utf8");
}

/** Le source privé de ses commentaires — sinon la garde attrape sa propre prose. */
function codeOf(file: string): string {
  return sourceOf(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

describe("un envoi refusé se voit, et reste dans la file", () => {
  it("la route rend la file même quand le geste échoue", () => {
    /*
      Rendre un 400 nu laissait l'écran sur son état d'avant le clic : un départ
      que le serveur venait de marquer « échoué », avec sa cause en base,
      s'affichait encore comme s'il n'avait rien tenté.
    */
    const route = codeOf("app/api/departures/route.ts");
    // Bornée au gestionnaire des trois décisions : `PATCH` (la retouche à la
    // main) refuse légitimement en 400, son écran est le champ qu'on vient de
    // remplir, pas une carte au bas d'une page de plusieurs écrans.
    const post = route.slice(route.indexOf("export async function POST"));
    expect(post).toMatch(/const departures = await listDepartures\(\)/);
    expect(post).toMatch(/ok: false[\s\S]{0,80}departures/);
    expect(
      /if \(!result\.ok\) return badRequest/.test(post),
      "un refus d'envoi doit voyager avec la file, pas en 400 nu",
    ).toBe(false);
  });

  it("le verdict est rattaché à la carte cliquée, pas au haut de la page", () => {
    const view = codeOf("components/sequences/departures-view.tsx");
    // L'état porte l'identifiant du départ : c'est ce qui permet de rendre le
    // refus sur la bonne carte plutôt que dans un bandeau commun.
    expect(view).toMatch(/setOutcome\(\{\s*id/);
    expect(view).toMatch(/feedback=\{outcome\?\.id === departure\.id/);

    const card = codeOf("components/sequences/departure-card.tsx");
    expect(card).toMatch(/feedback/);
    // Et il est rendu, pas seulement reçu.
    expect(card).toMatch(/feedback !== null && !feedback\.ok/);
  });

  it("un départ refusé pour un motif transitoire garde sa place en file", () => {
    /*
      `readDepartures` ne lit que `pending` et `failed` : écrire « écarté » sur un
      refus qui sera faux demain (délai non écoulé, week-end) faisait disparaître
      la carte alors que rien n'était parti — un échec qui ressemble à un succès.
    */
    const service = codeOf("lib/api/departures.ts");
    expect(service).toMatch(/isTransientBlock\(verdict\.reason\)/);
    expect(service).toMatch(/transient\s*\?\s*\{ detail: reason \}/);
  });

  it("la pause de campagne est refusée à l'envoi, en nommant la campagne", () => {
    const service = codeOf("lib/api/departures.ts");
    expect(service).toMatch(/!departure\.enrollment\.sequence\.active/);
    expect(service).toMatch(/est en pause/);
  });

  it("le mot de passe manquant nomme sa variable et où la poser", () => {
    const mail = codeOf("lib/api/mail.ts");
    expect(mail).toMatch(/passwordEnvFor\(config\.slug\)/);
    expect(mail).toMatch(/variables du service/);
  });
});

describe("le chemin d'envoi ne facture rien", () => {
  it("`sendDeparture` n'appelle ni le modèle ni la rédaction", () => {
    const service = sourceOf("lib/api/departures.ts");
    const start = service.indexOf("export async function sendDeparture");
    const end = service.indexOf("export async function postponeDeparture");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const body = service
      .slice(start, end)
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");

    for (const forbidden of [
      "draftEmail",
      "reviseEmail",
      "researchCompany",
      "researchFor",
      "messages.create",
      "messages.stream",
      "anthropic",
    ]) {
      expect(
        body.includes(forbidden),
        `sendDeparture ne doit pas appeler ${forbidden} : valider un départ déjà écrit ne se facture pas`,
      ).toBe(false);
    }
  });

  it("la route des décisions n'importe aucun client de modèle", () => {
    const route = codeOf("app/api/departures/route.ts");
    for (const forbidden of ["@anthropic-ai", "email-draft", "draftEmail", "reviseEmail"]) {
      expect(route.includes(forbidden), `la route d'envoi ne doit pas importer ${forbidden}`).toBe(
        false,
      );
    }
  });
});
