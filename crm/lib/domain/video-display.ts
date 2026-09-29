/**
 * **Comment la vidéo se montre dans un courriel : un lien, ou une vignette.**
 *
 * Le défaut signalé : en prospection froide, une grande vignette se lit comme
 * une lettre d'information. Elle est souvent cachée derrière « afficher les
 * images » — la plupart des clients ne les chargent pas par défaut (jalon 37) —
 * et l'image que nous servons n'est même pas une trame du film : aucun
 * extracteur n'étant installé, elle est **engendrée** (jalon 89). On paie donc
 * le signal visuel d'un publipostage pour montrer une plaque noire.
 *
 * ### Le défaut est le lien texte, et c'est une décision
 *
 * Un premier message d'une personne à une autre ne porte pas d'image. Le lien
 * texte se rend partout, ne dépend d'aucun chargement d'image, et ressemble à ce
 * qu'un humain écrirait. La vignette reste disponible : elle a du sens sur une
 * relance à quelqu'un qui a déjà répondu, ou dans une campagne assumée comme
 * une communication. Ce qui change, c'est lequel des deux on obtient sans rien
 * régler.
 *
 * ### Un seul réglage, lu par une seule fonction
 *
 * `videoHtml` est le **seul** endroit du produit où la vidéo devient du
 * balisage : l'aperçu, l'envoi manuel, l'envoi automatique et la
 * resynchronisation à l'enregistrement en dépendent tous, donc aucun des quatre
 * ne peut afficher autre chose que ce qui partira. Une garde statique interdit
 * un second rendu.
 *
 * ### Ce que le mode ne touche pas
 *
 * **La destination du clic ne change pas**, dans aucun des deux modes : c'est
 * l'adresse résolue par `videoDestination` — notre route `/api/video` quand le
 * fichier est chez nous, l'adresse collée sinon — et le mode d'affichage n'y
 * ajoute ni paramètre, ni redirection. La partie `text/plain` ne bouge pas non
 * plus : elle a toujours porté « libellé : adresse entière », et c'est déjà la
 * bonne forme pour un client texte.
 */

/** Les deux façons de montrer la vidéo. */
export type VideoDisplay = "link" | "thumbnail";

/**
 * **Le lien texte par défaut**, pour une installation neuve comme pour la ligne
 * de réglages déjà en base : la colonne porte ce défaut, donc personne n'a à
 * cliquer pour que la prospection cesse de ressembler à une lettre
 * d'information.
 */
export const DEFAULT_VIDEO_DISPLAY: VideoDisplay = "link";

/** Ce que l'écran affiche pour chaque mode, et ce que l'aperçu répète. */
export const VIDEO_DISPLAY_LABELS: Record<VideoDisplay, string> = {
  link: "Lien texte",
  thumbnail: "Vignette",
};

/** Ce que chaque mode fait au message, dit du point de vue du destinataire. */
export const VIDEO_DISPLAY_NOTES: Record<VideoDisplay, string> = {
  link:
    "Un lien cliquable dans le texte, comme n'importe quel lien du message. " +
    "Rien à charger, donc rien à débloquer : c'est la forme qui ressemble le " +
    "moins à une lettre d'information.",
  thumbnail:
    "Une image cliquable de la largeur du message. Souvent masquée derrière " +
    "« afficher les images », et la vignette engendrée n'est pas une trame du " +
    "film : à réserver aux destinataires qui vous connaissent déjà.",
};

/**
 * La frontière `string` → union, comme les `z.enum()` de `schemas.ts`.
 *
 * Une valeur inconnue retombe sur le lien texte plutôt que de lever : une faute
 * de frappe dans un réglage ne doit pas devenir une panne d'envoi, et le repli
 * le moins risqué est celui qui n'envoie pas d'image.
 */
export function toVideoDisplay(raw: string): VideoDisplay {
  return raw === "thumbnail" ? "thumbnail" : DEFAULT_VIDEO_DISPLAY;
}
