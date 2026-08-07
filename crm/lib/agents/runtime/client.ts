import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/**
 * Client Anthropic — serveur exclusivement.
 *
 * L'import `server-only` en tête est la garde : toute tentative d'importer ce
 * module depuis un composant client fait échouer le build, avant qu'une clé
 * puisse se retrouver dans un bundle navigateur. Le test
 * `lib/agents/__tests__/no-key-in-bundle.test.ts` vérifie la sortie de build.
 */

export const MODEL = "claude-opus-5";

/**
 * Plafond de sortie par réponse. C'est le garde-fou de coût : le mode
 * approfondi relève l'effort de raisonnement, jamais ce plafond.
 */
export const MAX_TOKENS = 4096;

/** Effort de raisonnement selon le mode. */
export function effortFor(deep: boolean): "medium" | "xhigh" {
  return deep ? "xhigh" : "medium";
}

/**
 * En mode approfondi, on demande le résumé du raisonnement pour l'afficher dans
 * le bloc repliable. Sinon on l'omet — c'est le défaut du modèle et ça évite de
 * payer l'affichage d'un contenu que personne ne déplie.
 */
export function thinkingFor(deep: boolean): { type: "adaptive"; display: "summarized" | "omitted" } {
  return { type: "adaptive", display: deep ? "summarized" : "omitted" };
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("ANTHROPIC_API_KEY n'est pas configurée sur le serveur.");
    this.name = "MissingApiKeyError";
  }
}

let cached: Anthropic | null = null;

export function anthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey === undefined || apiKey.trim() === "") throw new MissingApiKeyError();
  cached ??= new Anthropic({ apiKey });
  return cached;
}

/** Message d'erreur lisible, sans jamais divulguer la clé ni la trace. */
export function describeAnthropicError(error: unknown): string {
  if (error instanceof MissingApiKeyError) {
    return "La clé API Anthropic n'est pas configurée sur le serveur. Ajoutez ANTHROPIC_API_KEY dans les variables du service.";
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return "La clé API Anthropic est refusée. Vérifiez sa valeur dans les variables du service.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "Trop de requêtes vers Anthropic pour le moment. Réessayez dans quelques instants.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Impossible de joindre l'API Anthropic. Vérifiez la connexion réseau du service.";
  }
  if (error instanceof Anthropic.APIError) {
    return `L'API Anthropic a renvoyé une erreur (${error.status ?? "sans code"}).`;
  }
  return "Une erreur inattendue est survenue pendant la conversation.";
}
