/**
 * Ce qu'un chargement de pixel vaut, avant de le compter.
 *
 * **Jusqu'au jalon 43, chaque requête sur `/api/t/<jeton>` incrémentait
 * `openCount`.** Un client qui charge l'image cinq fois — défilement, retour
 * sur le message, deux fenêtres ouvertes — produisait « 5 ouvertures », et un
 * antivirus qui récupère les images à la livraison produisait une ouverture
 * pour un message que personne n'avait vu.
 *
 * Deux écarts sont donc retirés du compte, sans être effacés : ils rejoignent
 * `openNoise` et une ligne `EmailOpenHit`, pour qu'on puisse mesurer le bruit
 * plutôt que le supposer.
 *
 * | Verdict | Règle | Pourquoi |
 * |---|---|---|
 * | `delivery` | moins de {@link DELIVERY_WINDOW_SECONDS} s après l'envoi | personne n'ouvre un message dans les trente secondes qui suivent son départ ; c'est un relais, un antivirus ou notre propre copie |
 * | `burst` | moins de {@link BURST_WINDOW_SECONDS} s après le chargement précédent | un même client qui recharge l'image n'est pas une seconde lecture |
 * | `counted` | le reste | la seule chose qu'on affiche |
 *
 * **Les seuils sont larges à dessein.** Une fenêtre de rafale trop longue
 * effacerait une relecture réelle une heure plus tard ; trop courte, elle
 * laisserait passer le rechargement d'un client lent. Une minute écarte le
 * rechargement mécanique sans prétendre distinguer deux lectures rapprochées.
 *
 * Rien ici ne regarde l'adresse IP ni l'agent utilisateur : ils ne sont pas
 * stockés, et la promesse du jalon 37 tient jusque dans la déduplication.
 */

/** En deçà, le chargement suit l'envoi de trop près pour être une lecture. */
export const DELIVERY_WINDOW_SECONDS = 30;

/** En deçà du chargement précédent, c'est le même client qui recharge. */
export const BURST_WINDOW_SECONDS = 60;

export type OpenHitKind = "counted" | "burst" | "delivery";

export interface OpenHitInput {
  readonly sentAt: Date;
  /** Dernier chargement connu, tous verdicts confondus. `null` si c'est le premier. */
  readonly lastHitAt: Date | null;
  readonly now: Date;
}

export interface OpenHitVerdict {
  readonly kind: OpenHitKind;
  /** Secondes écoulées depuis l'envoi, jamais négatives. */
  readonly delaySeconds: number;
}

function seconds(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 1000);
}

export function classifyOpenHit(input: OpenHitInput): OpenHitVerdict {
  const delaySeconds = Math.max(0, seconds(input.sentAt, input.now));

  // **La livraison passe avant la rafale.** Un message dont le pixel est chargé
  // deux fois à la livraison produirait sinon un `delivery` puis un `burst`,
  // deux libellés pour un seul phénomène.
  if (delaySeconds < DELIVERY_WINDOW_SECONDS) return { kind: "delivery", delaySeconds };

  if (input.lastHitAt !== null) {
    const sinceLast = seconds(input.lastHitAt, input.now);
    if (sinceLast >= 0 && sinceLast < BURST_WINDOW_SECONDS) {
      return { kind: "burst", delaySeconds };
    }
  }

  return { kind: "counted", delaySeconds };
}

/** Ce que le verdict change en base : un compteur, jamais les deux. */
export function countsAsOpen(kind: OpenHitKind): boolean {
  return kind === "counted";
}

export interface OpenNoiseShare {
  readonly counted: number;
  readonly noise: number;
  /** Part de bruit sur l'ensemble des chargements, `null` s'il n'y en a aucun. */
  readonly noiseRate: number | null;
}

/**
 * La part de bruit, pour l'afficher plutôt que la deviner.
 *
 * `null` sur zéro chargement : « 0 % de bruit » affirmerait une mesure propre
 * là où il n'y a rien à mesurer — même règle que les taux de l'entonnoir.
 */
export function noiseShare(counted: number, noise: number): OpenNoiseShare {
  const total = counted + noise;
  return { counted, noise, noiseRate: total === 0 ? null : noise / total };
}
