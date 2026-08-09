/**
 * Plafonds de sortie du modèle — la part pure.
 *
 * Ces valeurs sont partagées par le runtime (serveur), la validation des
 * réglages et le formulaire (client). Elles vivent donc ici et non dans
 * `lib/agents/runtime/`, qui est marqué `server-only` : un composant client qui
 * l'importerait ferait échouer le build.
 */

/**
 * Plancher de sortie quand la réflexion est active.
 *
 * Sur Claude Opus 5 la réflexion partage le plafond avec le texte. En dessous
 * de ce plancher, le modèle n'a pas de quoi réfléchir *et* répondre : il se
 * fait couper, et la réponse tronquée échoue à l'analyse au lieu d'échouer
 * franchement. Un budget plus bas que ça n'économise pas, il gâche.
 */
export const MIN_OUTPUT_TOKENS = 2000;

/** Plafond haut, pour la conversation comme pour le réglage des vacations. */
export const MAX_OUTPUT_TOKENS = 32000;
