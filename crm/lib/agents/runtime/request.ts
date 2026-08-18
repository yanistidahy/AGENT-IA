import "server-only";
import { MIN_OUTPUT_TOKENS } from "@/lib/domain/model-budget";
import { findModel, type Purpose } from "@/lib/domain/model-pricing";

/**
 * Le socle commun de **toute** requête au modèle.
 *
 * Quatre chemins appellent l'API — la rédaction, la reprise, la conversation et
 * les vacations — et ils avaient divergé deux fois. Au jalon 16, la vacation
 * héritait silencieusement des défauts du modèle. Au jalon 32, `email-draft.ts`
 * s'était mis à appeler l'API directement, avec son propre modèle, son propre
 * plafond et son propre effort : un quatrième comportement que rien ne
 * gouvernait. Ce module supprime la possibilité de l'écart — le modèle, le
 * plafond, la réflexion et l'effort ne se décident qu'ici.
 *
 * **Il est conscient des capacités du modèle**, et c'est nouveau. Depuis que le
 * modèle est un réglage, envoyer `thinking` à Haiku 4.5 — qui ne connaît pas la
 * réflexion adaptative — renverrait un 400. Un sélecteur qui casse au premier
 * essai du modèle le moins cher ne sert à rien.
 */

export interface BaseRequest {
  readonly model: string;
  readonly max_tokens: number;
  readonly thinking?: { readonly type: "adaptive"; readonly display: "summarized" | "omitted" };
  readonly output_config?: { readonly effort: "low" | "medium" | "high" | "xhigh" };
}

/**
 * Plafonds de sortie par usage.
 *
 * **32000 pour un email de 200 mots était absurde** : un email fait 600 jetons,
 * la réflexion à effort bas quelques centaines. Le plafond n'est pas facturé —
 * seule la sortie réelle l'est — mais il n'est pas neutre pour autant : c'est
 * le seul garde-fou qui empêche une réponse partie en boucle de coûter le prix
 * d'un livre, et il doit donc être serré au plus près de ce qu'on attend.
 */
export const MAX_TOKENS_BY_PURPOSE: Record<Purpose, number> = {
  draft: 2000,
  revision: 3000,
  chat: 8000,
  shift: 4000,
};

/**
 * Effort de raisonnement par usage.
 *
 * `low` pour écrire : rédiger un email à partir d'un dossier fourni et de
 * règles écrites n'est pas un problème à résoudre, c'est une mise en forme.
 * `medium` pour la conversation, où l'on pose de vraies questions. La vacation
 * garde `low` — elle juge un briefing déjà calculé — et le mode approfondi de
 * la conversation reste le seul chemin vers `xhigh`.
 */
const EFFORT_BY_PURPOSE: Record<Purpose, "low" | "medium"> = {
  draft: "low",
  revision: "low",
  chat: "medium",
  shift: "low",
};

/**
 * Compose une requête pour un usage donné.
 *
 * Le plancher de `MIN_OUTPUT_TOKENS` ne s'applique **qu'aux modèles qui
 * réfléchissent** : sur eux la réflexion partage le plafond avec le texte, et
 * un plafond serré ne rend pas une réponse courte mais une réponse tronquée.
 * Sur un modèle sans réflexion, ce plancher ne ferait que masquer le plafond
 * qu'on vient de choisir.
 */
export function requestFor(
  purpose: Purpose,
  modelId: string,
  options: { readonly deep?: boolean; readonly maxTokens?: number } = {},
): BaseRequest {
  const spec = findModel(modelId);
  const wanted = options.maxTokens ?? MAX_TOKENS_BY_PURPOSE[purpose];
  const thinks = spec === null ? true : spec.adaptiveThinking;
  const deep = options.deep === true;

  const base = {
    model: modelId,
    max_tokens: thinks ? Math.max(wanted, MIN_OUTPUT_TOKENS) : wanted,
  };

  const thinking = thinks
    ? { thinking: { type: "adaptive" as const, display: deep ? ("summarized" as const) : ("omitted" as const) } }
    : {};

  // L'effort est posé **explicitement** partout où le modèle l'accepte. Sur
  // Opus 5 et Sonnet 5, le défaut de l'API est `high` : ne rien poser, c'est
  // payer tous les jours un raisonnement approfondi que personne n'a demandé.
  const effort =
    spec === null || spec.effort
      ? { output_config: { effort: deep ? ("xhigh" as const) : EFFORT_BY_PURPOSE[purpose] } }
      : {};

  return { ...base, ...thinking, ...effort };
}

/** Requête de vacation : plafond borné par le budget réglé. */
export function shiftRequest(budgetTokens: number, modelId: string): BaseRequest {
  return requestFor("shift", modelId, { maxTokens: budgetTokens });
}
