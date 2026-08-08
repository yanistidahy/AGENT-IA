import { NextResponse } from "next/server";
import { readDbStatus } from "@/lib/db-status";
import { healthPayload, healthStatusCode } from "@/lib/health-payload";

export const dynamic = "force-dynamic";

/**
 * Sonde de santé, destinée au healthcheck Railway.
 *
 * Contrairement à `/`, elle **échoue** quand la base ne répond pas : c'est tout
 * son intérêt comme cible de healthcheck.
 *
 * **Route publique, donc muette.** C'est la seule surface de l'application
 * accessible sans session — le healthcheck Railway l'interroge sans cookie. Elle
 * ne renvoie donc qu'un état : plus aucun compteur, aucun nom de table, aucune
 * information de déploiement. Publier le nombre de contacts n'est pas anodin,
 * c'est déjà renseigner un tiers sur la taille du portefeuille et, en le suivant
 * dans le temps, sur l'activité.
 *
 * Les compteurs détaillés existent toujours, mais derrière le verrou, sur `/`.
 *
 * La forme exacte du corps est décidée par `lib/health-payload.ts`, et testée
 * là-bas : ce qui sort d'une route publique doit être vérifiable autrement que
 * par une relecture.
 */
export async function GET() {
  const payload = healthPayload(await readDbStatus(), new Date());

  return NextResponse.json(payload, {
    status: healthStatusCode(payload),
    headers: { "Cache-Control": "no-store" },
  });
}
