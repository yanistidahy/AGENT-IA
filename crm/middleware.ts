import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, isPublicPath, workspacePassword } from "@/lib/auth/config";
import { verifyToken } from "@/lib/auth/session";

/**
 * Verrou d'espace de travail.
 *
 * Un seul point de passage, pour une raison : protéger route par route revient à
 * se souvenir de le faire à chaque nouvelle route, et l'oubli d'une seule rouvre
 * tout. Ici, **tout est privé par défaut** ; `PUBLIC_PATHS` énumère les rares
 * exceptions. Une route ajoutée demain est protégée sans que personne n'y pense.
 *
 * Le `matcher` ci-dessous ne fait qu'écarter les fichiers statiques du travail
 * de vérification ; il n'accorde aucun accès — la décision revient toujours à
 * `isPublicPath()`.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

/** Réponse aux requêtes de données : 401 franc, jamais une page HTML. */
function isDataRequest(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  const secret = workspacePassword();

  /**
   * Variable absente : on **ferme**, on n'ouvre pas.
   *
   * Le défaut qu'on corrige est né d'un accès sans condition ; le remplacer par
   * un accès conditionné à une variable qui, manquante, laisse tout passer,
   * serait le même défaut avec une étape de plus. Un déploiement mal configuré
   * doit être visiblement cassé, pas discrètement ouvert.
   */
  if (secret === null) {
    return new NextResponse(
      JSON.stringify({
        error: {
          message:
            "WORKSPACE_PASSWORD n'est pas configurée. L'espace reste fermé tant qu'elle manque.",
        },
      }),
      { status: 503, headers: { "Content-Type": "application/json; charset=utf-8" } },
    );
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (await verifyToken(secret, token)) return NextResponse.next();

  if (isDataRequest(pathname)) {
    return new NextResponse(
      JSON.stringify({ error: { message: "Session requise." } }),
      {
        status: 401,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          // Interdit à un cache intermédiaire de garder la réponse d'un 401 —
          // et, plus important, de servir la version authentifiée à un autre.
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  // Le chemin demandé est conservé pour y revenir après connexion. Seul un
  // chemin relatif est accepté à la relecture (voir la page de connexion) :
  // sans cela, `?next=https://…` ferait de la page un tremplin de redirection.
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}
