/**
 * **Ce qui fait qu'un courriel a l'air écrit à la main.**
 *
 * C'est la partie qui trahit tout le reste si elle est fausse. Un message qui
 * arrive en un pavé compact se lit comme une génération automatique, et le
 * destinataire le traite comme telle — quelle que soit la qualité du texte.
 *
 * Le module est **pur** : il ne parle ni à SMTP ni à la base. Les règles de mise
 * en forme se vérifient donc sans réseau, ce qui compte parce qu'elles sont
 * exactement le genre de chose qu'on croit juste en lisant le code et qui se
 * révèle fausse à la réception.
 *
 * Trois pièges, et ce sont eux qui dictent le code ci-dessous :
 *
 * 1. **HTML avale les sauts de ligne.** Deux retours à la ligne dans la source
 *    ne produisent aucun espace dans un navigateur. D'où les `<p>` : c'est la
 *    seule façon d'obtenir une séparation de paragraphe qui survive à tous les
 *    clients, `<br><br>` étant rendu de façon inégale et supprimé par certains.
 * 2. **Le format « flowed » recolle les lignes.** Un client qui reçoit du
 *    `text/plain` sans précaution peut réunir deux lignes consécutives en une
 *    seule. `format=fixed` (voir `lib/api/mail.ts`) l'interdit.
 * 3. **Les fins de ligne d'un courriel sont des CRLF.** Une partie MIME en `\n`
 *    seul est hors spécification et se fait recoller par certains relais.
 */

/** Une ligne vide sépare deux paragraphes ; une simple fin de ligne les garde ensemble. */
const PARAGRAPH_BREAK = /\n[ \t]*\n/;

/**
 * Découpe le corps en paragraphes, chacun conservant ses fins de ligne internes.
 *
 * Les lignes vides multiples valent une seule séparation : quelqu'un qui a
 * frappé trois fois « entrée » voulait un paragraphe, pas trois blancs.
 */
export function splitParagraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(PARAGRAPH_BREAK)
    .map((block) => block.replace(/[ \t]+$/gm, "").trim())
    .filter((block) => block !== "");
}

/**
 * La partie `text/plain` : **le texte tel qu'il a été écrit**.
 *
 * On ne reformate rien — ni la casse, ni la ponctuation, ni la longueur des
 * lignes. La seule normalisation est celle des fins de ligne, imposée par le
 * format, et la réduction des blancs multiples à une seule ligne vide, qui rend
 * la version texte et la version HTML identiques à la lecture.
 */
export function toPlainText(body: string): string {
  return splitParagraphs(body).join("\n\n");
}

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ESCAPES[char] ?? char);
}

/**
 * La partie `text/html` : des paragraphes, et **rien d'autre**.
 *
 * Pas de feuille de style, pas de police, pas de couleur, pas de tableau de mise
 * en page, pas de pixel de suivi, pas d'image de signature. Tout cela se voit :
 * un message dont le HTML porte des styles ne ressemble pas à ce que produit un
 * client de messagerie quand on tape un texte.
 *
 * Les fins de ligne **à l'intérieur** d'un paragraphe deviennent des `<br>` :
 * c'est ce qui préserve une adresse postale ou une liste tapée à la main. Les
 * séparations de paragraphe, elles, restent des `<p>`.
 */
export function toHtml(body: string): string {
  const paragraphs = splitParagraphs(body).map(
    (block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`,
  );
  return `<html><body>${paragraphs.join("")}</body></html>`;
}

/**
 * Un sujet de courriel tient sur une ligne.
 *
 * Un retour à la ligne dans un en-tête n'est pas un détail d'affichage : c'est
 * une injection d'en-tête. Le couper ici plutôt que de faire confiance à la
 * bibliothèque, parce que le sujet vient d'un champ libre — et, depuis ce
 * jalon, d'un modèle de langage.
 */
export function sanitizeSubject(subject: string): string {
  return subject.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}

/**
 * Le corps est-il présentable ?
 *
 * Un corps vide ou blanc n'est pas un courriel : mieux vaut refuser que d'envoyer
 * un message vide à un prospect.
 */
export function hasBody(body: string): boolean {
  return splitParagraphs(body).length > 0;
}

/** Adresse d'expédition affichable : « Nom <adresse> », ou l'adresse seule. */
export function formatSender(name: string, address: string): string {
  const clean = name.replace(/[\r\n"]+/g, " ").trim();
  if (clean === "") return address;
  return `"${clean}" <${address}>`;
}

/**
 * Compte les paragraphes annoncés au panneau de rédaction.
 *
 * Affiché à côté du brouillon : c'est la seule façon de voir, avant d'envoyer,
 * que la mise en forme a bien été comprise comme on l'a tapée.
 */
export function paragraphCount(body: string): number {
  return splitParagraphs(body).length;
}
