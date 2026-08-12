import type { Prisma } from "@prisma/client";

/**
 * Ce qui compte comme une vraie interaction, en un seul endroit.
 *
 * **Une note de correction n'est pas une prise de contact.** Les corrections de
 * données (`applyStatusFix`, `applyLifecycleFix`) consignent une interaction par
 * fiche pour expliquer ce qu'elles ont écrit — c'est ce qui rend l'historique
 * lisible six mois plus tard, et il n'est pas question de les supprimer.
 *
 * Mais toute mesure d'activité doit les exclure, sans quoi la correction qui
 * écrit « Jamais contacté » se réfute elle-même à la seconde où elle l'écrit :
 * elle crée une interaction, `activityCount` passe à 1, et
 * `followUpStatus()` cesse de répondre « never ». Mesuré : 66 fiches portant
 * « Jamais contacté » en base, 2 renvoyées par la puce du même nom ; 134 fiches
 * sur 154 n'ayant **que** des notes de correction.
 *
 * Le jalon 22 avait établi cette exclusion pour les rapports de prospection,
 * avec une constante locale à `lib/api/prospecting.ts`. Elle vit ici désormais,
 * et les deux façades la partagent — une règle écrite deux fois est une règle
 * qui divergera.
 */

/** Propriétaire des interactions écrites par les corrections de données. */
export const CORRECTION_OWNER = "Correction";

/**
 * Fragment Prisma à poser sur toute lecture d'`activities` qui sert à *mesurer*
 * l'activité. Les lectures qui servent à **afficher** l'historique ne le posent
 * pas : la chronologie d'une fiche doit montrer les corrections, c'est même
 * leur raison d'être.
 */
export const REAL_ACTIVITY: Prisma.ActivityWhereInput = {
  NOT: { owner: CORRECTION_OWNER },
};
