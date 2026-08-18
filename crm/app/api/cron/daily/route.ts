import { runAllShifts } from "@/lib/agents/shifts/run";
import { takeSnapshot } from "@/lib/api/snapshots";
import { cronAuthorised, cronDenied } from "@/lib/api/cron-auth";
import { purgeOpens } from "@/lib/api/email-sends";
import { composeDepartures } from "@/lib/api/departures";
import { prisma } from "@/lib/db";
import { jsonOk, serverError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Le passage quotidien : sauvegarde puis vacations.
 *
 * **La sauvegarde passe en premier, et l'ordre est le sujet.** Elle capture
 * l'état d'avant tout ce que la journée pourra écrire, et surtout elle a lieu
 * même si les vacations échouent — l'inverse ferait dépendre le filet de
 * sécurité du bon fonctionnement d'un appel à un modèle.
 *
 * Un échec de sauvegarde n'empêche pas les vacations, et réciproquement : ce
 * sont deux travaux indépendants qui partagent un déclencheur, pas une chaîne.
 * Chacun journalise le sien.
 */
export async function POST(request: Request) {
  if (!cronAuthorised(request)) return cronDenied();

  try {
    const snapshot = await takeSnapshot();

    // **La purge des ouvertures est une obligation, pas une commodité** : une
    // donnée de comportement gardée au-delà de sa durée de conservation est un
    // manquement, et l'oublier ne se voit sur aucun écran. Elle passe donc dans
    // le passage quotidien, juste après la sauvegarde, et avant tout appel à un
    // modèle qui pourrait échouer.
    const purged = await purgeOpens();

    // **La file du matin se compose ici, et nulle part ailleurs.** C'est ce qui
    // garantit qu'elle décrit l'état du jour : un brouillon écrit la veille au
    // soir ignorerait une réponse arrivée dans la nuit — ou pendant le week-end,
    // qui est précisément le cas qui mord.
    const departures = await composeDepartures();

    const runs = await runAllShifts(false);

    // Le battement de cœur est écrit **en dernier et seulement en cas de
    // succès** : c'est son absence qui doit alerter. L'écrire d'entrée ferait
    // d'un passage à moitié échoué un passage réussi, et le bandeau se tairait
    // exactement quand il devrait parler.
    await prisma.settings.upsert({
      where: { id: "singleton" },
      update: { lastCronAt: new Date() },
      create: { id: "singleton", lastCronAt: new Date() },
    });

    return jsonOk({ snapshot, purged, departures, runs });
  } catch (error) {
    return serverError("POST /api/cron/daily", error);
  }
}
