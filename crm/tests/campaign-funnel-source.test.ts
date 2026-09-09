import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * **Un seul entonnoir, une seule addition.**
 *
 * Le jalon 54 avait écrit `readCampaignFunnel` comme un **second** calcul :
 * ses propres requêtes, ses propres additions, à côté de celles de /emails.
 * Deux séries qui comptent les mêmes personnes finissent par se contredire, et
 * personne ne sait alors laquelle croire — c'est exactement ce que le
 * propriétaire du produit a refusé : « si elles peuvent diverger, elles
 * divergeront, et je n'en croirai aucune ».
 *
 * La garde est **statique** parce que le défaut l'est : deux additions justes
 * chacune de son côté ne lèvent rien, ne font échouer aucun type, et ne
 * deviennent visibles qu'en comparant deux écrans à l'œil.
 *
 * Elle lit la source **à l'exécution** plutôt qu'une liste recopiée : une
 * constante finirait par ne plus décrire le fichier qu'elle prétend décrire.
 */

const ROOT = path.join(__dirname, "..");

function sourceOf(relative: string): string {
  // Les commentaires sont retirés avant l'examen : ce fichier-ci explique
  // justement pourquoi on ne compte pas les envois à la main, et la garde
  // attraperait sa propre documentation (leçon du jalon 52).
  return readFileSync(path.join(ROOT, relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

describe("l'entonnoir d'une campagne est celui de /emails, borné", () => {
  const campaigns = sourceOf("lib/api/campaigns.ts");

  it("passe par readFunnelFacts et buildFunnel, jamais par une addition locale", () => {
    expect(campaigns).toContain("readFunnelFacts");
    expect(campaigns).toContain("buildFunnel");
  });

  it("ne fabrique pas ses nombres, il les lit dans les faits", () => {
    // Chaque étage vient de la même addition que /emails. Un seul recomposé
    // ici et les deux écrans afficheraient deux nombres sur les mêmes gens.
    for (const field of ["messages", "written", "opened", "replied", "meetings"]) {
      expect(campaigns).toContain(`facts.input.${field}`);
    }
    // Aucune agrégation d'envois : compter, c'est le travail de
    // `readFunnelFacts`. (`emailSend.count` reste permis au **verdict de
    // suppression**, qui ne demande pas un étage d'entonnoir mais un fait
    // binaire — cette campagne a-t-elle jamais envoyé.)
    expect(campaigns).not.toMatch(/emailSend\s*\.\s*(groupBy|aggregate)/);
    const counts = campaigns.match(/emailSend\s*\.\s*count/g) ?? [];
    expect(counts).toHaveLength(1);
    expect(campaigns).toMatch(/deleteVerdict[\s\S]*?emailSend\s*\.\s*count/);
  });

  it("ne définit aucune seconde définition de « a répondu »", () => {
    // La seule est `readReplyFacts` (jalon 39) : trois écrans qui compteraient
    // chacun leurs réponses en afficheraient trois nombres.
    expect(campaigns).not.toMatch(/emailReply\s*\.\s*findMany/);
    expect(campaigns).toContain("readReplyFacts");
  });

  it("readFunnelFacts accepte une portée, donc sert les deux écrans", () => {
    const stats = sourceOf("lib/api/email-stats.ts");
    expect(stats).toMatch(/export\s+async\s+function\s+readFunnelFacts/);
    expect(stats).toMatch(/sequenceId\?:\s*string/);
    // /emails l'appelle aussi : si `readEmailStats` cessait de passer par elle,
    // la campagne et la page des emails redeviendraient deux additions.
    expect(stats).toMatch(/readEmailStats[\s\S]*readFunnelFacts/);
  });
});

describe("la campagne est nommée sur la ligne d'envoi", () => {
  it("est déduite de la séquence, jamais reçue de l'écran", () => {
    const send = sourceOf("lib/api/email-send.ts");
    expect(send).toContain("campaignOfSequence");
    // Une campagne transmise par la requête laisserait un écran revendiquer
    // les envois d'une autre, et l'entonnoir compterait ce qu'on lui dit.
    expect(send).not.toMatch(/campaignId:\s*z\./);
    expect(send).not.toMatch(/input\.campaignId/);
  });

  it("est copiée sur l'envoi, comme le nom de séquence", () => {
    const sends = sourceOf("lib/api/email-sends.ts");
    expect(sends).toMatch(/campaignId:\s*input\.campaignId/);
    expect(sends).toMatch(/campaignName:\s*input\.campaignName/);
  });
});
