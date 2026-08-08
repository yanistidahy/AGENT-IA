import { runAllShifts } from "@/lib/agents/shifts/run";
import { constantTimeEqual } from "@/lib/auth/session";
import { jsonOk, serverError } from "@/lib/api/errors";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Une vacation dépasse largement le délai par défaut d'une route Next. */
export const maxDuration = 300;

/**
 * Point d'entrée du planificateur.
 *
 * Fermé par son **propre** secret, distinct du mot de passe d'espace : un cron
 * n'est pas un utilisateur, et lui confier le mot de passe qui ouvre tout le CRM
 * reviendrait à en faire une seconde copie à protéger.
 *
 * Répond 401 plutôt que de rediriger : un planificateur ne suit pas de
 * redirection, il enregistrerait un 302 comme un succès.
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (typeof secret !== "string" || secret.trim() === "") return false;

  const header = request.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (presented === "") return false;

  return constantTimeEqual(presented, secret);
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json(
      { error: { message: "Secret de planification absent ou invalide." } },
      { status: 401 },
    );
  }

  try {
    // Chaque vacation journalise son propre résultat, y compris en cas d'échec :
    // le tableau renvoyé ici est une commodité pour le cron, pas la trace.
    const results = await runAllShifts(false);
    return jsonOk({ runs: results });
  } catch (error) {
    return serverError("POST /api/cron/shifts", error);
  }
}
