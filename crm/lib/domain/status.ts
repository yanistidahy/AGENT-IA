import { FOLLOW_UP_LABELS, needsAttention, type FollowUpStatus } from "./follow-up";
import { LOST_LIFECYCLE } from "./lost";
import type { Lifecycle } from "./types";

/**
 * Statut de relance **saisi**, et ce qui le propose.
 *
 * Le statut était entièrement dérivé jusqu'ici : calculé depuis les dates, donc
 * incapable de mentir, mais incapable aussi de dire ce qu'on vient d'apprendre.
 * Or le moment où l'on apprend quelque chose est celui où l'on raccroche — pas
 * un second passage sur la fiche, qu'on oublierait.
 *
 * D'où un champ stocké qui **l'emporte quand il est renseigné**, et le calcul
 * qui reprend la main quand il ne l'est pas. Les fiches jamais touchées gardent
 * donc exactement le comportement d'avant : ce changement n'invente aucune
 * information sur les contacts déjà en base.
 */

/**
 * Issues possibles d'un échange. Obligatoire à la saisie : c'est elle qui rend
 * le formulaire capable de proposer un statut, et sans elle on retomberait dans
 * le champ qu'on oublie de mettre à jour.
 */
export const OUTCOMES = [
  "no-answer",
  "interested",
  "later",
  "not-interested",
  "meeting",
  "wrong-person",
] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_LABELS: Record<Outcome, string> = {
  "no-answer": "Pas de réponse",
  interested: "Répondu — intéressé",
  later: "Répondu — à relancer plus tard",
  "not-interested": "Répondu — pas intéressé",
  meeting: "RDV obtenu",
  "wrong-person": "Mauvais interlocuteur",
};

export function isOutcome(value: string): value is Outcome {
  return OUTCOMES.some((candidate) => candidate === value);
}

/**
 * Statuts proposés à la saisie.
 *
 * Les quatre premiers sont les libellés calculés, repris tels quels pour qu'un
 * statut saisi et un statut calculé se lisent pareil. Les suivants n'ont pas
 * d'équivalent calculable — aucune date ne dit « intéressé ». Le champ reste
 * libre : la liste propose, elle ne contraint pas.
 */
export const STATUS_SUGGESTIONS: readonly string[] = [
  FOLLOW_UP_LABELS.due,
  FOLLOW_UP_LABELS.planned,
  FOLLOW_UP_LABELS.silent,
  FOLLOW_UP_LABELS.never,
  "Contacté — en attente",
  "Intéressé",
  "RDV pris",
  "Ne répond plus",
];

/** Statuts saisis qui appellent une action, au même titre que `due`/`silent`. */
const ATTENTION_LABELS: readonly string[] = [
  FOLLOW_UP_LABELS.due,
  FOLLOW_UP_LABELS.silent,
  "Ne répond plus",
];

export interface StatusLike {
  /** Statut saisi. Vide = on retombe sur le calcul. */
  readonly status: string;
  readonly followUp: FollowUpStatus;
}

export interface ResolvedStatus {
  readonly label: string;
  /** `stored` quand la valeur vient d'une saisie, `computed` sinon. */
  readonly source: "stored" | "computed";
  readonly attention: boolean;
}

/**
 * **Source unique du statut affiché**, partout : tableau des contacts, tiroir,
 * accueil, puces, portefeuille, outils du conseil.
 *
 * Un statut saisi l'emporte sur le calcul. C'est un choix : la personne qui a eu
 * l'interlocuteur au téléphone en sait plus que n'importe quelle règle sur des
 * dates. Le calcul reste le repli, et il redevient seul maître si le statut
 * saisi est effacé.
 */
export function resolveStatus(contact: StatusLike): ResolvedStatus {
  const stored = contact.status.trim();

  if (stored === "") {
    return {
      label: FOLLOW_UP_LABELS[contact.followUp],
      source: "computed",
      attention: needsAttention(contact.followUp),
    };
  }

  return {
    label: stored,
    source: "stored",
    // Un libellé libre est inconnu du domaine : il n'appelle pas d'attention
    // par défaut. Inventer une urgence à partir d'un mot qu'on ne comprend pas
    // serait pire que de n'en signaler aucune.
    attention: ATTENTION_LABELS.includes(stored),
  };
}

/**
 * Un statut saisi qui n'a pas bougé depuis une interaction plus récente.
 *
 * C'est le seul mode de défaillance du champ stocké : il fige une vérité datée.
 * La puce « Statut figé » les rassemble pour qu'on puisse les revoir — le champ
 * est rafraîchi par le travail, ce filtre est là pour les fois où il ne l'a pas
 * été.
 */
export function isStale(contact: {
  readonly status: string;
  readonly statusSetAt: Date | null;
  readonly lastActivityAt: Date | null;
}): boolean {
  if (contact.status.trim() === "") return false;
  if (contact.statusSetAt === null) return contact.lastActivityAt !== null;
  if (contact.lastActivityAt === null) return false;
  return contact.lastActivityAt > contact.statusSetAt;
}

/** Ce que le formulaire pré-remplit à partir de l'issue choisie. */
export interface OutcomeProposal {
  readonly status: string;
  readonly lifecycle: Lifecycle | null;
  /** Le motif de perte doit être demandé à l'écran. */
  readonly needsLostReason: boolean;
  /** L'échéance de relance mérite le curseur. */
  readonly focusReminder: boolean;
  /** Une relance n'a plus lieu d'être : la date est effacée. */
  readonly clearReminder: boolean;
}

/**
 * Traduction issue → proposition.
 *
 * Ce sont des **propositions** : chaque champ reste modifiable à l'écran avant
 * l'enregistrement. La fonction ne décide de rien toute seule, elle évite
 * seulement d'avoir à ressaisir ce qui découle de l'issue.
 */
export function proposalFor(outcome: Outcome): OutcomeProposal {
  const base = {
    lifecycle: null,
    needsLostReason: false,
    focusReminder: false,
    clearReminder: false,
  } as const;

  switch (outcome) {
    case "no-answer":
      return { ...base, status: "Ne répond plus" };
    case "interested":
      return { ...base, status: "Intéressé", lifecycle: "Prospect" };
    case "later":
      return { ...base, status: FOLLOW_UP_LABELS.planned, focusReminder: true };
    case "not-interested":
      return {
        ...base,
        status: "Perdu",
        lifecycle: LOST_LIFECYCLE,
        needsLostReason: true,
        // Une relance sur quelqu'un qui vient de dire non n'a plus d'objet.
        clearReminder: true,
      };
    case "meeting":
      return { ...base, status: "RDV pris", lifecycle: "Prospect" };
    case "wrong-person":
      return { ...base, status: "Contacté — en attente" };
  }
}

/**
 * Débordement de nom : une note avalée dans le champ nom à l'import.
 *
 * Deux signes, et ils suffisent : une longueur qu'aucun patronyme n'atteint, ou
 * une virgule — qui sépare presque toujours un nom d'un commentaire. On ne
 * corrige rien automatiquement ; on signale, et la correction est proposée.
 */
export const NAME_MAX = 40;

export function nameOverflow(value: string): boolean {
  return value.length > NAME_MAX || value.includes(",");
}

/**
 * Découpe un nom débordé en « nom conservé » + « ce qui part dans les notes ».
 *
 * La coupe se fait à la virgule quand il y en a une : c'est la frontière que la
 * personne a elle-même écrite. Sinon on coupe au dernier espace avant la limite,
 * pour ne pas trancher un mot en deux.
 */
export function splitOverflow(value: string): { kept: string; moved: string } {
  const comma = value.indexOf(",");
  if (comma > 0) {
    return { kept: value.slice(0, comma).trim(), moved: value.slice(comma + 1).trim() };
  }

  if (value.length <= NAME_MAX) return { kept: value.trim(), moved: "" };

  const cut = value.lastIndexOf(" ", NAME_MAX);
  const at = cut > 0 ? cut : NAME_MAX;
  return { kept: value.slice(0, at).trim(), moved: value.slice(at).trim() };
}
