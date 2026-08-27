import type { DealStatus } from "./types";

/**
 * Supprimer une affaire — et, presque toujours, refuser.
 *
 * ## Pourquoi un verdict plutôt qu'un bouton
 *
 * Une affaire qui a vécu est un **fait** : elle a produit des appels, des
 * déplacements d'étape, peut-être une signature. L'effacer ne corrige pas une
 * erreur, elle réécrit l'histoire — et les taux de conversion, la vélocité,
 * l'entonnoir et le chiffre du mois se mettent alors à décrire un passé qui n'a
 * pas eu lieu. La suppression n'existe donc que pour ce qu'elle est censée
 * réparer : un doublon, une saisie d'essai, une affaire créée par erreur, dans
 * les minutes qui suivent et avant que quoi que ce soit s'y accroche.
 *
 * Tout le reste se marque **perdu** (`deal-loss.ts`), et le refus le dit.
 *
 * ## Ce qui compte comme histoire, et l'exception qui a demandé à réfléchir
 *
 * | Fait | Compte ? | Pourquoi |
 * |---|---|---|
 * | Interaction réelle — appel, email, réunion, démo, LinkedIn | **oui** | quelqu'un a parlé à quelqu'un |
 * | Deuxième visite d'étape et suivantes | **oui** | l'affaire a bougé dans le pipeline |
 * | Statut gagné ou perdu | **oui** | une décision a été prise et comptée |
 * | Tâche rattachée | **oui** | du travail a été planifié dessus |
 * | **Note** | **non** | voir ci-dessous |
 * | Première visite d'étape | **non** | elle est écrite par la création elle-même |
 *
 * **Les notes ne comptent pas, et ce n'est pas un oubli.** Le produit en écrit
 * une à *chaque* déplacement d'étape (`moveDealStage`) et une à la
 * qualification d'un contact : les compter rendrait indélébile toute affaire
 * née d'une qualification, y compris celle qu'on vient de créer sur le mauvais
 * contact — c'est-à-dire précisément l'erreur que la suppression doit réparer.
 * Une note ne sait pas dire si elle vient d'un humain ou de la comptabilité
 * interne du produit ; tant qu'elle ne le sait pas, elle ne peut pas servir de
 * preuve. Ce qu'une note emporte est donc **nommé dans la confirmation** plutôt
 * que d'y faire obstacle : on supprime en sachant ce qu'on perd.
 *
 * Même raison pour la première visite d'étape : `createDeal` l'écrit dans la
 * transaction de création. Une affaire jamais déplacée en porte exactement une.
 */

export interface DeletionFacts {
  readonly status: DealStatus;
  /** Interactions dont le type n'est pas « note » — le travail réel. */
  readonly realActivities: number;
  /** Notes, système comprises. Nommées à la confirmation, jamais bloquantes. */
  readonly notes: number;
  /** Visites d'étape, **création incluse** : une affaire neuve en a une. */
  readonly stageVisits: number;
  readonly tasks: number;
}

export type DeletionBlocker =
  | "activities"
  | "stage-moves"
  | "closed"
  | "tasks";

export interface DeletionVerdict {
  readonly deletable: boolean;
  readonly blockers: readonly DeletionBlocker[];
  /** Ce qui disparaîtrait avec l'affaire, à nommer avant de demander. */
  readonly collateral: readonly string[];
}

const BLOCKER_TEXT: Record<DeletionBlocker, (facts: DeletionFacts) => string> = {
  activities: (facts) =>
    `${facts.realActivities} échange(s) consigné(s) — appels, emails ou rendez-vous`,
  "stage-moves": (facts) =>
    `${facts.stageVisits - 1} déplacement(s) d'étape dans le pipeline`,
  closed: (facts) =>
    facts.status === "won"
      ? "elle est gagnée, donc comptée dans le chiffre d'affaires"
      : "elle est déjà marquée perdue, donc comptée dans les statistiques de perte",
  tasks: (facts) => `${facts.tasks} tâche(s) rattachée(s)`,
};

export function deletionVerdict(facts: DeletionFacts): DeletionVerdict {
  const blockers: DeletionBlocker[] = [];
  if (facts.realActivities > 0) blockers.push("activities");
  if (facts.stageVisits > 1) blockers.push("stage-moves");
  if (facts.status !== "open") blockers.push("closed");
  if (facts.tasks > 0) blockers.push("tasks");

  const collateral: string[] = [];
  if (facts.notes > 0) collateral.push(`${facts.notes} note(s) d'historique`);
  if (facts.stageVisits > 0) {
    collateral.push(`${facts.stageVisits} visite(s) d'étape`);
  }

  return { deletable: blockers.length === 0, blockers, collateral };
}

/**
 * Le refus, en une phrase qui nomme *ce qui* retient et *quoi faire à la place*.
 * « Suppression impossible » seul laisserait chercher — c'est la règle du
 * produit depuis les états vides du jalon 8 : dire la règle appliquée.
 */
export function describeRefusal(facts: DeletionFacts, verdict: DeletionVerdict): string {
  if (verdict.deletable) return "";
  const reasons = verdict.blockers.map((blocker) => BLOCKER_TEXT[blocker](facts));
  return `Cette affaire porte une histoire : ${reasons.join(", ")}. La supprimer ferait mentir vos taux de conversion. Marquez-la perdue — elle sort du pipeline et garde son montant, son historique et son motif.`;
}

/** Le texte de la confirmation : elle nomme l'affaire, son montant, et le reste. */
export function describeDeletion(
  name: string,
  amount: string,
  verdict: DeletionVerdict,
): string {
  const tail =
    verdict.collateral.length === 0
      ? ""
      : ` Partiront avec elle : ${verdict.collateral.join(" et ")}.`;
  return `Supprimer « ${name} » (${amount}) définitivement ?${tail}`;
}
