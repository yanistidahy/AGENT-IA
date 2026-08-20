/**
 * Reconnaître un `Message-ID` que nous avons fabriqué.
 *
 * **Pourquoi cette distinction mérite un module.** Le jalon 43 rendait le même
 * verdict — « aucun de ces identifiants n'est des nôtres » — pour deux
 * situations qui n'ont rien à voir :
 *
 * 1. le message répond à un fil que nous n'avons pas ouvert. C'est normal,
 *    c'est même le cas le plus fréquent d'une boîte de réception ;
 * 2. le message cite **un identifiant de notre domaine, à la forme de notre
 *    générateur**, qui n'est pourtant pas dans `email_sends`. Ce n'est plus une
 *    lecture de boîte, c'est une panne : le fil est correct et c'est notre
 *    table qui ment.
 *
 * C'est exactement le second cas qui a caché la cause du jalon 44 pendant trois
 * relevés. Le formuler distinctement est la moitié du correctif.
 *
 * Module pur : aucune base, aucun réseau — la forme d'un identifiant se teste
 * sans rien.
 */

/** La forme rendue par `messageId()` : `<horodatage.aléa@domaine>`. */
const OURS = /^<(\d{10,})\.([A-Za-z0-9]+)@([^<>@\s]+)>$/;

/** Le domaine d'un identifiant, en minuscules. Vide si l'identifiant est mal formé. */
export function idDomain(id: string): string {
  const at = id.lastIndexOf("@");
  if (at === -1) return "";
  return id
    .slice(at + 1)
    .replace(/>$/, "")
    .trim()
    .toLowerCase();
}

/**
 * Cet identifiant porte-t-il la marque de notre générateur ?
 *
 * Deux conditions, et les deux comptent : la **forme** (horodatage, point,
 * aléa alphanumérique) et le **domaine** d'expédition. La forme seule serait
 * trop permissive — d'autres générateurs produisent des identifiants
 * numériques ; le domaine seul le serait aussi, puisqu'un prospect peut fort
 * bien écrire depuis notre domaine si nous nous écrivons à nous-mêmes.
 */
export function looksOurs(id: string, sendingDomain: string): boolean {
  const domain = sendingDomain.trim().toLowerCase();
  if (domain === "") return false;
  const match = OURS.exec(id.trim());
  return match !== null && (match[3] ?? "").toLowerCase() === domain;
}

export type CitedIdVerdict =
  /** Cité, et présent dans `email_sends` — c'est une réponse. */
  | { readonly kind: "known" }
  /**
   * Notre domaine, notre forme, **absent de la base**.
   *
   * Le fil est correct et la table est fausse : identifiant jamais enregistré,
   * écrasé, ou perdu. Un rattrapage depuis « Envoyés » est la réponse.
   */
  | { readonly kind: "ours-missing" }
  /** Un fil que nous n'avons pas ouvert. Rien à signaler. */
  | { readonly kind: "foreign" };

export function judgeCitedId(
  id: string,
  knownSentIds: ReadonlySet<string>,
  sendingDomain: string,
): CitedIdVerdict {
  if (knownSentIds.has(id)) return { kind: "known" };
  if (looksOurs(id, sendingDomain)) return { kind: "ours-missing" };
  return { kind: "foreign" };
}

/**
 * Le verdict d'ensemble sur les identifiants cités par un message.
 *
 * **Un seul identifiant des nôtres suffit à basculer le diagnostic.** Une
 * réponse cite souvent tout le fil dans `References` : y trouver un identifiant
 * de notre domaine absent de la base est un fait, même noyé parmi dix
 * identifiants étrangers.
 */
export function anyOursMissing(
  cited: readonly string[],
  knownSentIds: ReadonlySet<string>,
  sendingDomain: string,
): boolean {
  return cited.some(
    (id) => judgeCitedId(id, knownSentIds, sendingDomain).kind === "ours-missing",
  );
}
