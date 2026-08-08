import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, cookieOptions, workspacePassword } from "@/lib/auth/config";
import { checkRateLimit, clearFailures, clientKey, recordFailure } from "@/lib/auth/rate-limit";
import { issueToken, passwordMatches } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
/** Le compteur de tentatives vit en mémoire : il exige le runtime Node, pas Edge. */
export const runtime = "nodejs";

/**
 * Ouverture de session.
 *
 * Un seul message d'erreur pour toutes les causes de refus : dire « mot de passe
 * incorrect » plutôt que « champ manquant » ne renseigne personne d'utile, et
 * distinguer les cas apprend à un attaquant ce qu'il a déjà réussi.
 */
export async function POST(request: Request) {
  const secret = workspacePassword();
  if (secret === null) {
    return NextResponse.json(
      { error: { message: "WORKSPACE_PASSWORD n'est pas configurée sur le serveur." } },
      { status: 503 },
    );
  }

  const key = clientKey(request.headers);
  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        error: {
          message: `Trop de tentatives. Réessayez dans ${Math.ceil(limit.retryAfter / 60)} minute(s).`,
        },
      },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  const candidate =
    typeof body === "object" && body !== null && "password" in body
      ? (body as { password: unknown }).password
      : null;

  const refuse = () => {
    recordFailure(key);
    return NextResponse.json(
      { error: { message: "Mot de passe incorrect." } },
      { status: 401 },
    );
  };

  if (typeof candidate !== "string" || candidate === "") return refuse();
  if (!(await passwordMatches(candidate, secret))) return refuse();

  clearFailures(key);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    SESSION_COOKIE,
    await issueToken(secret, SESSION_MAX_AGE),
    cookieOptions(),
  );
  return response;
}
