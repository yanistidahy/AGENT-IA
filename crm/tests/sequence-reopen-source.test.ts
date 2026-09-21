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
  it("la requête filtre sur le statut **et** sur le motif", () => {
    // Borné à `applyReopen` : `closeWithoutNextStep` écrit le même motif juste
    // en dessous, et un `slice` ouvert laisserait la garde se satisfaire de
    // cette autre occurrence — elle a été prise en défaut une fois ainsi.
    const body = reopenBody;
    expect(body).toMatch(/status: FINISHED_STATUS/);
    expect(body).toMatch(/stopReason: BLOCK_LABELS\.finished/);
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

describe("retirer l'étape rend l'état d'avant", () => {
  it("l'enregistrement referme ce qui n'a plus d'étape à recevoir", () => {
    expect(service).toMatch(/await closeWithoutNextStep\(saved, input\.steps\.length\)/);
  });

  it("et emporte les brouillons jamais partis, jamais les envois", () => {
    const body = service.slice(service.indexOf("async function closeWithoutNextStep"));
    expect(body).toMatch(/status: \{ not: "sent" \}/);
  });
});
