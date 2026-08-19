import { pollInbox } from "@/lib/api/inbox";
import { cronAuthorised, cronDenied } from "@/lib/api/cron-auth";
import { jsonOk, serverError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Une session IMAP et quelques centaines d'en-têtes : large, mais borné. */
export const maxDuration = 120;

/**
 * Le relevé de la boîte de réception, toutes les quinze minutes.
 *
 * **Sa propre route et son propre déclencheur**, séparés du passage quotidien.
 * Deux raisons, dans cet ordre : leurs cadences n'ont rien à voir — une fois
 * par jour contre quatre fois par heure — et surtout un relevé qui échoue ne
 * doit pas emporter la sauvegarde, ni l'inverse. Ce sont deux travaux
 * indépendants ; les coudre ensemble ferait dépendre le filet de sécurité d'une
 * connexion IMAP.
 *
 * Fermée par `CRON_SECRET`, comme les deux autres routes de cron : publique au
 * sens du middleware, privée par son propre secret, comparé à temps constant.
 */
export async function POST(request: Request) {
  if (!cronAuthorised(request)) return cronDenied();

  try {
    return jsonOk(await pollInbox());
  } catch (error) {
    return serverError("POST /api/cron/inbox", error);
  }
}
