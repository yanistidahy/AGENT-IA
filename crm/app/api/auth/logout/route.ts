import { NextResponse } from "next/server";
import { SESSION_COOKIE, cookieOptions } from "@/lib/auth/config";

export const dynamic = "force-dynamic";

/**
 * Fermeture de session.
 *
 * Le cookie est réécrit vide avec `maxAge: 0` plutôt que simplement supprimé :
 * les mêmes attributs (`path`, `secure`, `sameSite`) doivent être présents pour
 * que le navigateur reconnaisse le cookie à effacer.
 *
 * Publique à dessein — se déconnecter ne doit pas exiger d'être connecté, sans
 * quoi une session à moitié valide ne pourrait plus être jetée.
 */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", cookieOptions(0));
  return response;
}
