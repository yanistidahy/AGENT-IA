/**
 * **Notre propre site, une seule fois, et son libellé dérivé.**
 *
 * Le défaut signalé : « auraflowai.fr » partait en texte brut, et seuls certains
 * clients de messagerie en font un lien cliquable. Le destinataire devait donc
 * sélectionner l'adresse et la recopier — ce que personne ne fait dans un
 * premier message.
 *
 * ### Une source, deux rendus
 *
 * L'URL est réglée une fois dans `/reglages`. **Le libellé visible n'est pas un
 * second champ** : il est dérivé de l'adresse, scheme et barre finale retirés.
 * Deux champs finiraient par se contredire — le jour où l'on change de domaine,
 * le message afficherait « auraflowai.fr » en pointant ailleurs, et c'est
 * exactement ce qu'un lecteur attentif lit comme une usurpation (jalon 62).
 *
 * ### Ce que la balise substitue, et pourquoi c'est l'URL
 *
 * `{notresite}` rend **l'adresse entière**, pas le libellé. C'est l'écart avec
 * `{video}` et le lien de démonstration (jalon 34), qui substituent un libellé
 * que la couche d'envoi développe ensuite des deux côtés. Ici :
 *
 * | Partie | Ce qui part | Qui le produit |
 * |---|---|---|
 * | `text/plain` | `https://auraflowai.fr/` | **la substitution seule**, rien à développer |
 * | `text/html` | `<a href="https://auraflowai.fr/">auraflowai.fr</a>` | l'ancre posée à l'envoi, sur l'adresse rendue |
 *
 * Substituer l'URL plutôt qu'un libellé rend la partie texte juste **sans aucun
 * développement** : c'est une règle de rendu en moins, donc une divergence de
 * moins entre les deux parties.
 *
 * ### Lien direct, et rien d'autre
 *
 * Ni redirection par notre domaine, ni paramètre, ni compteur de clics : c'est
 * la posture du lien de la vidéo (jalon 89), et elle vaut d'autant plus ici —
 * mesurer les clics sur notre propre site depuis un courriel demanderait un
 * jeton par destinataire, c'est-à-dire précisément le pistage que le produit
 * s'interdit. L'adresse qui part est celle qui est réglée, au caractère près.
 */

/** L'adresse par défaut, celle du site public d'Aura Flow AI. */
export const DEFAULT_OUR_SITE_URL = "https://auraflowai.fr/";

export interface OurSiteLink {
  /** L'adresse, telle qu'elle est réglée et telle qu'elle partira. */
  readonly url: string;
  /** Le texte visible dans l'ancre : `auraflowai.fr`. Dérivé de l'URL. */
  readonly label: string;
}

/**
 * Le libellé visible d'une adresse : scheme et barre finale retirés.
 *
 * Rien de plus n'est retiré, et c'est volontaire : `www.` fait partie du domaine
 * que quelqu'un a choisi d'afficher, et un chemin (`auraflowai.fr/demo`) décrit
 * bien où le lien mène. Un libellé qui cacherait une partie de l'adresse serait
 * un lien qui ne dit pas où il va.
 */
export function ourSiteLabel(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

/**
 * L'adresse réglée, prête à être rendue, ou `null`.
 *
 * `null` veut dire « aucune adresse exploitable », et la phrase qui portait la
 * balise disparaît alors entièrement — la règle de `{site}` et de `{video}`
 * depuis les jalons 87 et 89 : un lien mort dans un premier contact coûte plus
 * que la phrase qu'il portait.
 *
 * **Seuls `http` et `https` sont acceptés.** Une adresse `javascript:` rendue
 * cliquable dans un courriel est une invitation qu'on ne peut pas retirer après
 * coup ; la liste est donc fermée, jamais un test sur l'absence de deux-points.
 */
export function ourSiteLink(raw: string): OurSiteLink | null {
  const url = raw.trim();
  if (url === "") return null;
  if (!/^https?:\/\//i.test(url)) return null;

  const label = ourSiteLabel(url);
  // Une adresse réduite à son scheme (« https:// ») ne désigne rien : le libellé
  // serait vide, et l'ancre n'aurait aucun texte sur lequel cliquer.
  if (label === "") return null;

  return { url, label };
}

/**
 * Le texte rendu, découpé autour de la première occurrence de notre adresse.
 *
 * Sert **l'aperçu** : l'écran doit montrer un lien cliquable, comme le
 * destinataire le verra. Le découpage vit ici, et non dans le composant, pour
 * que le libellé affiché et l'adresse visée viennent de `ourSiteLink` des deux
 * côtés : un aperçu qui fabriquerait son propre libellé pourrait montrer autre
 * chose que ce qui part. La substitution, elle, reste l'affaire de
 * `renderTemplate` : ici rien n'est remplacé, seulement découpé.
 *
 * Une seule occurrence est découpée, comme `withOurSiteLink` n'en pose qu'une.
 */
export function splitOurSiteLink(
  text: string,
  site: OurSiteLink | null,
): { readonly before: string; readonly link: OurSiteLink | null; readonly after: string } {
  if (site === null) return { before: text, link: null, after: "" };
  const index = text.indexOf(site.url);
  if (index === -1) return { before: text, link: null, after: "" };
  return {
    before: text.slice(0, index),
    link: site,
    after: text.slice(index + site.url.length),
  };
}
