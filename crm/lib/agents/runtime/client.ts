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

/**
 * **Le modèle ne se décide plus ici.**
 *
 * Il vivait dans cette constante, et le plafond de sortie juste en dessous.
 * Depuis le jalon 36, les deux sont des réglages par usage : rédiger un email
 * et juger un briefing ne sont pas la même tâche, et les payer au même tarif
 * revenait à payer le plus fort des deux pour les deux. Voir
 * `lib/domain/model-pricing.ts` pour les modèles et leurs tarifs, et
 * `runtime/request.ts` pour la composition d'une requête.
 */

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

/**
 * Ce que l'API a réellement répondu, extrait du corps d'erreur.
 *
 * L'API renvoie un corps JSON qui **nomme le champ fautif** — « unexpected
 * value at thinking.type », « max_tokens must be… ». Ne garder que le code HTTP
 * transforme un diagnostic d'une ligne en une session de débogage : c'est
 * exactement ce que ce module s'interdit désormais.
 */
export interface AnthropicFailure {
  readonly status: number | null;
  /** `invalid_request_error`, `authentication_error`… */
  readonly type: string;
  /** Le message de l'API, en anglais, tel quel. C'est lui qui nomme le champ. */
  readonly detail: string;
  /** Identifiant de requête, à citer dans un ticket. */
  readonly requestId: string | null;
}

// `Anthropic.APIError` est une classe exposée en propriété statique : elle vaut
// comme valeur, pas comme type. `InstanceType` récupère le type d'instance.
type ApiError = InstanceType<typeof Anthropic.APIError>;

function readErrorBody(error: ApiError): { type: string; detail: string } {
  const body: unknown = error.error;
  if (typeof body === "object" && body !== null && "error" in body) {
    const inner: unknown = (body as { error: unknown }).error;
    if (typeof inner === "object" && inner !== null) {
      const bag = inner as Record<string, unknown>;
      return {
        type: typeof bag.type === "string" ? bag.type : "api_error",
        detail: typeof bag.message === "string" ? bag.message : error.message,
      };
    }
  }
  return { type: "api_error", detail: error.message };
}

/** Forme exploitable d'une erreur Anthropic, ou `null` si ce n'en est pas une. */
export function anthropicFailure(error: unknown): AnthropicFailure | null {
  if (!(error instanceof Anthropic.APIError)) return null;
  const { type, detail } = readErrorBody(error);
  return {
    status: error.status ?? null,
    type,
    detail,
    requestId: error.requestID ?? null,
  };
}

/**
 * Journalise une erreur Anthropic **en entier**, côté serveur.
 *
 * La clé n'apparaît jamais : on ne journalise que le statut, le type, le
 * message et l'identifiant de requête — soit précisément ce qu'il faut pour
 * corriger, et rien de ce qu'il ne faut pas divulguer.
 */
export function logAnthropicError(where: string, error: unknown): void {
  const failure = anthropicFailure(error);
  if (failure !== null) {
    console.error(
      `[anthropic ${where}] status=${failure.status ?? "?"} type=${failure.type} ` +
        `request_id=${failure.requestId ?? "?"} message=${failure.detail}`,
    );
    return;
  }
  console.error(`[anthropic ${where}]`, error);
}

/**
 * Message lisible, sans jamais divulguer la clé ni la trace.
 *
 * Pour un 400, on **remonte le message de l'API** : il nomme le champ refusé,
 * et le cacher derrière « erreur (400) » ne protège rien — ce corps ne contient
 * ni secret, ni donnée personnelle, seulement la description du champ fautif.
 */
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

  const failure = anthropicFailure(error);
  if (failure !== null) {
    const code = failure.status === null ? "sans code" : String(failure.status);
    const trace = failure.requestId === null ? "" : ` (requête ${failure.requestId})`;
    return `L'API Anthropic a refusé la requête (${code}) : ${failure.detail}${trace}`;
  }

  return "Une erreur inattendue est survenue pendant la conversation.";
}
