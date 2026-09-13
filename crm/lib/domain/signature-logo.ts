/**
 * Le logo de la signature — ce qui se décide sans réseau et sans base.
 *
 * Trois choses vivent ici : la forme normalisée du logo servi, l'adresse à
 * laquelle il est servi, et le **verdict de poids**, qui dit si la signature
 * reste une signature ou si le message est en train de devenir une image.
 *
 * ## Un seul logo, partagé par toutes les boîtes
 *
 * C'est la marque de l'entreprise, pas celle d'une personne. Deux collègues qui
 * signeraient de deux logos différents se liraient comme deux sociétés, et le
 * jour où la marque change il faudrait penser à le remplacer autant de fois
 * qu'il y a de boîtes. Ce qui varie légitimement d'un signataire à l'autre —
 * nom, titre, téléphone, adresse — est déjà porté par la boîte.
 *
 * ## Servi depuis notre domaine, jamais depuis un hébergeur tiers
 *
 * Une image de signature chargée depuis un hébergeur d'images est un signal de
 * démarchage en masse pour n'importe quel filtre, et elle confie à un tiers la
 * liste des gens qui ouvrent nos messages. L'adresse est donc la nôtre
 * (`publicBaseUrl()`, jalon 37), et **sans adresse publique connue, il n'y a
 * pas de logo** : une URL devinée produirait une image cassée dans chaque
 * message, ce qui est pire que pas de logo du tout.
 */

/**
 * Largeur servie, en pixels.
 *
 * 120 px : assez pour être net sur un écran ordinaire, assez petit pour rester
 * une signature. L'image est réencodée à cette largeur, elle n'est pas
 * seulement contrainte par un attribut — un client qui ignore `width`
 * afficherait sinon l'original en pleine page.
 */
export const LOGO_WIDTH = 120;

/**
 * Poids au-delà duquel on avertit, en octets.
 *
 * **Ce seuil est absolu, et c'est un choix.** La tentation était de comparer
 * les octets du logo à ceux du texte — « l'image ne doit pas peser plus que le
 * message ». Mesuré : un PNG de 120 px pèse 2 à 6 Ko, un corps d'email en pèse
 * 1 à 1,5. La règle aurait donc sonné sur **tous** les messages légitimes, et
 * une alerte qui sonne toujours est une alerte qu'on apprend à ignorer. Ce qui
 * compte vraiment est ailleurs : qu'un logo de signature reste petit dans
 * l'absolu, et qu'il y ait assez de texte pour porter le message.
 */
export const LOGO_WARN_BYTES = 20 * 1024;

/**
 * Longueur de corps en deçà de laquelle un message est « surtout une image ».
 *
 * Un message de trois lignes avec un logo est exactement ce que les filtres
 * appellent image-heavy : la proportion se juge sur ce que le destinataire a à
 * lire, pas sur des octets. 400 caractères valent environ un paragraphe et
 * demi, et nos messages en font quatre.
 */
export const MIN_BODY_CHARS = 400;

export interface LogoWeightInput {
  /** Poids du logo servi. `0` = aucun logo posé. */
  readonly logoBytes: number;
  /** Longueur du corps, signature comprise, en caractères. */
  readonly bodyChars: number;
}

export interface LogoWeightVerdict {
  readonly heavy: boolean;
  /** Ce qui cloche, nommé et chiffré. Vide quand tout va bien. */
  readonly reasons: readonly string[];
}

/**
 * La signature reste-t-elle une signature ?
 *
 * Rendue à l'écran de réglages au moment du téléversement, là où la décision se
 * prend. **On avertit, on ne refuse pas** : le poids acceptable dépend d'un
 * jugement de marque qui n'appartient pas au code.
 */
export function logoWeight(input: LogoWeightInput): LogoWeightVerdict {
  if (input.logoBytes <= 0) return { heavy: false, reasons: [] };

  const reasons: string[] = [];

  if (input.logoBytes > LOGO_WARN_BYTES) {
    const ko = Math.round(input.logoBytes / 1024);
    reasons.push(
      `Le logo pèse ${ko} Ko, au-delà des ${Math.round(LOGO_WARN_BYTES / 1024)} Ko ` +
        "qu'une signature devrait coûter. Un fichier plus simple, moins de couleurs, " +
        "et il retombera à quelques kilo-octets.",
    );
  }

  if (input.bodyChars > 0 && input.bodyChars < MIN_BODY_CHARS) {
    reasons.push(
      `Le corps ne fait que ${input.bodyChars} caractères : à cette longueur, le ` +
        "message est surtout une image aux yeux d'un filtre. Écrivez plus, ou retirez " +
        "le logo de ce message.",
    );
  }

  return { heavy: reasons.length > 0, reasons };
}

/** L'adresse publique du logo, ou `""` si l'une des deux moitiés manque. */
export function logoUrl(baseUrl: string, version: string): string {
  const base = baseUrl.trim().replace(/\/+$/, "");
  const token = version.trim();
  if (base === "" || token === "") return "";
  return `${base}/api/logo/${token}`;
}
