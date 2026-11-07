import { NextResponse } from "next/server";
import { constantTimeEqual } from "@/lib/auth/session";
import { applyWebhook } from "@/lib/api/lemlist-sync";
import { jsonOk, serverError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * **Le webhook lemlist : près du temps réel, et fermé par son propre secret.**
 *
 * Publique au sens du middleware — lemlist ne présente pas de session — et
 * privée par `LEMLIST_WEBHOOK_SECRET`. Même régime que les quatre routes de
 * cron depuis le jalon 14 : `PUBLIC_PATHS` l'énumère, et
 * `tests/auth-routes.test.ts` échouerait si elle y entrait sans décision
 * écrite.
 *
 * ## Le secret voyage dans le corps, pas dans un en-tête
 *
 * C'est le mécanisme que lemlist documente : on passe un `secret` à la création
 * du webhook (`POST /api/hooks`), il est stocké chiffré, **jamais rendu par
 * `GET /hooks`**, immuable, et renvoyé dans le corps JSON de chaque appel. Il
 * n'y a pas de signature HMAC à vérifier : c'est un mot de passe partagé, et la
 * seule chose qui compte est de le comparer **à temps constant** — d'où
 * `constantTimeEqual`, la fonction du jalon 9, et non `===`.
 *
 * ## Un secret absent ferme la porte
 *
 * Sans `LEMLIST_WEBHOOK_SECRET` dans les variables du service, la route répond
 * 401 et n'écrit rien. C'est la posture du jalon 9 : remplacer un accès ouvert
 * par un accès conditionné à une variable qui, manquante, ouvre tout, serait le
 * même défaut avec une étape de plus.
 *
 * ## 200 sur une charge utile illisible, et c'est volontaire
 *
 * lemlist **désactive** un webhook dont le point d'arrivée répond 404 ou 410,
 * et le compte à la limite de 200 webhooks sans le purger. Répondre une erreur
 * sur une activité que nous ne savons pas lire risquerait donc de couper la
 * connexion entière pour un seul type exotique. On répond 200 en **comptant**
 * ce qu'on n'a pas su lire, et `/reglages` l'affiche. Le 401, lui, reste un
 * refus franc : une charge utile non authentifiée n'est pas une charge utile.
 */
function authorised(body: unknown): boolean {
  const secret = process.env.LEMLIST_WEBHOOK_SECRET;
  if (typeof secret !== "string" || secret.trim() === "") return false;
  if (typeof body !== "object" || body === null) return false;

  const presented = (body as Record<string, unknown>)["secret"];
  if (typeof presented !== "string" || presented === "") return false;

  return constantTimeEqual(presented, secret.trim());
}

function denied(): NextResponse {
  return NextResponse.json(
    { error: { message: "Secret de webhook absent ou invalide." } },
    { status: 401 },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    // Un corps qui n'est pas du JSON ne peut pas porter le secret : c'est un
    // refus d'authentification, pas une activité illisible.
    return denied();
  }

  if (!authorised(body)) return denied();

  try {
    /*
      lemlist poste **une** activité par appel. Un tableau est accepté tout de
      même : le même écrivain sert le relevé, qui en pose cent à la fois, et
      refuser la forme plurielle ici obligerait à écrire deux lectures de charge
      utile pour une seule règle.
    */
    const raws = Array.isArray(body) ? body : [body];
    const report = await applyWebhook(raws);
    return jsonOk(report);
  } catch (error) {
    return serverError("POST /api/lemlist/webhook", error);
  }
}
