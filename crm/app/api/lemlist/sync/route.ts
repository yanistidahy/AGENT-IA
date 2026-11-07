import { syncLemlist } from "@/lib/api/lemlist-sync";
import { jsonOk, serverError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Une reprise d'historique lit jusqu'à deux cents pages, espacées : large. */
export const maxDuration = 300;

/**
 * **« Synchroniser maintenant », le geste de l'écran.**
 *
 * Fermée par le verrou d'espace de travail, sans un mot de code ici : la route
 * n'est pas dans `PUBLIC_PATHS`, donc le middleware du jalon 9 la refuse sans
 * session. C'est la posture « tout est privé par défaut » — l'inverse, une
 * vérification écrite dans chaque route, laisse passer celle qu'on oubliera.
 *
 * Le passage de quinze minutes, lui, n'a pas de session : il appelle
 * `/api/cron/lemlist`, qui porte son propre secret. **Les deux routes
 * appellent le même `syncLemlist`** — deux façades, une règle, comme le script
 * et le bouton du jalon 12.
 */
export async function POST() {
  try {
    const outcome = await syncLemlist();
    /*
      200 même sur un échec métier. L'écran affiche `status` et `message` ; un
      500 ferait croire à une panne de l'application là où c'est la clé, ou
      lemlist, qui est en cause — et le panneau afficherait « erreur serveur »
      au lieu de « clé absente », c'est-à-dire la phrase qui dit quoi faire.
    */
    return jsonOk(outcome);
  } catch (error) {
    return serverError("POST /api/lemlist/sync", error);
  }
}
