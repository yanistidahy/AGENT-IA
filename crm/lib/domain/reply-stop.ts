/**
 * **Une réponse arrête les relances — et c'est ce module qui le décide.**
 *
 * Le jalon 38 posait la règle dans `nextStep` : `repliedAt !== null` arrête
 * l'inscription, et ce motif est terminal. Elle était juste, et la vérification
 * du jalon 106 a montré qu'elle pouvait être contournée par deux chemins que
 * personne ne regardait — non pas parce que la règle manquait, mais parce que
 * les **faits** qui l'alimentent étaient lus trop étroitement.
 *
 * Les deux défauts mesurés, avec leur nombre :
 *
 * 1. **La borne était exclusive sur une date à la seconde.** L'interaction
 *    « Répondu » est datée de l'en-tête `Date:` du message reçu, qui n'a pas de
 *    millisecondes ; nos propres horodatages en ont. Mesuré : envoi à
 *    `15:32:53.328`, réponse datée `15:32:53` — soit 328 ms **avant** l'envoi
 *    auquel elle répond. Un `date > lastSentAt` ne la voyait donc pas, et la
 *    relance est réellement partie à quelqu'un qui venait de répondre.
 *
 * 2. **Le fait relevé n'était lu par aucun chemin d'envoi.** `EmailReply` est la
 *    trace du relevé, clavetée sur le `Message-ID` de la réponse ; les quatre
 *    chemins re-déduisaient la réponse de `Activity.outcome`, qui n'en est qu'un
 *    reflet — et qui n'est pas écrit du tout quand la fiche n'est pas rattachée
 *    (jalon 45). Les deux sources sont désormais réunies.
 *
 * Et deux garde-fous d'état, qui n'existaient nulle part : une inscription
 * **arrêtée** et un départ **écarté** restaient envoyables par leur identifiant.
 * `readDepartures` ne les montre plus (jalons 91 et 96), donc personne ne
 * cliquait — mais « retiré de la file » doit vouloir dire « ne part pas », pas
 * « ne s'affiche plus ».
 *
 * Pur, sans Prisma : la règle se teste sans base, et les quatre chemins
 * l'appellent — une garde statique vérifie qu'ils ne cessent pas de le faire.
 */

/**
 * La borne basse d'une recherche de réponse, ramenée à la seconde.
 *
 * **Ce n'est pas une tolérance arbitraire, c'est la granularité de la source.**
 * Un en-tête `Date:` se compte en secondes (RFC 5322) ; `lastSentAt` se compte
 * en millisecondes. Tronquer la borne à la seconde et comparer avec `>=` compare
 * donc deux instants à la même précision, sans élargir d'une seconde de plus que
 * ce que le format impose. Reculer d'une minute « pour être sûr » ferait au
 * contraire compter comme réponse une interaction antérieure à l'envoi.
 */
export function replyFloor(since: Date | null): Date | null {
  if (since === null) return null;
  const floor = new Date(since.getTime());
  floor.setMilliseconds(0);
  return floor;
}

/**
 * La plus récente des réponses connues, les deux sources réunies.
 *
 * L'interaction consignée **et** la détection du relevé. Prendre la plus récente
 * plutôt que la première trouvée garde le sens de `repliedAt` dans `nextStep` :
 * « quand le contact a-t-il répondu pour la dernière fois ».
 */
export function latestReply(
  activityRepliedAt: Date | null,
  recordedReplyAt: Date | null,
): Date | null {
  if (activityRepliedAt === null) return recordedReplyAt;
  if (recordedReplyAt === null) return activityRepliedAt;
  return activityRepliedAt.getTime() >= recordedReplyAt.getTime()
    ? activityRepliedAt
    : recordedReplyAt;
}

/**
 * Les statuts d'inscription qui ne produisent ni n'envoient plus rien.
 *
 * `active` est le seul qui travaille. `done` a tout envoyé, `stopped` a été
 * arrêtée avec son motif — réponse reçue, fiche close, opposition —, `removed`
 * a été retirée à la main (jalon 70). Les trois derniers sont des décisions
 * déjà prises : les rejouer à l'envoi les annulerait en silence.
 */
export const SENDING_ENROLLMENT_STATUS = "active";

export function enrollmentBlocksSend(status: string): boolean {
  return status.trim() !== SENDING_ENROLLMENT_STATUS;
}

/**
 * Un départ qui n'est plus en file ne part plus.
 *
 * `pending` attend sa validation, `failed` porte un brouillon non composé qu'on
 * peut réécrire. `sent` est parti, `skipped` a été écarté — par le relevé, par
 * un retrait, ou par un motif terminal. Renvoyer un départ écarté par son
 * identifiant contournerait la décision qui l'a écarté.
 */
const SENDABLE_DEPARTURE_STATUSES: readonly string[] = ["pending", "failed"];

export function departureBlocksSend(status: string): boolean {
  return !SENDABLE_DEPARTURE_STATUSES.includes(status.trim());
}

/**
 * Le refus, écrit une fois.
 *
 * Il nomme l'état **et** le motif enregistré quand il y en a un : « ce départ ne
 * part pas » sans dire pourquoi se lit comme une panne, et c'est la leçon des
 * jalons 91 et 96.
 */
export function stateRefusal(
  enrollmentStatus: string,
  stopReason: string,
  departureStatus: string,
): string | null {
  if (departureBlocksSend(departureStatus)) {
    return `Ce départ a été retiré de la file (${departureStatus}) : il ne part plus. Recomposez-le depuis sa campagne si vous voulez l'envoyer.`;
  }
  if (enrollmentBlocksSend(enrollmentStatus)) {
    const why = stopReason.trim() === "" ? "" : ` : ${stopReason}`;
    return `Cette inscription n'est plus active${why}. Rien ne part tant qu'elle ne redémarre pas.`;
  }
  return null;
}
