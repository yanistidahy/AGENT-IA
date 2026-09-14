/**
 * Comment un signataire se lit dans un menu — **une seule définition**.
 *
 * ## Le défaut que ce module ferme
 *
 * Depuis le jalon 54, le signataire **est** la boîte d'envoi : choisir la boîte
 * choisit la signature, et `Signatory.id` est un identifiant de boîte. La
 * mécanique était juste, mais l'écran ne la disait pas. Les campagnes rendaient
 * `{label} · {signName}` sous un intitulé « Boîte d'envoi » — donc :
 *
 * - rien ne nommait le signataire, alors que c'est lui qu'on choisit ;
 * - une boîte sans signataire rendait `« Sans signataire · »`, un séparateur
 *   qui pend dans le vide plutôt qu'un manque annoncé ;
 * - le panneau de rédaction, lui, affichait déjà l'adresse d'expédition. Deux
 *   écrans décrivaient donc la même chose de deux façons, et c'est toujours le
 *   second qu'on oublie de corriger.
 *
 * D'où ce module : les trois surfaces l'appellent, aucune ne recompose
 * l'étiquette. C'est la règle du projet — une règle vit à un seul endroit.
 */

/** Ce qui compose une signature : les quatre lignes, et rien d'autre. */
export interface SignatureLike {
  readonly name: string;
  readonly title: string;
  /** Le téléphone de la signature. Vide = une ligne de moins. */
  readonly phone: string;
  readonly email: string;
}

/** Ce dont on a besoin pour **décrire** un signataire dans un menu. */
export interface SignatoryLike extends SignatureLike {
  /** Le libellé de la boîte : « Yanis », « Mohamed ». */
  readonly label: string;
  /** L'adresse d'expédition réelle. */
  readonly from: string;
}

/**
 * Une boîte d'envoi **est** un signataire (jalon 54) : `id` désigne les deux.
 * Le type vit ici et non dans un écran, parce que la création et l'édition le
 * partagent — et qu'un type exporté depuis un composant ferait dépendre l'un
 * de l'autre.
 */
export interface MailboxOption extends SignatoryLike {
  readonly id: string;
}

/** Le choix courant, ou `null` si la liste est vide. */
export function chosenSignatory(
  mailboxes: readonly MailboxOption[],
  id: string,
): MailboxOption | null {
  return mailboxes.find((box) => box.id === id) ?? null;
}

/** Le texte dit qu'aucun nom n'est réglé — jamais un séparateur laissé nu. */
export const NO_SIGNATORY = "signataire non renseigné";

/**
 * L'étiquette d'une entrée de menu.
 *
 * Forme : `Boîte · Nom (adresse)`. Chaque morceau disparaît quand il est vide,
 * **et le séparateur avec lui** : `« Sans signataire · »` était le symptôme
 * exact d'un gabarit qui suppose ses morceaux remplis.
 *
 * Un nom manquant n'est pas escamoté pour autant : il est **nommé**. Une entrée
 * qui ne porterait que le libellé de la boîte se lirait comme une boîte sans
 * problème, alors que c'est une campagne qui partira sans signature.
 */
export function signatoryOptionLabel(signatory: SignatoryLike): string {
  const name = signatory.name.trim();
  const parts: string[] = [];

  const label = signatory.label.trim();
  if (label !== "") parts.push(label);
  parts.push(name === "" ? NO_SIGNATORY : name);

  const head = parts.join(" · ");
  const from = signatory.from.trim();
  return from === "" ? head : `${head} (${from})`;
}

/**
 * Les lignes que ce signataire posera au bas du message — **la définition**.
 *
 * `signatureBlock()` du dossier d'Alex les assemble, le panneau de rédaction
 * les cherche pour remplacer une signature, et les écrans de campagne les
 * montrent. Une seule fonction, parce que le jalon 66 a payé le contraire : le
 * panneau composait un bloc à deux lignes quand le serveur en composait quatre,
 * si bien que changer de boîte **ajoutait** une signature au lieu de remplacer
 * celle qui était là.
 *
 * **Un champ vide retire sa ligne**, il n'en laisse pas une blanche.
 */
export function signatureLines(signatory: SignatureLike): readonly string[] {
  return [signatory.name, signatory.title, signatory.phone, signatory.email]
    .map((line) => line.trim())
    .filter((line) => line !== "");
}

/** Les mêmes lignes, assemblées — la forme qui vit dans le corps du message. */
export function signatureText(signatory: SignatureLike): string {
  return signatureLines(signatory).join("\n");
}

/**
 * Toutes les formes sous lesquelles une signature a pu être écrite.
 *
 * `replaceSignature` compare des blocs **entiers** : une forme absente de cette
 * liste n'est pas remplacée, elle est doublée. D'où les formes héritées —
 * avant le jalon 62 la signature tenait en deux lignes, et un brouillon composé
 * alors dort peut-être encore dans la file des départs. Les connaître ne coûte
 * rien ; les oublier coûte une signature en double dans un message qui part.
 */
export function knownSignatureBlocks(
  signatories: readonly SignatureLike[],
): string[] {
  return signatories.flatMap((signatory) => [
    signatureText(signatory),
    signatureText({ ...signatory, email: "" }),
    signatureText({ ...signatory, phone: "" }),
    signatureText({ ...signatory, phone: "", email: "" }),
  ]);
}

export interface SignatoryGap {
  /** Vrai quand le message partirait sans nom au bas. */
  readonly missing: boolean;
  /** Ce qui manque et où le régler. Vide quand tout va bien. */
  readonly message: string;
}

/**
 * Cette campagne partira-t-elle signée ?
 *
 * **On avertit, on ne bloque pas** — c'est la posture du produit depuis le
 * jalon 8, et elle vaut ici : une boîte peut être configurée juste après. Mais
 * le silence n'est pas une option : une campagne qui part sans signature ne se
 * découvre que chez le destinataire, et c'est le pire endroit.
 *
 * `null` = aucune boîte choisie, ce qui est un autre problème que celui-ci et se
 * signale ailleurs.
 */
export function signatoryGap(signatory: SignatoryLike | null): SignatoryGap {
  if (signatory === null) {
    return {
      missing: true,
      message: "Aucune boîte d'envoi choisie : cette campagne ne peut pas composer.",
    };
  }

  if (signatory.name.trim() === "") {
    return {
      missing: true,
      message:
        `La boîte « ${signatory.label.trim() || "sans libellé"} » ne porte aucun nom de ` +
        "signataire : les messages de cette campagne partiraient sans signature. " +
        "Réglages → Messagerie → nom et titre de la signature.",
    };
  }

  return { missing: false, message: "" };
}
