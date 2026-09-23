import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **Les trois façons de rater la réinitialisation de campagne.**
 *
 * Aucune ne lève, aucune ne fait rougir un type : ce sont des silences, et
 * c'est pour cela que la garde est statique — même famille que
 * `sequence-reopen-source`, `status-single-source` et `cost-single-source`.
 *
 * 1. **écrire une clause SQL jumelle** de `resettable()`. Le jalon 82 a payé
 *    cette leçon : la seconde écriture décide réellement, et le plan peut
 *    alors annoncer des gens que l'écriture ne touche pas ;
 * 2. **effacer le passé**. Les envois sont des faits ; seule la progression de
 *    la campagne revient à zéro ;
 * 3. **inclure les personnes ayant répondu par défaut** — un nouveau premier
 *    message à quelqu'un qui a déjà répondu efface ce que la campagne a
 *    obtenu.
 */

const root = join(__dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

const service = read("lib/api/campaign-reset.ts");
const route = read("app/api/campaigns/reset/route.ts");
const panel = read("components/campaigns/reset-action.tsx");

describe("la sélection passe par le domaine, jamais par une clause jumelle", () => {
  it("applyCampaignReset filtre avec resettable()", () => {
    expect(service).toContain("resettable(");
    // La règle est demandée au domaine puis appliquée ligne à ligne : aucune
    // écriture ne re-décrit « qui est reprenable » en SQL.
    expect(service).not.toMatch(/updateMany\(\{[\s\S]{0,200}status:\s*"done"/);
    // Aucune lecture ne présélectionne sur le statut ni sur le motif : les
    // inscriptions sont lues telles quelles, et `resettable` tranche.
    expect(service).not.toMatch(/findMany\(\{[\s\S]{0,200}status:\s*"/);
    expect(service).not.toMatch(/stopReason:\s*\{/);
  });

  it("le plan et l'écriture appellent la même fonction", () => {
    const calls = service.match(/resettable\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("le passé n'est jamais réécrit", () => {
  it("aucun envoi, aucune interaction, aucune fiche n'est supprimé ni modifié", () => {
    for (const forbidden of [
      "emailSend.delete",
      "emailSend.update",
      "activity.delete",
      "activity.update",
      "contact.update",
      "contact.delete",
    ]) {
      expect(service).not.toContain(forbidden);
    }
  });

  it("seuls les départs jamais partis sont effacés", () => {
    // `round` ouvre un chapitre au lieu d'écraser le précédent : les départs
    // **envoyés** gardent leur place, avec leur tour.
    expect(service).toMatch(/sequenceDeparture\.deleteMany[\s\S]{0,200}status:\s*\{\s*not:\s*"sent"/);
    expect(service).toContain("round: row.round + 1");
  });

  it("lastSentAt n'est pas effacé : c'est la date d'un fait", () => {
    expect(service).not.toMatch(/lastSentAt:\s*null/);
  });
});

describe("les personnes ayant répondu sont exclues par défaut", () => {
  it("le schéma de la route pose false comme défaut", () => {
    expect(route).toMatch(/includeRepliers:\s*z\.boolean\(\)\.default\(false\)/);
  });

  it("l'écran part décoché et redemande le plan quand on coche", () => {
    expect(panel).toContain("useState(false)");
    expect(panel).toContain("void ask(next)");
  });

  it("la confirmation nomme les personnes ayant répondu", () => {
    expect(panel).toContain("repliersNote");
  });
});

describe("regarder ne coûte rien", () => {
  it("POST ne compose pas, PUT compose", () => {
    const post = route.slice(route.indexOf("export async function POST"), route.indexOf("export async function PUT"));
    expect(post).toContain("planCampaignReset");
    expect(post).not.toContain("applyCampaignReset");
    expect(service).toContain("composeForCampaign");
  });

  it("rien n'est envoyé : la composition passe par le chemin ordinaire", () => {
    expect(service).not.toContain("sendDeparture");
    expect(service).not.toContain("sendEmailToContact");
  });
});
