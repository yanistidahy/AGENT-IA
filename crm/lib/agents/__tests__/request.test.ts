import { describe, expect, it } from "vitest";
import { MAX_TOKENS_BY_PURPOSE, requestFor, shiftRequest } from "../runtime/request";
import { MIN_OUTPUT_TOKENS } from "@/lib/domain/model-budget";
import { DEFAULT_MODELS, MODELS, PURPOSES } from "@/lib/domain/model-pricing";

/**
 * Régression : les chemins d'appel ne doivent pas diverger.
 *
 * Écrit au jalon 16, quand la conversation posait `thinking` et `output_config`
 * là où la vacation n'en posait aucun et héritait donc en silence des défauts du
 * modèle — réflexion active, effort `high`.
 *
 * **Étendu au jalon 36**, où deux choses ont changé : `email-draft.ts` avait
 * ouvert un quatrième chemin qui appelait l'API sans passer par ici, et le
 * modèle est devenu un réglage. Un modèle réglable impose une contrainte
 * nouvelle : ne jamais envoyer un champ que le modèle choisi refuse.
 */

describe("socle commun des requêtes", () => {
  it("pose le modèle et un plafond sur les quatre usages", () => {
    for (const purpose of PURPOSES) {
      const request = requestFor(purpose, DEFAULT_MODELS[purpose]);
      expect(request.model).toBe(DEFAULT_MODELS[purpose]);
      expect(request.max_tokens).toBeGreaterThan(0);
    }
  });

  it("ne laisse jamais l'effort être hérité, sur aucun usage", () => {
    // Sur Opus 5 et Sonnet 5, le défaut de l'API est `high` : ne rien poser,
    // c'est payer un raisonnement approfondi que personne n'a demandé.
    for (const purpose of PURPOSES) {
      const request = requestFor(purpose, DEFAULT_MODELS[purpose]);
      expect(request.output_config?.effort, `${purpose} hérite de l'effort`).toBeDefined();
    }
  });

  it("écrit à effort bas, converse à effort moyen", () => {
    expect(requestFor("draft", "claude-sonnet-5").output_config?.effort).toBe("low");
    expect(requestFor("revision", "claude-sonnet-5").output_config?.effort).toBe("low");
    expect(requestFor("chat", "claude-sonnet-5").output_config?.effort).toBe("medium");
    expect(shiftRequest(4000, "claude-opus-5").output_config?.effort).toBe("low");
  });

  it("suit le mode approfondi sur la conversation", () => {
    const deep = requestFor("chat", "claude-opus-5", { deep: true });
    expect(deep.output_config?.effort).toBe("xhigh");
    expect(deep.thinking?.display).toBe("summarized");
    expect(requestFor("chat", "claude-opus-5").thinking?.display).toBe("omitted");
  });

  /**
   * **N'envoie que ce que le modèle accepte.**
   *
   * Haiku 4.5 ne connaît pas la réflexion adaptative : lui poser `thinking`
   * renvoie un 400. Un sélecteur de modèle qui l'ignorerait casserait la
   * rédaction au premier essai du modèle le moins cher — c'est-à-dire
   * exactement celui qu'on veut pouvoir essayer.
   */
  it("n'envoie aucun champ refusé par le modèle choisi", () => {
    for (const model of MODELS) {
      for (const purpose of PURPOSES) {
        const request = requestFor(purpose, model.id);
        if (!model.adaptiveThinking) {
          expect(request.thinking, `${model.id} refuse thinking`).toBeUndefined();
        } else {
          expect(request.thinking?.type).toBe("adaptive");
        }
        if (!model.effort) {
          expect(request.output_config, `${model.id} refuse effort`).toBeUndefined();
        }
      }
    }
  });

  /**
   * Le plancher n'est pas une politesse : sur un modèle qui réfléchit, la
   * réflexion partage le plafond avec le texte. Un budget de 500 jetons ne
   * produit pas une réponse courte, il produit une réponse coupée.
   *
   * Sur un modèle qui ne réfléchit pas, ce plancher ne ferait que masquer le
   * plafond qu'on vient de choisir : il ne s'applique donc pas.
   */
  it("relève un budget trop bas au plancher, mais seulement s'il y a réflexion", () => {
    expect(shiftRequest(500, "claude-opus-5").max_tokens).toBe(MIN_OUTPUT_TOKENS);
    expect(shiftRequest(32000, "claude-opus-5").max_tokens).toBe(32000);
    expect(requestFor("draft", "claude-haiku-4-5", { maxTokens: 800 }).max_tokens).toBe(800);
  });

  /**
   * Le point du jalon 36 : 32000 jetons de plafond pour un email de 200 mots.
   * Le plafond n'est pas facturé, mais c'est le seul garde-fou qui empêche une
   * réponse partie en boucle de coûter le prix d'un livre.
   */
  it("borne la sortie au plus près de ce qu'on attend", () => {
    expect(MAX_TOKENS_BY_PURPOSE.draft).toBeLessThanOrEqual(2000);
    expect(MAX_TOKENS_BY_PURPOSE.revision).toBeLessThanOrEqual(4000);
    expect(MAX_TOKENS_BY_PURPOSE.chat).toBeLessThanOrEqual(8000);
    // …mais jamais sous le plancher de réflexion, qui tronquerait.
    for (const value of Object.values(MAX_TOKENS_BY_PURPOSE)) {
      expect(value).toBeGreaterThanOrEqual(MIN_OUTPUT_TOKENS);
    }
  });
});
