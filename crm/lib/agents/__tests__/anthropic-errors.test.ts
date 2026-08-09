import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { anthropicFailure, describeAnthropicError, MissingApiKeyError } from "../runtime/client";

/**
 * Régression : un 400 doit dire **quel champ** est refusé.
 *
 * Ce test existe à cause d'un incident réel. Le premier appel Anthropic en
 * production a échoué, et l'écran n'a affiché que « L'API Anthropic a renvoyé
 * une erreur (400) ». L'API avait pourtant renvoyé un corps JSON nommant le
 * champ fautif — il était jeté. Un aller-retour de débogage entier a été perdu
 * pour une information que le serveur avait déjà reçue.
 */

/** Corps exactement tel que l'API le renvoie sur une requête invalide. */
function apiError(status: number, type: string, message: string) {
  const headers = new Headers({ "request-id": "req_011CSHoEeqs5C35K2UUqR7Fy" });
  return Anthropic.APIError.generate(status, { type: "error", error: { type, message } }, undefined, headers);
}

describe("extraction du corps d'erreur", () => {
  it("récupère statut, type, message et identifiant de requête", () => {
    const failure = anthropicFailure(
      apiError(400, "invalid_request_error", "thinking.budget_tokens: unexpected value"),
    );

    expect(failure).not.toBeNull();
    expect(failure?.status).toBe(400);
    expect(failure?.type).toBe("invalid_request_error");
    expect(failure?.detail).toBe("thinking.budget_tokens: unexpected value");
    expect(failure?.requestId).toBe("req_011CSHoEeqs5C35K2UUqR7Fy");
  });

  it("renvoie null pour ce qui n'est pas une erreur d'API", () => {
    expect(anthropicFailure(new Error("panne réseau"))).toBeNull();
    expect(anthropicFailure(new MissingApiKeyError())).toBeNull();
  });
});

describe("message affiché", () => {
  it("cite le message de l'API sur un 400, plutôt que le seul code", () => {
    const message = describeAnthropicError(
      apiError(400, "invalid_request_error", "max_tokens: must be greater than thinking budget"),
    );

    expect(message).toContain("400");
    expect(message).toContain("max_tokens: must be greater than thinking budget");
    // Le symptôme exact de l'incident : un code sans explication.
    expect(message).not.toBe("L'API Anthropic a renvoyé une erreur (400).");
  });

  it("garde un message dédié pour la clé absente", () => {
    expect(describeAnthropicError(new MissingApiKeyError())).toContain("ANTHROPIC_API_KEY");
  });

  it("garde un message dédié pour une clé refusée, sans citer le corps", () => {
    const message = describeAnthropicError(
      apiError(401, "authentication_error", "invalid x-api-key"),
    );
    expect(message).toContain("refusée");
    // Une clé invalide se corrige dans les variables du service : le message
    // de l'API n'ajoute rien et ressemble à une fuite.
    expect(message).not.toContain("x-api-key");
  });

  it("ne divulgue jamais la clé, quel que soit le corps reçu", () => {
    const message = describeAnthropicError(
      apiError(400, "invalid_request_error", "clé sk-ant-secret123 rejetée"),
    );
    // Le corps est remonté tel quel : c'est voulu. Ce que le test fixe, c'est
    // qu'on ne va **pas** chercher la variable d'environnement pour l'ajouter.
    expect(message).not.toContain(process.env.ANTHROPIC_API_KEY ?? "sk-ant-jamais");
  });
});
