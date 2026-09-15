import "server-only";
import type { MailboxOption } from "../domain/signatory-choice";

/**
 * Une boîte, telle que les écrans de campagne la proposent.
 *
 * **Une seule conversion, deux pages.** La liste et la page d'une campagne
 * doivent offrir exactement les mêmes options : la boîte décide de la
 * signature depuis le jalon 54, et deux conversions écrites séparément
 * finiraient par ne plus transporter les mêmes champs — l'une montrerait les
 * lignes qui partiront, l'autre pas, sur le même choix.
 *
 * La signature entière voyage, pas seulement le nom : l'écran doit pouvoir
 * afficher les lignes réelles et **dire quand il n'y en a aucune**.
 */
export function mailboxOptions(
  boxes: readonly {
    readonly id: string;
    readonly label: string;
    readonly signName: string;
    readonly signTitle: string;
    readonly signPhone: string;
    readonly smtpFrom: string;
  }[],
): MailboxOption[] {
  return boxes.map((box) => ({
    id: box.id,
    label: box.label,
    name: box.signName,
    title: box.signTitle,
    phone: box.signPhone,
    email: box.smtpFrom,
    from: box.smtpFrom,
  }));
}
