import type { Lifecycle } from "./types";

/**
 * Prospects perdus, et opposition au démarchage.
 *
 * Un prospect qui a dit non n'est pas un prospect qu'on supprime : effacer la
 * fiche détruirait l'historique, fausserait le taux de conversion, et ferait
 * re-prospecter dans un an quelqu'un qui a déjà refusé. C'est donc un **statut**,
 * qui sort la fiche des listes du quotidien sans la sortir de la base.
 */

/** Le cycle de vie qui parque une fiche sans l'effacer. */
export const LOST_LIFECYCLE: Lifecycle = "Perdu";

export function isLost(lifecycle: Lifecycle): boolean {
  return lifecycle === LOST_LIFECYCLE;
}

/**
 * Motifs proposés. Ce sont des **suggestions**, pas une liste fermée : le champ
 * reste libre, parce qu'une raison de perte qu'on n'avait pas prévue est
 * justement celle qu'il faut pouvoir écrire.
 */
export const LOST_REASONS = [
  "Budget",
  "Timing",
  "Concurrent",
  "Pas le bon interlocuteur",
  "Ne répond plus",
  "Ne souhaite plus être contacté",
] as const;

/**
 * Le motif qui vaut opposition ferme au démarchage.
 *
 * Ce n'est pas un motif comme les autres : les cinq autres décrivent un échec
 * commercial, celui-ci exprime une volonté de la personne. Le CRM doit la
 * respecter quel que soit son cycle de vie — quelqu'un peut redevenir « Client »
 * plus tard sans que son refus d'être démarché ait été levé.
 */
export const DO_NOT_CONTACT = "Ne souhaite plus être contacté";

/** Forme minimale suffisante pour décider. Volontairement pas `ContactRecord`. */
export interface ContactabilityLike {
  readonly lostReason: string;
}

/**
 * Cette personne s'oppose-t-elle au démarchage ?
 *
 * Comparaison insensible à la casse et aux espaces de bord, parce que le champ
 * est libre : quelqu'un qui écrit « ne souhaite plus être contacté » en
 * minuscules exprime exactement la même chose.
 *
 * **La règle vit ici, pas dans l'interface.** Un bouton grisé n'est pas une
 * garantie : il suffit d'un appel d'API pour le contourner, et c'est
 * précisément ce que font les agents du conseil. Les services de séquences et
 * de relance appellent `assertContactable()` avant d'écrire.
 */
export function optedOut(contact: ContactabilityLike): boolean {
  return contact.lostReason.trim().toLowerCase() === DO_NOT_CONTACT.toLowerCase();
}

/** Message unique du refus, pour que toutes les surfaces disent la même chose. */
export const OPT_OUT_MESSAGE =
  "Cette personne a demandé à ne plus être contactée. Aucune séquence ni relance ne peut lui être adressée.";

/**
 * Cycles de vie retenus par défaut dans les vues du quotidien.
 *
 * `Perdu` en est exclu : sa place est dans sa propre puce, pas dans la liste
 * d'appels du matin. Il reste cherchable, consultable, et son historique est
 * intact — c'est une exclusion d'affichage, pas un archivage.
 */
export function excludesLost(lifecycle: Lifecycle | "all" | undefined): boolean {
  return lifecycle !== LOST_LIFECYCLE && lifecycle !== "all";
}
