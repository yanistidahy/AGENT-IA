import "server-only";
import { NextResponse } from "next/server";
import { constantTimeEqual } from "../auth/session";

/**
 * Porte des routes de planification.
 *
 * Fermée par son **propre** secret, distinct du mot de passe d'espace : un
 * planificateur n'est pas un utilisateur, et lui confier le mot de passe qui
 * ouvre tout le CRM en ferait une seconde copie à protéger.
 *
 * Extraite parce que trois routes la partagent désormais. Recopier une
 * vérification d'authentification, c'est accepter qu'une copie soit corrigée
 * seule.
 */
export function cronAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (typeof secret !== "string" || secret.trim() === "") return false;

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (presented === "") return false;

  return constantTimeEqual(presented, secret);
}

/**
 * Refus normalisé.
 *
 * 401 plutôt qu'une redirection : un planificateur ne suit pas de redirection,
 * il enregistrerait un 302 comme un succès et l'échec serait invisible.
 */
export function cronDenied(): NextResponse {
  return NextResponse.json(
    { error: { message: "Secret de planification absent ou invalide." } },
    { status: 401 },
  );
}
