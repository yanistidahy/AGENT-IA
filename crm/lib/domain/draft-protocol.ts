/**
 * **Comment Alex rend un brouillon révisé au milieu d'une conversation.**
 *
 * Le panneau de rédaction n'est plus un formulaire mais un fil : on peut lui
 * demander de réécrire, mais aussi « qu'est-ce qu'on sait d'elle ? » ou
 * « pourquoi tu as écrit ça ? ». Une même réponse doit donc pouvoir contenir
 * **du texte pour l'utilisateur** et, parfois seulement, **un nouveau brouillon
 * pour les champs**.
 *
 * D'où un marqueur. Trois options ont été pesées :
 *
 * 1. **un outil d'écriture** — refusé : les outils s'exécutent côté serveur et
 *    passent par la carte de confirmation. Un brouillon n'existe qu'à l'écran,
 *    il n'y a rien à confirmer et rien à écrire en base ;
 * 2. **deux appels** — un pour répondre, un pour réécrire : deux fois le coût,
 *    et le second ne verrait pas ce que le premier a dit ;
 * 3. **un bloc marqué dans la réponse** — retenu. Un seul appel, compatible avec
 *    le streaming (on extrait à la fin du tour), et l'absence de bloc *est* le
 *    signal « je réponds sans toucher au brouillon ».
 *
 * Le module est pur : l'extraction se teste sans réseau ni modèle, ce qui compte
 * parce qu'un marqueur mal fermé laisserait passer du balisage dans un email.
 */

export const DRAFT_OPEN = "<<<BROUILLON>>>";
export const DRAFT_CLOSE = "<<</BROUILLON>>>";

export interface ParsedReply {
  /** Ce qui s'affiche dans le fil — le bloc en est retiré. */
  readonly message: string;
  /** Le nouveau brouillon, ou `null` si la réponse n'en portait pas. */
  readonly draft: { readonly subject: string; readonly body: string } | null;
}

/**
 * Sépare la réponse visible du brouillon éventuel.
 *
 * Tolérant sur la forme et strict sur le résultat : un bloc ouvert mais jamais
 * fermé — ce qui arrive si la réponse est tronquée par la limite de jetons — est
 * **ignoré**, et le texte est rendu tel quel. Appliquer un brouillon à moitié
 * écrit remplacerait un message complet par un fragment, sans que rien ne le
 * signale.
 */
export function parseReply(text: string): ParsedReply {
  const start = text.indexOf(DRAFT_OPEN);
  if (start === -1) return { message: text.trim(), draft: null };

  const end = text.indexOf(DRAFT_CLOSE, start);
  if (end === -1) {
    // Bloc non refermé : réponse tronquée. On garde ce qui précède comme
    // message et on ne touche pas aux champs.
    return { message: text.slice(0, start).trim(), draft: null };
  }

  const inner = text.slice(start + DRAFT_OPEN.length, end);
  const message = `${text.slice(0, start)} ${text.slice(end + DRAFT_CLOSE.length)}`.trim();
  const draft = parseBlock(inner);

  return { message, draft };
}

/**
 * Le contenu du bloc : une ligne `Objet :` puis le corps.
 *
 * L'objet est facultatif — une reprise qui ne change que le corps n'a pas à le
 * réécrire — mais le corps ne l'est pas : un bloc sans corps n'est pas un
 * brouillon, et il est rejeté plutôt que d'effacer le champ.
 */
function parseBlock(inner: string): { subject: string; body: string } | null {
  const lines = inner.replace(/\r\n/g, "\n").split("\n");
  let subject = "";
  let index = 0;

  // On saute les lignes vides de tête avant de chercher l'objet.
  while (index < lines.length && (lines[index] ?? "").trim() === "") index += 1;

  const first = (lines[index] ?? "").trim();
  const match = /^objet\s*:\s*(.*)$/i.exec(first);
  if (match !== null) {
    subject = (match[1] ?? "").trim();
    index += 1;
  }

  const body = lines.slice(index).join("\n").trim();
  if (body === "") return null;

  return { subject, body };
}

/**
 * Ce que le client envoie à Alex : l'état courant du brouillon, puis la demande.
 *
 * **Le brouillon voyage à chaque message**, et c'est délibéré. Le fil vit côté
 * serveur, mais le texte, lui, est retouché à la main dans un champ que le
 * serveur ne voit jamais. Ne l'envoyer qu'une fois ferait travailler Alex sur
 * une version périmée dès la première retouche — exactement ce que la règle
 * « mes modifications ne sont jamais jetées en silence » interdit.
 */
export function composeMessage(
  contact: { readonly id: string; readonly name: string },
  draft: { readonly subject: string; readonly body: string },
  instruction: string,
  /** Le signataire retenu pour ce message, s'il y en a un. */
  signature?: string,
): string {
  // La signature voyage avec le brouillon : le fil ne sait pas qui l'utilisateur
  // a choisi dans le sélecteur, et une reprise qui reposerait la signature par
  // défaut ferait repartir le message sous le mauvais nom.
  //
  // Elle est annoncée **avant** le brouillon, dans l'en-tête, et non entre le
  // corps et la demande : intercalée là, elle se lisait comme la fin du message
  // et se retrouvait recopiée dans le corps.
  const signatureLines =
    signature === undefined || signature.trim() === ""
      ? []
      : [`[Signataire de ce message] ${signature.trim().replace(/\n/g, " · ")}`, ""];

  return [
    // L'identifiant est donné pour qu'Alex puisse **lire la fiche** avec ses
    // outils quand on lui demande « qu'est-ce qu'on sait d'elle ? ». Sans lui,
    // il devrait deviner de qui l'on parle, ou chercher par nom — et deux
    // homonymes suffiraient à lui faire lire la mauvaise fiche.
    `[Contact] ${contact.name} — identifiant ${contact.id}`,
    "",
    ...signatureLines,
    "[Brouillon actuel, retouches de l'utilisateur comprises]",
    `Objet : ${draft.subject}`,
    "",
    draft.body,
    "",
    "",
    "[Demande]",
    instruction.trim(),
  ].join("\n");
}
