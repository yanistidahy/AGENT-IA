import { DO_NOT_CONTACT, LOST_REASONS } from "./lost";
import type { DealStatus } from "./types";

/**
 * Perdre une affaire, et la rouvrir.
 *
 * ## Perdre n'est pas supprimer
 *
 * Une affaire perdue **sort du pipeline sans sortir de la base** : elle garde
 * son montant, son historique et son motif, cesse de compter dans la valeur
 * totale et le montant pondéré, et commence à compter dans les statistiques de
 * perte. C'est le chemin normal, celui qu'on emprunte tous les jours. La
 * suppression est l'exception, et elle a ses propres règles
 * (`deal-deletion.ts`).
 *
 * ## L'étape n'est pas touchée, et c'est ce qui rend la réouverture exacte
 *
 * Gagner fait avancer — l'affaire rejoint l'étape à 100 %. Perdre fait
 * **sortir** : l'affaire reste dans la colonne où elle était, elle disparaît
 * seulement du tableau parce que le kanban ne montre que les affaires en cours.
 * Rouvrir n'a donc rien à restaurer : l'étape n'a jamais bougé, la carte
 * revient exactement là où elle était. Une colonne « étape d'avant » aurait été
 * une seconde source de vérité pour une information que la première n'a jamais
 * perdue.
 */

/**
 * Les motifs proposés pour une affaire.
 *
 * Ce sont ceux de la fiche contact — même vocabulaire, une seule liste à tenir —
 * **moins l'opposition au démarchage**, et ce retrait est la seule décision de
 * ce fichier qui mérite d'être défendue.
 *
 * « Ne souhaite plus être contacté » n'est pas un motif d'échec commercial :
 * c'est une volonté exprimée par une personne, et le produit la fait respecter
 * en lisant `Contact.lostReason` (`optedOut()` — séquences, relances, outils du
 * conseil). Une affaire n'a pas d'opposition ; la porter ici la rendrait
 * **visible sans être respectée** : l'écran afficherait « ne souhaite plus être
 * contacté » pendant que le moteur de séquences continuerait d'écrire à la
 * personne, parce qu'il ne lit pas cette colonne. Un motif qui ment de cette
 * façon est pire que son absence. Quand c'est le cas, c'est la fiche contact
 * qu'il faut passer en `Perdu` — et le tiroir le dit.
 *
 * Le champ reste libre : une raison qu'on n'avait pas prévue est justement
 * celle qu'il faut pouvoir écrire.
 */
export const DEAL_LOST_REASONS: readonly string[] = LOST_REASONS.filter(
  (reason) => reason !== DO_NOT_CONTACT,
);

/** Ce que le motif d'opposition demande à la place — dit à l'écran, pas deviné. */
export const OPT_OUT_REDIRECT =
  "Une opposition au démarchage se note sur la fiche du contact, pas sur l'affaire : c'est elle que lisent les séquences et les relances.";

export interface LossPlan {
  readonly status: DealStatus;
  readonly closedAt: Date;
  readonly lastActivityAt: Date;
  readonly lostReason: string;
  /** Note système consignée dans l'historique de l'affaire. */
  readonly note: string;
}

/**
 * Marquer perdue. Le motif est facultatif au domaine — l'écran l'exige, un
 * appel d'API ou un import n'en porte pas forcément, et refuser l'écriture pour
 * un champ d'ergonomie ferait échouer des chemins légitimes.
 */
export function planLoss(reason: string, now: Date): LossPlan {
  const trimmed = reason.trim();
  return {
    status: "lost",
    closedAt: now,
    lastActivityAt: now,
    lostReason: trimmed,
    note:
      trimmed === ""
        ? "Affaire marquée perdue"
        : `Affaire marquée perdue — motif : ${trimmed}`,
  };
}

export interface ReopenPlan {
  readonly status: DealStatus;
  readonly closedAt: null;
  readonly lastActivityAt: Date;
  readonly lostReason: "";
  readonly note: string;
}

/**
 * Rouvrir. Le motif est effacé — l'affaire n'est plus perdue, le laisser en
 * base ferait mentir la colonne — mais il **passe dans la note**, sinon
 * rouvrir effacerait silencieusement la raison pour laquelle on avait renoncé.
 * C'est la même règle qu'au jalon 1 sur `closedAt` : un état incohérent ne se
 * garde pas « au cas où ».
 */
export function planReopen(previousReason: string, now: Date): ReopenPlan {
  const trimmed = previousReason.trim();
  return {
    status: "open",
    closedAt: null,
    lastActivityAt: now,
    lostReason: "",
    note:
      trimmed === ""
        ? "Affaire rouverte"
        : `Affaire rouverte (était perdue — motif : ${trimmed})`,
  };
}

/** Une affaire ne se rouvre que si elle est close : rouvrir « en cours » n'a pas de sens. */
export function canReopen(status: DealStatus): boolean {
  return status !== "open";
}
