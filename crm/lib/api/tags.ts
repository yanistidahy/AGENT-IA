import { z } from "zod";
import { prisma } from "../db";
import { searchText } from "../domain/text";

/**
 * Gestion des étiquettes.
 *
 * Une étiquette n'a pas de table : c'est une chaîne portée par la fiche. C'est
 * assumé — une table imposerait une jointure et un cycle de vie propre pour une
 * valeur que l'utilisateur crée au fil de l'eau et abandonne aussi vite.
 *
 * La contrepartie est que renommer se fait par un `updateMany`, et supprimer par
 * une remise à vide. Les deux annoncent d'abord combien de fiches sont
 * concernées : une opération qui touche 40 contacts ne doit pas se déclencher
 * sur un clic mal placé.
 */

export const renameTagSchema = z.object({
  from: z.string().trim().min(1, "Étiquette d'origine manquante"),
  to: z.string().trim().min(1, "Nouveau nom obligatoire").max(60, "Étiquette trop longue"),
});

export const deleteTagSchema = z.object({
  tag: z.string().trim().min(1, "Étiquette manquante"),
});

export async function countTag(tag: string): Promise<number> {
  return prisma.contact.count({ where: { tag } });
}

/**
 * Renomme une étiquette sur toutes les fiches qui la portent.
 *
 * `searchText` n'est pas recalculé : l'étiquette n'y entre pas. Elle se filtre
 * par sa propre colonne, pas par la recherche plein texte — la mêler à la
 * recherche ferait remonter tous les « Devis envoyé » sur une recherche de
 * « devis », ce qui n'est pas ce qu'on cherche en tapant un nom.
 */
export async function renameTag(from: string, to: string): Promise<number> {
  const result = await prisma.contact.updateMany({
    where: { tag: from },
    data: { tag: to },
  });
  return result.count;
}

/** Retire l'étiquette des fiches qui la portent. Les fiches, elles, restent. */
export async function deleteTag(tag: string): Promise<number> {
  const result = await prisma.contact.updateMany({
    where: { tag },
    data: { tag: "" },
  });
  return result.count;
}

/** Réservé aux tests de non-régression du miroir de recherche. */
export function contactSearchMirror(parts: readonly string[]): string {
  return searchText(parts);
}
