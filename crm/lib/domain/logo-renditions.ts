/**
 * Un logo, deux rendus — et la question de savoir s'il se lit sur le rail.
 *
 * ## Pourquoi deux rendus plutôt qu'un
 *
 * Le rendu de la signature est contraint par la **délivrabilité** : 120 px,
 * palettisé, quelques kilo-octets, parce qu'il part dans chaque message et
 * qu'un filtre juge le rapport texte/image (jalon 62). Rien de tout cela ne
 * s'applique au rail du CRM, qui est servi à des gens déjà connectés, sur notre
 * propre domaine, une fois par session et mis en cache pour un an.
 *
 * Étirer le rendu de courriel à la taille du rail donnerait une image molle :
 * 120 px affichés à 34 px de large tiennent, mais le même fichier sur un écran
 * à deux fois la densité montre ses marches. D'où un second rendu, **issu du
 * même téléversement** — on ne demande jamais deux fois le même fichier.
 *
 * L'inverse compte autant : un rendu unique assez net pour le rail serait trop
 * lourd pour la signature, et le plafond de 20 Ko sonnerait sur un logo
 * parfaitement légitime. Les deux contraintes sont réelles et incompatibles ;
 * c'est ce qui justifie deux fichiers plutôt qu'un compromis qui trahit les
 * deux.
 */

/** Largeur du rendu servi à l'interface. */
export const CHROME_WIDTH = 256;

/**
 * Le fond du rail (`--color-rail`), sur lequel le logo doit se détacher.
 *
 * Écrit ici parce que c'est une **mesure**, pas un style : la valeur sert à
 * calculer un contraste, et la lire dans une feuille CSS au moment du
 * téléversement serait un aller-retour pour une constante de marque.
 */
export const RAIL_BACKGROUND = "#0B1030";

/**
 * Contraste minimal accepté entre le logo et le fond du rail.
 *
 * 3:1 est le seuil AA pour les éléments graphiques non textuels (WCAG 1.4.11) —
 * un logo n'est pas du texte à lire, c'est une forme à reconnaître. Exiger 4.5
 * rejetterait des marques parfaitement lisibles.
 */
export const MIN_DARK_CONTRAST = 3;

/** Luminance relative WCAG d'une composante sRGB 0-255. */
function channel(value: number): number {
  const c = Math.min(Math.max(value, 0), 255) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: number, b: number): number {
  const [light, dark] = a >= b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

export interface LogoInkSample {
  /** Moyennes sRGB des pixels **visibles** du logo (alpha non nul). */
  readonly r: number;
  readonly g: number;
  readonly b: number;
  /** Part de pixels entièrement transparents, de 0 à 1. */
  readonly transparency: number;
}

export interface DarkVerdict {
  /** Le logo se détache-t-il du rail sans aide ? */
  readonly readable: boolean;
  /**
   * Faut-il le poser sur une plaque claire ?
   *
   * Vrai **seulement** quand le logo est à la fois transparent et trop sombre :
   * un logo au fond opaque porte déjà le sien, lui en ajouter un second
   * dessinerait un cadre autour d'un cadre.
   */
  readonly plate: boolean;
  /** Le contraste mesuré, arrondi au dixième. */
  readonly contrast: number;
  /** Ce qu'on a constaté, en une phrase, pour l'écran de réglages. */
  readonly message: string;
}

/**
 * Le logo se lit-il sur le rail sombre ?
 *
 * **Mesuré, jamais supposé.** La question se pose pour de bon : un logo à fond
 * transparent et à encre foncée — le cas le plus courant d'un logo dessiné pour
 * du papier blanc — disparaît sur un bleu nuit, et personne ne s'en aperçoit
 * avant de voir l'écran. Plutôt que de deviner à la place de l'utilisateur, on
 * échantillonne l'image au téléversement et on **dit ce qu'on a trouvé**.
 *
 * La réponse n'est pas un refus : un logo illisible reste un logo légitime, et
 * la réponse juste est une plaque claire derrière lui, pas un rejet. Ce qui
 * serait fautif, c'est de le poser tel quel et de laisser l'écran mentir.
 */
export function readsOnDark(sample: LogoInkSample): DarkVerdict {
  const ink = relativeLuminance(sample.r, sample.g, sample.b);
  const rail = relativeLuminance(0x0b, 0x10, 0x30);
  const contrast = Math.round(contrastRatio(ink, rail) * 10) / 10;

  // Un fond opaque se suffit à lui-même : ce qu'on voit sur le rail, c'est le
  // fond du logo, et sa lisibilité interne ne regarde pas le rail.
  const transparent = sample.transparency > 0.2;
  if (!transparent) {
    return {
      readable: true,
      plate: false,
      contrast,
      message:
        "Ce logo porte son propre fond : il se pose tel quel sur le rail, " +
        "qui ne transparaît pas au travers.",
    };
  }

  if (contrast >= MIN_DARK_CONTRAST) {
    return {
      readable: true,
      plate: false,
      contrast,
      message:
        `Fond transparent, contraste de ${contrast}:1 sur le bleu du rail : ` +
        "le logo s'y détache, le rail passe au travers comme prévu.",
    };
  }

  return {
    readable: false,
    plate: true,
    contrast,
    message:
      `Fond transparent, mais contraste de seulement ${contrast}:1 sur le bleu ` +
      `du rail (il en faut ${MIN_DARK_CONTRAST}) : ce logo est trop sombre pour ` +
      "s'y détacher. Il est donc posé sur une plaque claire dans le rail et la " +
      "favicon. Pour qu'il pose à même le bleu, il faut une version claire du " +
      "logo. La signature des courriels, elle, est sur fond blanc et n'est pas " +
      "concernée.",
  };
}

/** L'adresse du rendu d'interface. `""` quand il n'y a pas de version. */
export function chromeUrl(version: string): string {
  const token = version.trim();
  return token === "" ? "" : `/api/logo/${token}/app`;
}
