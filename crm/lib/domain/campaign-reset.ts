import { REMOVED } from "./campaign-members";

/**
 * **Réinitialiser une campagne : tout le monde revient à l'étape 1.**
 *
 * Ce n'est pas la réouverture du jalon 81, et la différence n'est pas de
 * degré. Rouvrir reprend quelqu'un **là où il en était** pour lui donner la
 * suite ; réinitialiser lui renvoie **un premier message**, avec le discours
 * d'aujourd'hui. Le second geste s'adresse donc à des gens qui se souviennent
 * peut-être du premier, et c'est ce qui décide de tout ce module :
 *
 * 1. **celui qui a répondu est exclu par défaut.** Une réponse est le signal
 *    que la campagne cherchait : lui renvoyer une accroche froide efface ce
 *    qu'on a obtenu. L'inclure reste possible, mais c'est une case à cocher,
 *    jamais l'inverse ;
 * 2. **celui qui a été retiré à la main reste dehors.** Le retrait est une
 *    décision de l'utilisateur sur une personne (jalon 70) ; un geste qui
 *    porte sur la campagne n'a pas à la défaire en silence ;
 * 3. **la phrase de confirmation dit ce qui va se lire chez le destinataire**,
 *    pas ce qui va s'écrire en base. « 52 inscriptions repassent à l'étape 1 »
 *    décrit une colonne ; « elles recevront un nouveau premier message » décrit
 *    ce que quelqu'un va lire.
 *
 * Ce qui n'est **jamais** touché : les envois passés, les interactions
 * consignées, la chronologie des fiches. Le passé n'est pas réécrit — un
 * chapitre s'ouvre, et c'est le `round` de l'inscription qui le porte.
 */

/** Ce qui empêche une inscription d'être ramenée à l'étape 1. */
export type ResetBlock = "removed" | "replied";

export const RESET_BLOCK_LABELS: Readonly<Record<ResetBlock, string>> = {
  removed: "retirée de la campagne à la main",
  replied: "a répondu",
};

export interface ResetCandidateLike {
  readonly status: string;
  readonly repliedAt: Date | null;
}

/**
 * Cette inscription est-elle reprise par la réinitialisation ?
 *
 * **Tous les états sauf deux**, et c'est délibéré : terminée, arrêtée pour
 * fiche close, arrêtée pour opposition, encore active — toutes décrivent où en
 * est *la séquence*, et la réinitialisation les recouvre par construction
 * puisqu'elle rouvre le premier message. Les garde-fous qui protègent la
 * personne ne disparaissent pas pour autant : cycle de vie terminal et
 * opposition au démarchage sont revérifiés **à l'envoi**, comme toujours
 * (`nextStep`), donc une fiche close ne recevra rien même remise à l'étape 1.
 *
 * Les deux exceptions sont celles qu'un garde-fou d'envoi ne rattraperait pas
 * comme il faut :
 *
 * - **retirée à la main** : rien ne l'arrêterait à l'envoi, et la ramener
 *   reviendrait à annuler le geste de quelqu'un sans le lui dire ;
 * - **a répondu** : le garde-fou existe, mais il agirait *après* coup, en
 *   silence, et l'écran aurait promis un message qui ne part pas. On le dit
 *   donc avant, et on laisse le choix.
 */
export function resettable(
  row: ResetCandidateLike,
  includeRepliers: boolean,
): { readonly ok: true } | { readonly ok: false; readonly block: ResetBlock } {
  if (row.status === REMOVED) return { ok: false, block: "removed" };
  if (row.repliedAt !== null && !includeRepliers) return { ok: false, block: "replied" };
  return { ok: true };
}

/**
 * Depuis quand une réponse compte pour **ce** tour.
 *
 * Le dernier envoi fait foi tant qu'il est le plus récent ; après une
 * réinitialisation, c'est elle qui devient l'ancre. Sans ce déplacement,
 * inclure volontairement quelqu'un qui a répondu n'aurait produit **aucun
 * brouillon** : la composition aurait retrouvé la réponse d'avant et arrêté
 * l'inscription, sans que rien ne contredise la confirmation qui venait de
 * promettre un message. Un écran qui promet et un moteur qui refuse, c'est le
 * défaut que le jalon 82 a payé.
 */
export function replyAnchor(
  lastSentAt: Date | null,
  resetAt: Date | null,
  enrolledAt: Date,
): Date {
  let anchor = enrolledAt;
  if (lastSentAt !== null && lastSentAt > anchor) anchor = lastSentAt;
  if (resetAt !== null && resetAt > anchor) anchor = resetAt;
  return anchor;
}

export interface ResetExclusion {
  readonly name: string;
  readonly block: ResetBlock;
}

export interface ResetPlan {
  /** Combien d'inscriptions repartiront à l'étape 1. */
  readonly included: number;
  /** Parmi elles, celles à qui un message est déjà parti. */
  readonly alreadyWritten: number;
  /** Ceux qui ont répondu, nommés — inclus ou non selon le choix. */
  readonly repliers: readonly string[];
  /** Ce qui reste dehors, avec son motif. */
  readonly excluded: readonly ResetExclusion[];
  /** Les repreneurs de réponse sont-ils compris dans `included` ? */
  readonly includeRepliers: boolean;
}

/**
 * La phrase que l'on lit **avant** de confirmer.
 *
 * Elle nomme le nombre, le fait que ces gens ont déjà été approchés, et la
 * façon dont cela peut se lire de l'autre côté. C'est la moitié du jalon : un
 * bouton qui recompose cinquante-deux premiers messages sans dire à quoi cela
 * ressemble chez le destinataire est un bouton qu'on clique une fois de trop.
 */
export function describeReset(plan: ResetPlan): string {
  if (plan.included === 0) {
    return "Aucune inscription ne sera réinitialisée.";
  }

  const people = `${plan.included} personne${plan.included > 1 ? "s" : ""}`;
  const verb = plan.included > 1 ? "seront ramenées" : "sera ramenée";
  const receive = plan.included > 1 ? "recevront" : "recevra";

  const already =
    plan.alreadyWritten === 0
      ? ""
      : ` y compris celle${plan.alreadyWritten > 1 ? "s" : ""} qui ${
          plan.alreadyWritten > 1 ? "ont" : "a"
        } déjà été contactée${plan.alreadyWritten > 1 ? "s" : ""} il y a plusieurs jours.` +
        " Cela peut se lire comme un second premier contact.";

  return `${people} ${verb} à l'étape 1 et ${receive} un nouveau premier message,${
    already === "" ? " avec les consignes d'aujourd'hui." : already
  }`;
}

/** Ce que la confirmation dit des exclus, ou une chaîne vide. */
export function describeResetExclusions(plan: ResetPlan): string {
  if (plan.excluded.length === 0) return "";
  const named = plan.excluded
    .slice(0, 12)
    .map((entry) => `${entry.name} (${RESET_BLOCK_LABELS[entry.block]})`)
    .join(", ");
  const rest = plan.excluded.length > 12 ? `, et ${plan.excluded.length - 12} autre(s)` : "";
  return `${plan.excluded.length} inscription${
    plan.excluded.length > 1 ? "s restent" : " reste"
  } en dehors : ${named}${rest}.`;
}

/**
 * L'avertissement propre aux réponses, séparé du reste.
 *
 * **Il est rendu même quand on les inclut**, et c'est alors qu'il compte le
 * plus : la case cochée, la phrase doit dire ce qu'on vient d'autoriser.
 */
export function describeRepliers(plan: ResetPlan): string {
  if (plan.repliers.length === 0) return "";
  const names = plan.repliers.slice(0, 12).join(", ");
  const rest = plan.repliers.length > 12 ? `, et ${plan.repliers.length - 12} autre(s)` : "";
  const who = `${plan.repliers.length} personne${plan.repliers.length > 1 ? "s ont" : " a"} répondu`;

  return plan.includeRepliers
    ? `${who} : ${names}${rest}. Vous avez choisi de ${
        plan.repliers.length > 1 ? "les inclure" : "l'inclure"
      } : ${
        plan.repliers.length > 1
          ? "elles recevront un nouveau premier message malgré leur réponse."
          : "elle recevra un nouveau premier message malgré sa réponse."
      }`
    : `${who} : ${names}${rest}. ${
        plan.repliers.length > 1 ? "Elles sont exclues" : "Elle est exclue"
      } par défaut — une réponse est le signal que la campagne cherchait, et un nouveau premier message l'effacerait.`;
}
