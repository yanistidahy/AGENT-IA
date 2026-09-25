/**
 * **La vidéo de démonstration : hébergée, jamais attachée.**
 *
 * La demande était explicite et elle a raison : une vidéo en pièce jointe est
 * l'un des signaux de spam les plus forts qui soient, beaucoup de serveurs la
 * mettent en quarantaine sans un mot, et IONOS applique de toute façon sa
 * propre limite de taille par message — qu'un fichier de motion design dépasse
 * presque toujours. Ce module ne sait donc composer qu'une chose : **un lien et
 * une vignette**.
 *
 * ## Les deux moitiés, et pourquoi elles ne se traitent pas pareil
 *
 * | | D'où ça vient | Où ça pointe |
 * |---|---|---|
 * | **la vignette** | toujours de nous, réencodée comme le logo | `/api/video/<version>` |
 * | **la destination** | le fichier téléversé, ou une adresse collée | notre domaine, ou l'hébergeur |
 *
 * L'image est **toujours** la nôtre, pour les raisons du jalon 62 : une image
 * chargée depuis un hébergeur tiers est un signal de démarchage en masse, et
 * elle confie à ce tiers la liste des gens qui ouvrent nos messages. Elle ne
 * porte donc ni paramètre, ni jeton, ni compteur — **ce n'est pas un pixel de
 * suivi déguisé**, et la route qui la sert ne compte rien.
 *
 * La destination du clic, elle, ne peut pas mentir : coller un lien YouTube
 * veut dire que le clic va chez YouTube. Faire passer ce clic par une
 * redirection de notre domaine serait précisément le pistage qu'on s'interdit,
 * en plus de masquer où l'on va. L'écran le dit donc en toutes lettres plutôt
 * que de le taire, et téléverser le fichier reste la voie qui garde tout chez
 * nous.
 *
 * ## Le triangle de lecture est **dans les pixels**
 *
 * Une surcouche CSS positionnée par-dessus une image est ignorée par la moitié
 * des clients de messagerie — c'est la leçon du tableau de signature du
 * jalon 65, où `display:flex` ne survit pas au moteur de Word. Ce qui doit se
 * voir doit être incrusté ; le badge est donc composité dans la vignette au
 * moment du téléversement, une fois, et jamais rendu par le message.
 *
 * Pur, comme tout `lib/domain/` : les adresses, les verdicts et le rendu se
 * vérifient sans base ni réseau.
 */

/**
 * Largeur servie, en pixels.
 *
 * 480 px pour un affichage autour de 240 : la vignette reste nette sur un
 * écran à double densité sans peser comme une image de page. Comme pour le
 * logo, l'image est **réencodée** à cette largeur plutôt que seulement
 * contrainte par un attribut — un client qui ignore `width` afficherait sinon
 * l'original en pleine page.
 */
export const VIDEO_POSTER_WIDTH = 480;

/** Le rapport de la vignette : le format d'une vidéo, et rien d'autre. */
export const VIDEO_POSTER_HEIGHT = Math.round((VIDEO_POSTER_WIDTH * 9) / 16);

/**
 * Poids au-delà duquel on avertit, en octets.
 *
 * Plus haut que les 20 Ko du logo, et c'est délibéré : une vignette est une
 * image photographique, pas un aplat de marque, et la comparer au même seuil
 * ferait sonner l'alerte sur chaque vidéo légitime — l'erreur que le jalon 62
 * a explicitement refusé de commettre. 120 Ko est ce qu'un JPEG de 480 px
 * coûte quand il est mal compressé ; en dessous, il n'y a rien à dire.
 */
export const POSTER_WARN_BYTES = 120 * 1024;

/** 200 Mo à l'entrée pour un fichier vidéo. Au-delà, l'héberger ailleurs. */
export const MAX_VIDEO_UPLOAD = 200 * 1024 * 1024;

export const VIDEO_KINDS = ["hosted", "file"] as const;
export type VideoKind = (typeof VIDEO_KINDS)[number];

export function toVideoKind(raw: string): VideoKind {
  return raw === "file" ? "file" : "hosted";
}

/** L'adresse publique de la vignette, ou `""` si l'une des moitiés manque. */
export function posterUrl(baseUrl: string, version: string): string {
  return join(baseUrl, version, "");
}

/** L'adresse publique du fichier vidéo, quand c'est nous qui l'hébergeons. */
export function videoFileUrl(baseUrl: string, version: string): string {
  return join(baseUrl, version, "/fichier");
}

function join(baseUrl: string, version: string, suffix: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const token = version.trim();
  if (base === "" || token === "") return "";
  return `${base}/api/video/${token}${suffix}`;
}

export interface VideoTarget {
  readonly kind: VideoKind;
  /** L'adresse collée, quand `kind = hosted`. */
  readonly url: string;
  readonly version: string;
}

/**
 * Où mène le clic, résolu une fois.
 *
 * **Une adresse vide n'est jamais remplacée par une devinette** : sans
 * destination, il n'y a pas de lien, et `{video}` retire sa phrase comme
 * `{site}` retire la sienne (jalon 87). Un lien mort dans un message de
 * prospection coûte plus que la phrase qu'il portait.
 */
export function videoDestination(target: VideoTarget, baseUrl: string): string {
  if (target.kind === "file") return videoFileUrl(baseUrl, target.version);
  const url = target.url.trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

/**
 * Le clic reste-t-il chez nous ?
 *
 * Rendu dans les réglages, à côté du choix — c'est là que la décision se prend,
 * et c'est la seule différence entre les deux voies qui ait une conséquence
 * pour le destinataire.
 */
export function staysOnOurDomain(kind: VideoKind): boolean {
  return kind === "file";
}

export interface PosterWeightVerdict {
  readonly heavy: boolean;
  readonly reasons: readonly string[];
}

/**
 * La vignette reste-t-elle une vignette ?
 *
 * **On avertit, on ne refuse pas** — même posture qu'au jalon 62 : le poids
 * acceptable dépend d'un jugement qui n'appartient pas au code, mais il ne part
 * plus en silence.
 */
export function posterWeight(posterBytes: number): PosterWeightVerdict {
  if (posterBytes <= POSTER_WARN_BYTES) return { heavy: false, reasons: [] };
  const ko = Math.round(posterBytes / 1024);
  return {
    heavy: true,
    reasons: [
      `La vignette pèse ${ko} Ko, au-delà des ${Math.round(POSTER_WARN_BYTES / 1024)} Ko ` +
        "qu'une image de message devrait coûter. Une image moins détaillée, ou " +
        "sans dégradé, retombera à quelques dizaines de kilo-octets.",
    ],
  };
}

export interface VideoLink {
  /** Le libellé cliquable, et ce que `{video}` écrit dans le gabarit. */
  readonly label: string;
  /** La destination du clic — déjà résolue par `videoDestination`. */
  readonly url: string;
  /** L'adresse de la vignette, sur notre domaine. */
  readonly posterUrl: string;
  readonly posterWidth: number;
}

/**
 * Le lien est-il complet ?
 *
 * Les trois morceaux — libellé, destination, vignette — sont solidaires : sans
 * vignette on n'a qu'un lien nu, sans destination on n'a qu'une image inerte.
 * Plutôt que d'en rendre la moitié, on ne rend rien et la phrase disparaît.
 */
export function isUsableVideo(link: VideoLink | undefined): link is VideoLink {
  return (
    link !== undefined &&
    link.label.trim() !== "" &&
    link.url.trim() !== "" &&
    link.posterUrl.trim() !== ""
  );
}
