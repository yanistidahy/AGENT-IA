import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * **Rouvrir une inscription est la moins réversible des écritures d'un écran
 * de configuration.**
 *
 * Trois façons de rater ce jalon, et aucune ne lève, ne casse un type ni ne
 * fait rougir un test :
 *
 * 1. **rouvrir large** — le jour où la requête cesse de filtrer sur le motif,
 *    une réponse reçue, une fiche close ou un retrait à la main redeviennent
 *    des candidats à la relance. C'est exactement ce que le jalon interdit, et
 *    cela ne se verrait que chez le destinataire ;
 * 2. **rouvrir sans le dire** — brancher la réouverture sur l'enregistrement
 *    ferait d'une correction de délai une relance de cinquante-deux personnes.
 *    C'est la leçon du jalon 70, où « Enregistrer » composait ;
 * 3. **repartir de zéro** — remettre `lastStep` ou `lastSentAt` renverrait le
 *    premier message à des gens qui l'ont déjà reçu, et ferait compter le délai
 *    depuis l'instant de l'ajout plutôt que depuis leur dernier message.
 *
 * Même famille que `campaign-removal-source` et `compose-source` : une garde
 * statique pour un défaut statique.
 */

const ROOT = path.join(__dirname, "..");

function sourceOf(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

const service = sourceOf("lib/api/email-sequences.ts");
const reopenBody = service.slice(
  service.indexOf("export async function applyReopen"),
  service.indexOf("async function closeWithoutNextStep"),
);

describe("on ne rouvre qu'une séquence épuisée", () => {
  it("l'écriture demande au domaine, elle ne réécrit pas la règle", () => {
    // **Le défaut du jalon 81.** `applyReopen` portait sa propre clause SQL —
    // `status: FINISHED_STATUS` et `stopReason: BLOCK_LABELS.finished` — donc
    // une seconde écriture de la règle, à côté de celle du domaine, et c'est
    // elle qui décidait réellement. Le plan et l'écriture pouvaient alors ne
    // pas voir les mêmes lignes, sans que rien ne lève.
    const body = reopenBody;
    expect(body).toMatch(/reopenable\(row\.status, row\.stopReason\)/);
    expect(body).not.toMatch(/stopReason: BLOCK_LABELS\.finished/);
  });

  it("jamais une inscription vivante ni retirée", () => {
    const body = reopenBody;
    expect(body).toMatch(/status: \{ not: "active" \}/);
  });

  it("et seulement ceux à qui il reste une étape", () => {
    const body = reopenBody;
    expect(body).toMatch(/lastStep: \{ lt: steps \}/);
  });

  it("la règle est dite une fois, dans le domaine", () => {
    expect(service).toMatch(/reopenable\(/);
    // La version fautive : recomposer le test sur place, donc l'oublier ici le
    // jour où il se resserre là-bas.
    const plan = service.slice(
      service.indexOf("export async function planReopen"),
      service.indexOf("export async function applyReopen"),
    );
    expect(plan).not.toMatch(/=== "done"/);
  });
});

describe("la réouverture ne repart pas de zéro", () => {
  it("ni `lastStep` ni `lastSentAt` ne sont réécrits", () => {
    const body = reopenBody;
    expect(body).not.toMatch(/lastStep: 0/);
    expect(body).not.toMatch(/lastSentAt/);
  });

  it("l'échéance se calcule depuis le dernier envoi", () => {
    expect(service).toMatch(/daysUntilDue\(row\.lastSentAt/);
  });
});

describe("rien ne rouvre sans confirmation", () => {
  const panel = sourceOf("components/settings/email-sequences-panel.tsx");

  it("le plan est demandé avant d'enregistrer, et il n'écrit rien", () => {
    expect(panel).toMatch(/method: "POST"[\s\S]{0,400}sequenceId/);
    expect(panel).toMatch(/setConfirm\(\{/);
  });

  it("la réouverture passe par un second geste", () => {
    // `save(sequence, true)` n'est atteignable que depuis le panneau de
    // confirmation : le bouton « Enregistrer » appelle `askThenSave`.
    expect(panel).toMatch(/onClick=\{\(\) => void askThenSave\(sequence\)\}/);
    expect(panel).toMatch(/void save\(confirm\.sequence, true\)/);
  });

  it("les phrases viennent du domaine, pas du navigateur", () => {
    const route = sourceOf("app/api/sequences-email/reopen/route.ts");
    expect(route).toMatch(/describeReopen\(plan\)/);
    expect(route).toMatch(/describeExclusions\(plan\.excluded\)/);
    expect(panel).not.toMatch(/personnes ont terminé/);
  });
});

describe("zéro rouverture ne s'enregistre pas en silence", () => {
  const panel = sourceOf("components/settings/email-sequences-panel.tsx");

  it("l'écran montre le plan même quand personne ne rouvre", () => {
    // La version fautive : `if (candidates.length === 0) { await save(); }` —
    // la main rendue sans un mot, et aucun moyen de savoir depuis la
    // production si la règle est trop étroite ou si la base dit autre chose.
    expect(panel).not.toMatch(/candidates\.length === 0[\s\S]{0,120}await save\(sequence\)/);
    expect(panel).toMatch(/silence/);
  });

  it("et il dit ce que la base porte vraiment", () => {
    expect(service).toMatch(/reasons\.set\(row\.stopReason/);
    const domain = sourceOf("lib/domain/sequence-reopen.ts");
    expect(domain).toMatch(/export function describeSilence/);
    expect(domain).toMatch(/Motifs enregistrés/);
  });
});

describe("retirer l'étape rend l'état d'avant", () => {
  it("l'enregistrement referme ce qui n'a plus d'étape à recevoir", () => {
    expect(service).toMatch(/await closeWithoutNextStep\(saved, input\.steps\.length\)/);
  });

  it("et emporte les brouillons jamais partis, jamais les envois", () => {
    const body = service.slice(service.indexOf("async function closeWithoutNextStep"));
    expect(body).toMatch(/status: \{ not: "sent" \}/);
  });
});
