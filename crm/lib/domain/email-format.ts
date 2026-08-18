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
export function toPlainText(body: string, link?: DemoLink): string {
  return expandLink(splitParagraphs(body).join("\n\n"), link);
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
export function toHtml(body: string, link?: DemoLink): string {
  // `done` porte sur **tout le message**, pas sur un paragraphe : la version
  // texte ne développe elle aussi que la première occurrence, et deux rendus qui
  // ne posent pas le lien au même endroit se contrediraient selon le client.
  let done = false;

  const paragraphs = splitParagraphs(body).map((block) => {
    const escaped = escapeHtml(block);
    const linked = done ? escaped : linkify(escaped, link);
    if (linked !== escaped) done = true;
    return `<p>${linked.replace(/\n/g, "<br>")}</p>`;
  });

  return `<html><body>${paragraphs.join("")}</body></html>`;
}

/**
 * Insère le pixel de suivi d'ouverture dans la partie HTML.
 *
 * **Séparé de `toHtml()`, et ce n'est pas un détail d'organisation.** La règle
 * du jalon 32 — « aucune image, aucun pixel de suivi » — porte sur la mise en
 * forme du corps, et elle tient toujours : un message sans suivi est
 * *exactement* le message qu'un humain aurait tapé. Le pixel est une décision
 * d'envoi, prise à l'envoi, révocable à l'envoi, et le test de mise en forme
 * continue de refuser toute image dans `toHtml()`.
 *
 * Il est posé juste avant `</body>` : un client qui tronque un message long
 * coupe par la fin, donc un pixel en tête serait chargé même sur un message
 * jamais déroulé — ce qui gonflerait encore un chiffre déjà surestimé.
 */
export function withTrackingPixel(html: string, url: string): string {
  const src = url.trim();
  if (src === "") return html;

  // `alt=""` et `display:none` : ce n'est pas une image à décrire, et un
  // lecteur d'écran n'a rien à en dire. `width`/`height` en attributs, parce
  // qu'un client qui ignore le style doit quand même ne rien afficher de
  // visible.
  const pixel = `<img src="${escapeHtml(src)}" width="1" height="1" alt="" style="display:none;border:0" />`;
  return html.replace("</body>", `${pixel}</body>`);
}

/** Le lien de démonstration, tel qu'il est réglé. `url` vide = pas de lien. */
export interface DemoLink {
  readonly label: string;
  readonly url: string;
}

/**
 * Le libellé du lien devient une **vraie ancre**, et rien de plus.
 *
 * Ni bouton, ni style, ni paramètre de suivi : un lien maquillé en bouton dans
 * un premier contact se voit, et un `?utm_` ajouté à une adresse qu'on présente
 * comme une démonstration privée dit exactement le contraire de ce que le
 * message affirme.
 *
 * Le remplacement porte sur le libellé **échappé**, donc après `escapeHtml()` :
 * on injecte du balisage dans un texte déjà neutralisé, jamais l'inverse.
 */
function linkify(escaped: string, link?: DemoLink): string {
  if (link === undefined) return escaped;
  const label = link.label.trim();
  const url = link.url.trim();
  if (label === "" || url === "") return escaped;

  const needle = escapeHtmlText(label);
  const index = escaped.indexOf(needle);
  if (index === -1) return escaped;

  // Une seule occurrence : le libellé peut apparaître ailleurs dans une phrase,
  // et transformer chaque mention en lien produirait un message truffé d'ancres.
  return (
    escaped.slice(0, index) +
    `<a href="${escapeHtmlText(url)}">${needle}</a>` +
    escaped.slice(index + needle.length)
  );
}

function escapeHtmlText(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ESCAPES[char] ?? char);
}

/**
 * En texte brut, **l'adresse doit être visible** : un client texte ne sait pas
 * rendre un lien, et « → Diagnostic offert » seul ne mène nulle part. On écrit
 * donc « Diagnostic offert : https://… », qui reste lisible dans les deux
 * versions et cliquable dans la plupart des clients texte.
 */
function expandLink(text: string, link?: DemoLink): string {
  if (link === undefined) return text;
  const label = link.label.trim();
  const url = link.url.trim();
  if (label === "" || url === "") return text;

  const index = text.indexOf(label);
  if (index === -1) return text;
  return `${text.slice(0, index)}${label} : ${url}${text.slice(index + label.length)}`;
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

/** La dernière ligne non vide du corps — celle qui porte la signature. */
export function lastLine(body: string): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = (lines[index] ?? "").trim();
    if (line !== "") return line;
  }
  return "";
}

/**
 * Le corps se termine-t-il par le nom d'une personne qui ne doit pas signer ?
 *
 * La comparaison porte sur la **dernière ligne**, et seulement si elle est
 * courte : « Alex » signe, « je transmets à Alex dès demain » est une phrase.
 * Sans ce garde-fou de longueur, une mention légitime dans le texte serait
 * prise pour une signature et remplacée.
 */
export function signsWithName(body: string, forbidden: readonly string[]): boolean {
  // **Le dernier paragraphe entier, pas seulement la dernière ligne.** Depuis
  // que les signatures font deux lignes — « Yanis Tidahy » puis « Fondateur,
  // Aura Flow AI » — la dernière ligne est le *titre* : ne regarder qu'elle
  // rendait la garde aveugle au nom, donc incapable de repérer un message signé
  // du mauvais collègue.
  const blocks = splitParagraphs(body);
  const last = blocks[blocks.length - 1] ?? "";

  return last.split("\n").some((raw) => {
    const line = raw.trim();
    // Une ligne longue est une phrase, pas un paraphe : « je transmets à Alex
    // dès demain matin » ne doit pas être pris pour une signature.
    if (line === "" || line.length > 40) return false;

    const normalized = line.toLowerCase().replace(/[.,;!·—-]+$/g, "").trim();
    return forbidden.some((name) => {
      const needle = name.toLowerCase().trim();
      if (needle === "") return false;
      return (
        normalized === needle ||
        normalized.startsWith(`${needle} `) ||
        normalized.endsWith(` ${needle}`)
      );
    });
  });
}

/**
 * Impose la signature, quoi qu'ait rendu le modèle.
 *
 * **Le prompt le demande, le code le garantit.** Une consigne de prompt est une
 * intention ; elle tient presque toujours, et « presque » n'est pas assez quand
 * la conséquence est qu'un prospect découvre le nom d'un agent dans un message
 * censé venir d'un humain. Trois cas :
 *
 * 1. la signature est déjà là → on ne touche à rien ;
 * 2. la dernière ligne est un nom d'agent → elle est **remplacée** ;
 * 3. il n'y a pas de signature → elle est **ajoutée** en dernier paragraphe.
 */
export function enforceSignature(
  body: string,
  signature: string,
  forbidden: readonly string[],
): string {
  const blocks = splitParagraphs(body);
  if (blocks.length === 0) return signature;

  const last = blocks[blocks.length - 1] ?? "";
  if (last.trim() === signature) return blocks.join("\n\n");

  // Le dernier paragraphe est-il une signature à remplacer ? Soit il porte un
  // nom interdit, soit c'est une ligne courte isolée juste après une formule de
  // politesse — « Bien à vous, » puis « Alex ».
  const lines = last.split("\n");
  const tail = (lines[lines.length - 1] ?? "").trim();

  if (signsWithName(last, forbidden)) {
    if (lines.length > 1) {
      lines[lines.length - 1] = signature;
      blocks[blocks.length - 1] = lines.join("\n");
      return blocks.join("\n\n");
    }
    blocks[blocks.length - 1] = signature;
    return blocks.join("\n\n");
  }

  if (tail === signature) return blocks.join("\n\n");

  blocks.push(signature);
  return blocks.join("\n\n");
}

/**
 * Remplace le bloc de signature, **et rien d'autre**.
 *
 * Changer de signataire ne doit pas régénérer le message : le texte a pu être
 * relu, retouché, discuté avec Alex. Seules les dernières lignes bougent.
 *
 * La recherche se fait sur les signatures **connues** plutôt que sur « les deux
 * dernières lignes » : un message qui se termine par une question suivie d'un
 * post-scriptum n'a pas de signature à cet endroit, et couper à l'aveugle
 * mutilerait le texte. Si aucune signature connue n'est trouvée, la nouvelle est
 * simplement ajoutée — même règle que `enforceSignature()`.
 */
export function replaceSignature(
  body: string,
  known: readonly string[],
  next: string,
): string {
  const blocks = splitParagraphs(body);
  if (blocks.length === 0) return next;

  const target = next.trim();

  // Du dernier paragraphe vers le premier : une signature est en fin de message,
  // et remonter évite de confondre avec une mention plus haut dans le texte.
  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = (blocks[index] ?? "").trim();
    if (block === target) return blocks.join("\n\n");

    const match = known.find((candidate) => candidate.trim() !== "" && block === candidate.trim());
    if (match !== undefined) {
      blocks[index] = target;
      return blocks.join("\n\n");
    }
  }

  blocks.push(target);
  return blocks.join("\n\n");
}
