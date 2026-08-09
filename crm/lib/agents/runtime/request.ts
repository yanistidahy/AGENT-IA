import "server-only";
import { effortFor, MAX_TOKENS, MODEL, thinkingFor } from "./client";
import { MIN_OUTPUT_TOKENS } from "@/lib/domain/model-budget";

/**
 * Le socle commun de **toute** requête au modèle.
 *
 * Deux chemins appellent l'API — la conversation et les vacations — et ils
 * avaient divergé : la conversation posait `thinking` et `output_config`, la
 * vacation ne posait ni l'un ni l'autre et héritait donc silencieusement des
 * défauts du modèle (réflexion active, effort `high`). Un même modèle, deux
 * comportements, une seule des deux formes testée. Ce module supprime la
 * possibilité de l'écart : le modèle, le plafond, la réflexion et l'effort ne
 * se décident qu'ici.
 */

export interface BaseRequest {
  readonly model: string;
  readonly max_tokens: number;
  readonly thinking: { readonly type: "adaptive"; readonly display: "summarized" | "omitted" };
  readonly output_config: { readonly effort: "low" | "medium" | "xhigh" };
}

/** Requête de conversation : l'utilisateur attend, l'effort suit le mode. */
export function conversationRequest(deep: boolean): BaseRequest {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: thinkingFor(deep),
    output_config: { effort: effortFor(deep) },
  };
}

/**
 * Requête de vacation : effort bas, plafond borné par le budget réglé.
 *
 * L'effort est `low` **explicitement**, et non hérité : une vacation juge un
 * briefing déjà calculé — les faits sont établis, il ne reste qu'à trancher ce
 * qui mérite d'être dit. Laisser le défaut `high` ferait payer un raisonnement
 * approfondi pour une tâche qui n'en demande pas, tous les jours.
 */
export function shiftRequest(budgetTokens: number): BaseRequest {
  return {
    model: MODEL,
    max_tokens: Math.max(budgetTokens, MIN_OUTPUT_TOKENS),
    thinking: thinkingFor(false),
    output_config: { effort: "low" },
  };
}
