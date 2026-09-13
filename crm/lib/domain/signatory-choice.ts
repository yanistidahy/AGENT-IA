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

/** Ce dont on a besoin pour décrire un signataire, et rien de plus. */
export interface SignatoryLike {
  readonly name: string;
  readonly title: string;
  readonly email: string;
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
 * Les lignes que ce signataire posera au bas du message.
 *
 * C'est `signatureBlock()` du dossier d'Alex, réduit à ce que l'écran a besoin
 * de montrer. On l'affiche **sous le sélecteur** : lire « Mohamed » dans un menu
 * ne dit pas quelles quatre lignes partiront, et c'est pourtant la seule chose
 * que le destinataire verra.
 */
export function signatureLines(signatory: SignatoryLike): readonly string[] {
  return [signatory.name, signatory.title, signatory.email]
    .map((line) => line.trim())
    .filter((line) => line !== "");
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
