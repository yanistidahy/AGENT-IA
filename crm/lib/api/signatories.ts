import "server-only";

import { knownSignatureBlocks } from "../domain/signatory-choice";
import { listMailboxes, ownerMatches, type Mailbox } from "./mailboxes";

/**
 * Les signataires — désormais une **projection des boîtes d'envoi**.
 *
 * Le jalon 35 avait fait du signataire une propriété de l'envoi, choisie
 * message par message. Le jalon 54 déplace cette propriété d'un cran : la
 * signature appartient à la **boîte** — cette adresse signe de ce nom et de ce
 * titre — et choisir la boîte choisit la signature. La table `signatories`
 * n'est plus lue : ce module dérive la même forme depuis `mailboxes`, pour que
 * le panneau de rédaction, le dossier d'Alex et `replaceSignature` continuent
 * de fonctionner sans réapprendre un vocabulaire.
 *
 * **`Signatory.id` est un identifiant de boîte.** C'est ce qui fait que le
 * sélecteur « Envoyé depuis » du panneau et le `signatoryId` du journal des
 * envois désignent la même chose sans colonne de plus.
 */
export interface Signatory {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  /** Le téléphone de la signature, saisi sur la boîte. Vide = pas de ligne. */
  readonly phone: string;
  /**
   * L'adresse de la signature. **C'est `from`**, pas une seconde saisie : la
   * signature doit montrer l'adresse d'où le message part, sous peine de se
   * lire comme une usurpation. Le champ existe pour que `Signatory` porte une
   * `Signature` complète (jalon 62) sans que l'appelant ait à la recomposer.
   */
  readonly email: string;
  readonly isDefault: boolean;
  /** Le libellé de la boîte, pour que le sélecteur dise d'où part le message. */
  readonly label: string;
  /** L'adresse d'expédition, affichée à côté du libellé. */
  readonly from: string;
}

function toSignatory(mailbox: Mailbox, index: number): Signatory {
  return {
    id: mailbox.id,
    name: mailbox.signName,
    title: mailbox.signTitle,
    phone: mailbox.signPhone,
    email: mailbox.smtpFrom,
    isDefault: index === 0,
    label: mailbox.label,
    from: mailbox.smtpFrom,
  };
}

/** Les boîtes actives, sous leur forme de signataire. */
export async function listSignatories(): Promise<Signatory[]> {
  const mailboxes = await listMailboxes();
  const active = mailboxes.filter((box) => box.active);
  return (active.length > 0 ? active : mailboxes).map(toSignatory);
}

/**
 * Le signataire proposé pour un contact donné — la boîte dont le signataire est
 * le propriétaire de la fiche (règle du jalon 35, portée par `pickMailbox`).
 */
export function pickSignatory(
  signatories: readonly Signatory[],
  owner: string,
): Signatory | null {
  if (signatories.length === 0) return null;
  return (
    signatories.find((entry) => ownerMatches(entry.name, owner)) ?? signatories[0] ?? null
  );
}

/**
 * Tous les blocs de signature connus — ce que `replaceSignature` cherche.
 *
 * **Les blocs à deux lignes en font partie**, en plus des quatre lignes du
 * jalon 62 : un brouillon composé avant ce jalon dort encore dans la file des
 * départs, et changer son signataire doit remplacer sa signature plutôt que
 * d'en ajouter une seconde en dessous. La forme héritée disparaîtra d'elle-même
 * quand ces brouillons seront partis ; jusque-là, la connaître ne coûte rien.
 */
export function signatureBlocks(signatories: readonly Signatory[]): string[] {
  // La liste vit dans le domaine : le panneau de rédaction en a besoin lui
  // aussi, et deux listes de formes connues finiraient par ne plus contenir les
  // mêmes. C'est ce qui a produit le doublon du jalon 66.
  return knownSignatureBlocks(signatories);
}

/**
 * Les noms qui ne doivent jamais clore un email écrit pour quelqu'un d'autre.
 *
 * **Chaque signataire y figure**, en plus des agents : un brouillon destiné à
 * partir sous le nom de Mohamed ne doit pas se terminer par celui de Yanis. Le
 * nom complet et le prénom seul, parce qu'on signe rarement de son nom entier.
 */
export function signatoryNames(signatories: readonly Signatory[]): string[] {
  const names = new Set<string>();
  for (const signatory of signatories) {
    const full = signatory.name.trim();
    if (full === "") continue;
    names.add(full);
    const first = full.split(/\s+/)[0] ?? "";
    if (first !== "") names.add(first);
  }
  return [...names];
}
