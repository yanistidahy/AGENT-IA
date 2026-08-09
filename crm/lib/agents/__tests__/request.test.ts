import { describe, expect, it } from "vitest";
import { conversationRequest, shiftRequest } from "../runtime/request";
import { MIN_OUTPUT_TOKENS } from "@/lib/domain/model-budget";

/**
 * Régression : les deux chemins d'appel ne doivent plus diverger.
 *
 * La conversation posait `thinking` et `output_config` ; la vacation ne posait
 * ni l'un ni l'autre et héritait donc en silence des défauts du modèle —
 * réflexion active, effort `high`. Un seul des deux chemins était réellement
 * exercé, et le second dépensait un raisonnement approfondi tous les jours sans
 * que personne l'ait demandé.
 */

describe("socle commun des requêtes", () => {
  it("pose toujours le modèle, la réflexion et l'effort — sur les deux chemins", () => {
    for (const request of [conversationRequest(false), conversationRequest(true), shiftRequest(4000)]) {
      expect(request.model).toBe("claude-opus-5");
      expect(request.thinking.type).toBe("adaptive");
      expect(["low", "medium", "xhigh"]).toContain(request.output_config.effort);
      expect(request.max_tokens).toBeGreaterThanOrEqual(MIN_OUTPUT_TOKENS);
    }
  });

  it("ne laisse jamais l'effort d'une vacation être hérité", () => {
    // `low` explicite : une vacation juge un briefing déjà calculé.
    expect(shiftRequest(4000).output_config.effort).toBe("low");
  });

  it("suit le mode approfondi sur la conversation", () => {
    expect(conversationRequest(false).output_config.effort).toBe("medium");
    expect(conversationRequest(true).output_config.effort).toBe("xhigh");
    expect(conversationRequest(true).thinking.display).toBe("summarized");
    expect(conversationRequest(false).thinking.display).toBe("omitted");
  });

  /**
   * Le plancher n'est pas une politesse : la réflexion partage le plafond avec
   * le texte. Un budget de 500 jetons ne produit pas une réponse courte, il
   * produit une réponse coupée qui échoue ensuite à l'analyse JSON.
   */
  it("relève un budget de vacation trop bas au plancher", () => {
    expect(shiftRequest(500).max_tokens).toBe(MIN_OUTPUT_TOKENS);
    expect(shiftRequest(32000).max_tokens).toBe(32000);
  });

  it("laisse à la conversation de quoi réfléchir et répondre", () => {
    // 4096 était la valeur d'un modèle sans réflexion ; elle tronquait.
    expect(conversationRequest(false).max_tokens).toBeGreaterThan(4096);
  });
});
