import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * **« Le processus répond. »** Rien d'autre, et c'est tout l'objet du fichier.
 *
 * C'est la cible du healthcheck Railway, et la seule chose qu'un healthcheck de
 * déploiement doit décider : le conteneur a-t-il démarré et sert-il du HTTP ?
 *
 * ## Ce qu'elle ne fait pas, et pourquoi chaque refus compte
 *
 * - **Elle ne touche pas la base.** Un healthcheck qui interroge PostgreSQL
 *   refuse le déploiement quand la base est momentanément indisponible — or le
 *   conteneur vient d'exécuter `prisma migrate deploy`, c'est précisément
 *   l'instant où une base peut ne pas encore répondre. On refuserait alors de
 *   mettre en ligne un binaire parfaitement sain, et l'ancien continuerait de
 *   servir sans que rien ne dise pourquoi. C'est ce que `/api/health` fait
 *   délibérément — et c'est pour cela qu'elle n'est pas la cible.
 * - **Elle ne lit aucune variable d'environnement.** Ni `WORKSPACE_PASSWORD`,
 *   ni les variables de sauvegarde, ni celles de la messagerie. Une
 *   configuration optionnelle absente ne doit pas pouvoir empêcher un
 *   déploiement : elle se signale dans l'application, pas en refusant de la
 *   mettre en ligne.
 * - **Elle n'importe rien de `lib/`.** Un import est un chemin par lequel une
 *   dépendance revient : il suffirait qu'un module de la chaîne lise un réglage
 *   au chargement pour que cette route redevienne fragile sans qu'on l'ait
 *   voulu. `tests/healthcheck-contract.test.ts` interdit cet import.
 *
 * ## Ce qu'elle ne divulgue pas
 *
 * Publique par nécessité — le healthcheck ne présente aucun cookie — donc
 * **muette**, au même titre que `/api/health` depuis le jalon 9 : ni compteur,
 * ni commit, ni nom de service. Un mot d'état, et l'instant. L'identité du
 * déploiement se lit derrière le verrou, sur `/api/version`.
 */
export function GET() {
  return NextResponse.json(
    { status: "live", at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
