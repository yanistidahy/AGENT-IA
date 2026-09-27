import "server-only";
import { tick } from "./auto-send";

/**
 * **La boucle qui tient la cadence, dans le processus du serveur.**
 *
 * GitHub Actions ne descend pas sous cinq minutes et arrive souvent en retard :
 * il ne peut pas porter un intervalle de 3 min 30. Une boucle en processus le
 * peut, au prix de trois choses dont il faut être explicite :
 *
 * 1. **elle meurt avec le processus.** C'est sans conséquence parce que
 *    l'échéance vit en base : le successeur reprend le créneau où il en était,
 *    sans envoyer deux fois (`claimSlot`) et sans repartir de zéro ;
 * 2. **deux instances la lancent toutes les deux.** Le verrou est la ligne, pas
 *    la boucle : `updateMany` conditionné sur `dueAt` n'est gagné que par une
 *    seule ;
 * 3. **elle n'est pas un planificateur de précision.** Elle bat toutes les
 *    `TICK_SECONDS`, donc un envoi part au plus tard une période après son
 *    échéance. C'est la précision réelle, elle est mesurée, et elle est dite
 *    dans le résumé du jalon plutôt que supposée.
 *
 * **Pourquoi elle ne démarre pas depuis `instrumentation.ts`.** C'était le
 * premier essai, et il ne compile pas : Next compile `instrumentation.ts` pour
 * le runtime Edge **aussi**, un garde sur `NEXT_RUNTIME` étant une condition
 * d'exécution et non de compilation. La chaîne `auto-send → departures →
 * email-send` y fait entrer `imapflow`, `nodemailer` et `sharp`, qui appellent
 * `stream`, `net` et `child_process` — absents du bundle Edge. Mesuré :
 * `serverExternalPackages` ne les en sort pas, il ne porte que sur le bundle
 * serveur.
 *
 * Elle est donc armée par `ensureAutoSendLoop()`, appelée par les modules
 * serveur qui tournent forcément en Node : la page « Départs du jour », la route
 * de réglage de l'envoi automatique, et le passage quotidien. Conséquence à
 * connaître, et elle est assumée : **la boucle démarre à la première requête
 * serveur qui suit un démarrage**, pas avant. En pratique c'est le geste même
 * d'armer l'interrupteur qui la lance, et le passage quotidien la relance
 * chaque matin si personne n'a rien ouvert.
 */

/** La période de battement. Cinq secondes : la précision annoncée. */
export const TICK_SECONDS = 5;

let running = false;

export function ensureAutoSendLoop(): void {
  // **Une seule boucle par processus.** Next peut évaluer `instrumentation` plus
  // d'une fois (rechargement à chaud en développement), et deux boucles
  // réclameraient le même créneau en doublant les tours pour rien.
  if (running) return;
  running = true;

  const beat = async (): Promise<void> => {
    try {
      const report = await tick();
      // Seuls les tours qui font quelque chose sont journalisés : une ligne
      // toutes les cinq secondes noierait le journal du service, et « rien à
      // faire » est le cas normal.
      if (report.sent || report.detail.startsWith("échec") || report.detail.startsWith("arrêt")) {
        console.info(`[envoi automatique] ${report.detail}`);
      }
    } catch (error) {
      // **Une boucle ne meurt pas d'un tour raté.** Une base momentanément
      // injoignable ne doit pas arrêter l'envoi automatique pour de bon : le
      // tour suivant retentera, et la panne reste visible dans le journal.
      console.error("[envoi automatique] tour en échec", error);
    }
  };

  const timer = setInterval(() => void beat(), TICK_SECONDS * 1000);
  // Le minuteur ne doit pas retenir le processus au moment de s'arrêter.
  timer.unref?.();
}
