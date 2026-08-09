import type { DbStatus } from "./db-status";

/**
 * Corps de la réponse `/api/health`.
 *
 * Fonction pure et séparée de la route pour une raison précise : c'est la seule
 * surface accessible sans session, et ce qu'elle divulgue doit être vérifiable
 * par un test plutôt que par une relecture. Le test associé énumère les clés
 * produites et échoue si un compteur, un nom de table ou une information de
 * déploiement y réapparaît un jour.
 */
export interface HealthPayload {
  readonly status: "unreachable" | "empty" | "ok";
  readonly database: { readonly reachable: boolean };
  readonly checkedAt: string;
}

export function healthPayload(status: DbStatus, checkedAt: Date): HealthPayload {
  if (!status.ok) {
    return {
      status: "unreachable",
      database: { reachable: false },
      checkedAt: checkedAt.toISOString(),
    };
  }

  // `empty` distingue toujours « base vide » de « base peuplée » — l'information
  // qui avait rendu une perte de données difficile à diagnostiquer. C'est un
  // bit, pas un inventaire : ni le nombre de contacts, ni la raison d'une panne.
  return {
    status: status.total === 0 ? "empty" : "ok",
    database: { reachable: true },
    checkedAt: checkedAt.toISOString(),
  };
}

/** Code HTTP associé. Seul `unreachable` échoue : c'est l'intérêt du healthcheck. */
export function healthStatusCode(payload: HealthPayload): number {
  return payload.status === "unreachable" ? 503 : 200;
}
