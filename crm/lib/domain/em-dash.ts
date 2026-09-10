/**
 * **Aucun tiret cadratin dans un brouillon.**
 *
 * Le tiret long est devenu un marqueur reconnaissable de texte engendré, et nos
 * destinataires lisent beaucoup de démarchage. Un prospect qui repère le
 * marqueur cesse de lire le message et commence à juger l'expéditeur.
 *
 * ## Une garantie, pas une consigne
 *
 * La règle est écrite dans le prompt **et** appliquée au retour, exactement
 * comme la signature depuis le jalon 33 : une consigne de prompt est une
 * intention, elle tient presque toujours, et « presque » ne suffit pas quand la
 * conséquence part chez un vrai prospect sous le nom d'une vraie personne.
 *
 * ## Ce qui remplace quoi
 *
 * Le tiret long sert de ponctuation faible : une virgule le remplace sans
 * changer le sens. En tête de ligne il sert de puce, et c'est alors un tiret
 * ordinaire qu'il faut. Le trait d'union (`-`) **n'est pas concerné** :
 * « e-commerce » et « dites-le-moi » s'écrivent ainsi en français, et les
 * confondre abîmerait l'orthographe pour rien.
 */

/** Les deux caractères visés : cadratin (—) et demi-cadratin (–). */
const DASHES = /[—–]/;

export function hasDash(text: string): boolean {
  return DASHES.test(text);
}

/**
 * Retire les tirets longs d'un texte, en gardant une ponctuation lisible.
 *
 * En tête de ligne, le tiret est une puce : il devient un tiret ordinaire.
 * Ailleurs, il ponctue : il devient une virgule, et l'on recolle les espaces
 * pour ne pas laisser « , , » ou « mot , mot » derrière soi.
 */
export function stripDashes(text: string): string {
  return (
    text
      // Puce en tête de ligne : un tiret ordinaire fait le même travail.
      .replace(/^[ \t]*[—–][ \t]+/gm, "- ")
      // Ponctuation : le tiret long et ses espaces deviennent une virgule.
      .replace(/\s*[—–]\s*/g, ", ")
      // Deux ponctuations qui se suivent, produites par le remplacement.
      .replace(/([,;:])\s*,\s*/g, "$1 ")
      .replace(/\s+,/g, ",")
      .replace(/,\s*([.!?])/g, "$1")
      // Une virgule en fin de ligne ne ponctue plus rien.
      .replace(/,\s*$/gm, "")
  );
}
