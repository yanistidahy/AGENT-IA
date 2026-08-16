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
 * Cycles de vie **terminaux** : la relation ne court plus.
 *
 * `Perdu` a dit non, `Ancien Client` a cessé d'acheter. Ni l'un ni l'autre
 * n'attend quoi que ce soit de nous, et c'est ce qui les distingue de tous les
 * autres états : **ils n'ont pas de statut de relance**, ni saisi ni calculé.
 *
 * Sans cette règle, une fiche pouvait afficher quatre affirmations
 * incompatibles sur la même ligne — cycle « Perdu », statut saisi « Contacté —
 * en attente », statut calculé « jamais contacté », et « 0 tentative ». Le
 * cycle de vie terminal tranche : il gagne partout.
 */
export const TERMINAL_LIFECYCLES: readonly Lifecycle[] = [LOST_LIFECYCLE, "Ancien Client"];

export function isTerminal(lifecycle: Lifecycle): boolean {
  return TERMINAL_LIFECYCLES.includes(lifecycle);
}

/**
 * Les champs de relance qu'un cycle de vie terminal remet à zéro.
 *
 * **Écrit une fois, appliqué par tous les chemins d'écriture** — formulaire de
 * fiche, tiroir, interaction consignée avec l'issue « pas intéressé », outils du
 * conseil. Le chemin de l'interaction effaçait déjà la relance ; les autres non,
 * et aucun n'effaçait le statut saisi.
 *
 * `statusSetAt` part avec `status` : une date de saisie sans valeur saisie
 * ferait apparaître la fiche dans la puce « Statut figé » pour un statut qui
 * n'existe plus.
 */
export interface TerminalReset {
  readonly status: "";
  readonly statusSetAt: null;
  readonly nextReminder: null;
}

export const TERMINAL_RESET: TerminalReset = {
  status: "",
  statusSetAt: null,
  nextReminder: null,
};

/**
 * La fiche est-elle en contradiction avec son cycle de vie terminal ?
 *
 * Sert au repérage (correction de maintenance) autant qu'aux tests. Une fiche
 * terminale ne doit porter ni statut saisi, ni relance programmée.
 */
export function contradictsTerminal(contact: {
  readonly lifecycle: Lifecycle;
  readonly status: string;
  readonly nextReminder: Date | null;
}): boolean {
  if (!isTerminal(contact.lifecycle)) return false;
  return contact.status.trim() !== "" || contact.nextReminder !== null;
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
  /**
   * « Pas intéressé » nomme le cas le plus fréquent et le plus honnête : la
   * personne a répondu, elle a dit non, elle n'a pas dit pourquoi. Sans cette
   * valeur il fallait choisir entre inventer un motif et laisser vide le motif
   * majoritaire du portefeuille. « Ne répond plus » serait faux — ils ont bien
   * répondu.
   */
  "Pas intéressé",
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
