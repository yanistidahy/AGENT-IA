import "server-only";
import { prisma } from "../db";
import {
  isReplyCategory,
  replyCategoryLabel,
  type OutreachChannel,
  type ReplyCategory,
} from "../domain/outreach";
import { toChannel } from "../domain/outreach";

/**
 * **La catégorie d'une réponse se saisit, elle ne se devine pas.**
 *
 * « Intéressé », « pas maintenant », « pas intéressé », « déjà équipé », « pas
 * le bon interlocuteur », « désinscription », « absence du bureau » : sept
 * valeurs, posées à la main sur la réponse. Rien ne les déduit du texte, et
 * c'est une décision, pas une étape remise à plus tard — une catégorie devinée
 * d'après des mots-clés se tromperait sur les réponses qui comptent le plus
 * (« je ne suis pas contre, mais pas ce trimestre » n'est pas un refus), et
 * personne ne saurait ensuite lesquelles ont été lues par un humain.
 *
 * Les réponses sans catégorie sont **comptées comme telles** : elles entrent
 * dans « Réponses » et dans le taux de réponse, et dans aucune catégorie. Le
 * tableau de bord affiche leur nombre pour que le travail de classement se
 * voie, au lieu de laisser croire à une absence de réponses positives.
 *
 * L'écriture porte sur l'**événement** `reply_received`, pas sur l'interaction
 * qui l'a produit : c'est le journal qui sert tous les chiffres, et une
 * seconde copie de la catégorie sur l'interaction finirait par le contredire.
 */

export interface ReplyEventRow {
  readonly id: string;
  readonly occurredAt: Date;
  readonly channel: OutreachChannel;
  /** `""` = pas encore classée. */
  readonly category: string;
  readonly categoryLabel: string;
  readonly campaignName: string;
}

export async function readReplyEvents(contactId: string): Promise<ReplyEventRow[]> {
  const rows = await prisma.outreachEvent.findMany({
    where: { contactId, type: "reply_received" },
    orderBy: { occurredAt: "desc" },
    select: {
      id: true,
      occurredAt: true,
      channel: true,
      replyCategory: true,
      campaign: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    occurredAt: row.occurredAt,
    channel: toChannel(row.channel),
    category: row.replyCategory,
    categoryLabel: replyCategoryLabel(row.replyCategory),
    campaignName: row.campaign?.name ?? "",
  }));
}

export interface SetCategoryResult {
  readonly ok: boolean;
  readonly message: string;
  readonly category: string;
}

/**
 * Classer une réponse, ou retirer son classement.
 *
 * `""` est accepté et vaut « non classée » : un classement posé par erreur doit
 * pouvoir être retiré sans laisser une valeur fausse en base, et « non classée »
 * est un état légitime du produit, pas un trou à boucher.
 */
export async function setReplyCategory(
  eventId: string,
  category: string,
): Promise<SetCategoryResult> {
  if (category !== "" && !isReplyCategory(category)) {
    return { ok: false, message: "Catégorie inconnue.", category: "" };
  }

  const event = await prisma.outreachEvent.findUnique({
    where: { id: eventId },
    select: { type: true },
  });
  if (event === null) return { ok: false, message: "Réponse introuvable.", category: "" };
  if (event.type !== "reply_received") {
    // Une catégorie de réponse posée sur un envoi ne voudrait rien dire, et
    // `positiveReplies` la compterait comme une réponse positive.
    return { ok: false, message: "Cet événement n'est pas une réponse.", category: "" };
  }

  const value: ReplyCategory | "" = category === "" ? "" : (category as ReplyCategory);
  await prisma.outreachEvent.update({
    where: { id: eventId },
    data: { replyCategory: value },
  });

  return {
    ok: true,
    message: value === "" ? "Classement retiré." : `Classée « ${replyCategoryLabel(value)} ».`,
    category: value,
  };
}
