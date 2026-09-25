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

import type { VideoLink } from "./signature-video";

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
export function toPlainText(body: string, link?: DemoLink, video?: VideoLink): string {
  // Deux développements, dans l'ordre où ils ont été écrits, et chacun sur une
  // seule occurrence : le lien de démonstration puis la vidéo. Les faire dans
  // l'autre sens ne changerait rien — les deux libellés sont distincts — mais
  // les écrire l'un après l'autre garde une seule règle de rendu par lien.
  const withDemo = expandLink(splitParagraphs(body).join("\n\n"), link);
  return expandLink(withDemo, video === undefined ? undefined : { label: video.label, url: video.url });
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

/**
 * Le dernier paragraphe du corps HTML, avec ce qu'il y a autour.
 *
 * C'est la signature : la règle du jalon 33 l'impose en fin de message, et
 * `signsWithName()` l'y cherche. Le repérer ici évite de retransmettre le texte
 * de la signature à une fonction qui a déjà le HTML sous la main — deux
 * sources pour une même chose, et elles finiraient par diverger.
 */
function lastParagraph(
  html: string,
): { readonly before: string; readonly inner: string; readonly after: string } | null {
  const open = html.lastIndexOf("<p>");
  if (open === -1) return null;
  const close = html.indexOf("</p>", open);
  if (close === -1) return null;
  return {
    before: html.slice(0, open),
    inner: html.slice(open + 3, close),
    after: html.slice(close + 4),
  };
}

/**
 * Pose le logo de signature à la fin de la partie HTML.
 *
 * **Hors de `toHtml()`, pour la même raison que le pixel de suivi.** La règle
 * du jalon 32 porte sur la mise en forme du corps : ce que le modèle écrit et
 * ce qu'on relit à l'écran restent du texte, sans une seule image. Le logo est
 * une décision d'envoi, prise à l'envoi, et le test de mise en forme continue
 * de refuser toute image dans `toHtml()`.
 *
 * Il prend **le dernier paragraphe** — la signature texte — et le place à
 * droite du logo, dans un tableau à deux colonnes. La version `text/plain`
 * n'en porte évidemment aucune trace : elle n'a pas de mise en page, et ses
 * quatre lignes ne bougent pas.
 *
 * **Un `<table>`, et non flex ou grid.** C'est une contrainte du support, pas
 * un goût : Outlook rend le HTML par le moteur de Word, qui ignore
 * `display:flex` et `display:grid` — la mise en page retomberait en pile, donc
 * exactement ce qu'on cherche à éviter, et seulement chez une partie des
 * destinataires. Un tableau à deux cellules est le seul assemblage que tous
 * les clients rendent de la même façon.
 *
 * Il ne doit **jamais se lire comme un tableau** : ni bordure, ni fond, ni
 * quadrillage, et `role="presentation"` pour qu'un lecteur d'écran l'annonce
 * comme une mise en page et non comme des données. `border-collapse:collapse`
 * ferme le dernier interstice qu'un client pourrait dessiner de lui-même.
 *
 * Aucun lien autour, aucun paramètre dans l'adresse : c'est une identité, pas
 * un appel à l'action, et un logo cliquable pisté est précisément ce qui
 * distingue un message commercial d'un message écrit par quelqu'un.
 */
export function withSignatureLogo(html: string, logo?: SignatureLogo): string {
  if (logo === undefined) return html;
  const src = logo.url.trim();
  if (src === "") return html;

  // `width` en attribut plutôt qu'en style : un client qui ignore le CSS — et
  // il y en a — doit quand même réserver la bonne place, sinon la signature
  // saute au chargement de l'image. `display:block` supprime le blanc que les
  // navigateurs réservent sous une image en ligne, et qui décalerait le
  // centrage vertical d'un ou deux pixels.
  const size = logo.width > 0 ? ` width="${logo.width}"` : "";
  const img =
    `<img src="${escapeHtml(src)}" alt="Aura Flow AI"${size}` +
    ` style="display:block;border:0" />`;

  // La cellule du logo porte sa largeur rendue, en attribut **et** en style :
  // sans elle, un client répartirait l'espace lui-même et la colonne de texte
  // se collerait au logo ou s'en éloignerait selon la longueur des lignes.
  const cellWidth = logo.width > 0 ? ` width="${logo.width}"` : "";
  const widthStyle = logo.width > 0 ? `width:${logo.width}px;` : "";

  const signature = lastParagraph(html);
  if (signature === null) {
    // Corps sans paragraphe : il n'y a rien à poser à droite. On garde le logo
    // seul plutôt que de rendre un tableau à une colonne, qui serait une mise
    // en page sans mise en page.
    return html.replace("</body>", `<p>${img}</p></body>`);
  }

  const table =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"` +
    ` style="border-collapse:collapse;border:0;margin-top:12px">` +
    `<tr>` +
    `<td${cellWidth} valign="middle" style="${widthStyle}padding:0;border:0">${img}</td>` +
    `<td valign="middle" style="padding:0 0 0 12px;border:0">${signature.inner}</td>` +
    `</tr></table>`;

  return `${signature.before}${table}${signature.after}`;
}

/**
 * Remplace le libellé de la vidéo par une **vignette cliquable**.
 *
 * **Hors de `toHtml()`, pour la troisième fois et la même raison** que le pixel
 * de suivi (jalon 37) et le logo de signature (jalon 62) : la règle du jalon 32
 * interdit toute image dans la mise en forme du corps, et le test qui la
 * vérifie continue de porter sur `toHtml()`. Une vignette est une décision
 * d'envoi, prise à l'envoi.
 *
 * **La vidéo n'est jamais attachée.** Une pièce jointe vidéo est l'un des
 * signaux de spam les plus forts, beaucoup de serveurs la mettent en
 * quarantaine, et IONOS applique sa propre limite de taille par message. Ce qui
 * part est donc une image de quelques dizaines de kilo-octets et un lien.
 *
 * **Le triangle de lecture est déjà dans les pixels** de la vignette, incrusté
 * au téléversement : une surcouche positionnée par-dessus une image est ignorée
 * par la moitié des clients de messagerie, comme `display:flex` ne survit pas
 * au moteur de Word (leçon du tableau de signature, jalon 65). Il n'y a donc ni
 * `position:absolute`, ni second élément par-dessus l'image.
 *
 * L'ancre ne porte **aucun paramètre** : ni jeton, ni compteur, ni `utm_`. Un
 * clic pisté sur une démonstration qu'on présente comme privée dit exactement
 * le contraire de ce que le message affirme (jalon 34).
 *
 * Une seule occurrence, comme `linkify` : le libellé peut revenir dans une
 * phrase, et transformer chaque mention en vignette produirait un message
 * truffé d'images.
 */
export function withVideoThumbnail(html: string, video?: VideoLink): string {
  if (video === undefined) return html;
  const label = video.label.trim();
  const url = video.url.trim();
  const poster = video.posterUrl.trim();
  if (label === "" || url === "" || poster === "") return html;

  const needle = escapeHtmlText(label);
  const index = html.indexOf(needle);
  if (index === -1) return html;

  // `width` en attribut **et** en style : un client qui ignore le CSS doit
  // quand même réserver la bonne place, sinon la mise en page saute au
  // chargement. `alt` porte le libellé, parce qu'une image non chargée doit
  // rester un lien qu'on comprend — c'est le cas le plus fréquent, la plupart
  // des clients ne chargeant pas les images par défaut.
  const size = video.posterWidth > 0 ? ` width="${video.posterWidth}"` : "";
  const img =
    `<img src="${escapeHtmlText(poster)}" alt="${needle}"${size}` +
    ` style="display:block;border:0;max-width:100%" />`;

  return (
    html.slice(0, index) +
    `<a href="${escapeHtmlText(url)}">${img}</a>` +
    html.slice(index + needle.length)
  );
}

/** Le logo servi : son adresse chez nous, et sa largeur normalisée. */
export interface SignatureLogo {
  readonly url: string;
  readonly width: number;
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
/**
 * Cette ligne est-elle un paraphe au nom de quelqu'un ?
 *
 * Extraite de `signsWithName` parce que `enforceSignature` a besoin de la
 * **position** de la première ligne signée, pas seulement de savoir qu'il y en a
 * une : c'est à partir de là que commence le bloc à remplacer.
 */
function lineSignsWith(raw: string, forbidden: readonly string[]): boolean {
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
}

export function signsWithName(body: string, forbidden: readonly string[]): boolean {
  // **Le dernier paragraphe entier, pas seulement la dernière ligne.** Depuis
  // que les signatures font deux lignes — « Yanis Tidahy » puis « Fondateur,
  // Aura Flow AI » — la dernière ligne est le *titre* : ne regarder qu'elle
  // rendait la garde aveugle au nom, donc incapable de repérer un message signé
  // du mauvais collègue.
  const blocks = splitParagraphs(body);
  const last = blocks[blocks.length - 1] ?? "";

  return last.split("\n").some((raw) => lineSignsWith(raw, forbidden));
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
 * 2. le dernier paragraphe porte un paraphe → **tout ce qui suit la formule de
 *    politesse est remplacé** par la signature ;
 * 3. il n'y a pas de signature → elle est **ajoutée** en dernier paragraphe.
 *
 * ## Le défaut du jalon 67, et pourquoi le cas 2 a changé
 *
 * Cette fonction ne remplaçait que la **dernière ligne** du paragraphe. Tant
 * que le modèle écrivait « Bien à vous, » puis un seul nom, c'était juste. Mais
 * depuis que la signature fait plusieurs lignes, le modèle écrit souvent la
 * formule **et le bloc entier** dans le même paragraphe : seule la dernière
 * ligne était alors remplacée, et le message partait avec la signature deux
 * fois de suite. C'est exactement le doublon signalé en production, à la ligne
 * près.
 *
 * On coupe donc **à la première ligne qui porte un nom**, ce qui garde la
 * formule de politesse et jette tout le bloc, quelle que soit sa longueur et
 * quelle que soit la forme qu'il avait.
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

  const signed = lines.findIndex((line) => lineSignsWith(line, forbidden));
  if (signed !== -1) {
    // Ce qui précède le paraphe est la formule de politesse : elle reste. Tout
    // ce qui suit est une signature, quelle que soit sa longueur : elle part.
    const greeting = lines.slice(0, signed).filter((line) => line.trim() !== "");

    // La signature part dans **son propre paragraphe**, même quand le modèle
    // l'avait collée à la formule. C'est la forme que tout le reste attend :
    // la cellule droite du tableau HTML (jalon 65) est le dernier paragraphe,
    // et y laisser « À bientôt » ferait porter la formule de politesse au
    // logo. Le texte, lui, gagne une ligne vide et se lit pareil.
    blocks[blocks.length - 1] = greeting.length === 0 ? signature : greeting.join("\n");
    if (greeting.length > 0) blocks.push(signature);
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
 *
 * **La signature peut vivre au bas d'un paragraphe, pas seulement seule dans le
 * sien.** Le modèle écrit souvent « À bientôt » puis le bloc sans ligne vide
 * entre les deux : une comparaison de paragraphes entiers n'y trouve rien et
 * ajoute une seconde signature en dessous. C'est le doublon du jalon 67, vu
 * cette fois au changement de signataire. On accepte donc aussi une
 * correspondance **en fin de paragraphe** — elle reste ancrée sur un bloc
 * connu, donc un post-scriptum n'est toujours pas coupé.
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
  /** Le bloc se termine-t-il par cette signature, précédée d'une fin de ligne ? */
  const trailing = (block: string, candidate: string): boolean =>
    block.length > candidate.length &&
    block.endsWith(candidate) &&
    block[block.length - candidate.length - 1] === "\n";

  for (let index = blocks.length - 1; index >= 0; index -= 1) {
    const block = (blocks[index] ?? "").trim();
    if (block === target || trailing(block, target)) return blocks.join("\n\n");

    const match = known
      .map((candidate) => candidate.trim())
      .find(
        (candidate) =>
          candidate !== "" && (block === candidate || trailing(block, candidate)),
      );

    if (match !== undefined) {
      if (block === match) {
        blocks[index] = target;
        return blocks.join("\n\n");
      }

      /*
        **On retire *toutes* les signatures qui se suivent, pas seulement la
        dernière.** Un brouillon composé avant le correctif du jalon 67 porte le
        bloc deux fois de suite : n'en enlever qu'un laisserait l'autre, et
        rebasculer le signataire ne nettoierait la fiche qu'à moitié. La boucle
        est bornée par le texte lui-même — elle s'arrête dès qu'une fin de
        paragraphe n'est plus une signature connue.
      */
      let head = block.slice(0, block.length - match.length);
      for (;;) {
        const trimmed = head.replace(/\n+$/, "");
        const again = known
          .map((candidate) => candidate.trim())
          .find((candidate) => candidate !== "" && trailing(trimmed, candidate));
        if (again === undefined) break;
        head = trimmed.slice(0, trimmed.length - again.length);
      }

      blocks[index] = `${head.replace(/\n+$/, "")}\n${target}`;
      return blocks.join("\n\n");
    }
  }

  blocks.push(target);
  return blocks.join("\n\n");
}
