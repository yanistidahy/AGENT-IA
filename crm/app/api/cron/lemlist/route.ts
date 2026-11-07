import { syncLemlist } from "@/lib/api/lemlist-sync";
import { cronAuthorised, cronDenied } from "@/lib/api/cron-auth";
import { jsonOk, serverError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Une reprise d'historique lit jusqu'à deux cents pages, espacées : large. */
export const maxDuration = 300;

/**
 * **Le rattrapage du webhook, toutes les quinze minutes.**
 *
 * Le webhook est le chemin rapide ; celui-ci est le chemin **sûr**. lemlist
 * désactive un webhook dont le point d'arrivée a répondu 404 ou 410 — un
 * redéploiement malheureux suffit —, le garde dans la liste avec
 * `disabled: true` et ne le rallume pas. Sans relevé, la synchronisation
 * s'arrêterait alors sans que rien ne le dise. Avec lui, elle reprend au
 * passage suivant, et `/reglages` montre la date du dernier succès.
 *
 * **Greffé sur le workflow du relevé de la boîte**, pas sur un nouveau : les
 * deux travaux ont la même cadence et la même nature — aller chercher dehors ce
 * qui s'est passé. Deux workflows à quinze minutes seraient deux crons à
 * surveiller pour un seul rythme.
 *
 * Publique au sens du middleware, fermée par `CRON_SECRET` comparé à temps
 * constant, 401 et non une redirection — un planificateur enregistrerait un 302
 * comme un succès.
 */
export async function POST(request: Request) {
  if (!cronAuthorised(request)) return cronDenied();

  try {
    return jsonOk(await syncLemlist());
  } catch (error) {
    return serverError("POST /api/cron/lemlist", error);
  }
}
