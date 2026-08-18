import { isTerminal, optedOut } from "./lost";
import type { Lifecycle } from "./types";

/**
 * **Ce qui décide si un email de séquence a le droit de partir.**
 *
 * Tout est ici, pur et testable sans base : un envoi automatique est la moins
 * réversible des écritures du produit, et la règle qui l'autorise ne doit pas
 * dépendre d'un écran, d'un ordre d'appel ou d'un `if` recopié dans une route.
 *
 * Les deux invariants que ce module porte, et qu'aucun appelant ne peut
 * contourner :
 *
 * 1. **la règle est vérifiée à l'envoi, jamais à l'inscription.** Vérifier à
 *    l'inscription reviendrait à vérifier un état vieux de dix jours au moment
 *    où le message part — or c'est exactement dans cet intervalle que le
 *    prospect répond, se désabonne ou passe en `Perdu` ;
 * 2. **le silence n'autorise rien.** Chaque refus porte un motif écrit ; une
 *    séquence qui s'arrête sans dire pourquoi ressemble à une panne, et on la
 *    relance.
 */

/** Trois étapes au maximum. Décision produit, pas limite technique. */
export const MAX_STEPS = 3;

/** Départs validés à la main avant que le mode automatique se déverrouille. */
export const AUTO_MIN_VALIDATED = 20;

/**
 * Réponses obtenues avant que le mode automatique se déverrouille.
 *
 * **Une séquence validée vingt fois mais que personne n'a jamais honorée d'une
 * réponse n'est pas éprouvée : elle a seulement été tolérée.** C'est la
 * différence entre « je clique sans y penser » et « ça marche ».
 */
export const AUTO_MIN_REPLIES = 1;

/**
 * La première étape ne part jamais toute seule.
 *
 * Un premier message froid à quelqu'un qui n'a jamais entendu parler de nous
 * engage la réputation du domaine et l'image de l'expéditeur. Les relances,
 * elles, s'adressent à quelqu'un qu'on a déjà approché et dont on connaît le
 * dossier : c'est ce qui se gagne, pas le premier contact.
 */
export const FIRST_STEP_ALWAYS_MANUAL = 1;

export function autoAllowedForStep(step: number): boolean {
  return step > FIRST_STEP_ALWAYS_MANUAL;
}

/** Le week-end : aucune composition, aucun départ. */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Pourquoi un contact ne peut pas recevoir cette étape — `null` s'il le peut.
 *
 * L'ordre des tests n'est pas indifférent : on nomme d'abord ce qui arrête la
 * séquence définitivement, ensuite ce qui la met en pause. Le premier motif
 * rendu est celui qui sera écrit sur l'inscription, donc celui qu'on lira dans
 * six mois pour comprendre.
 */
export interface SequenceContact {
  readonly lifecycle: Lifecycle;
  readonly lostReason: string;
  readonly email: string;
}

export interface SequenceState {
  /** Une interaction à issue « a répondu », postérieure au dernier envoi. */
  readonly repliedAt: Date | null;
  /** Dernier envoi de la séquence, `null` si aucun. */
  readonly lastSentAt: Date | null;
  readonly lastStep: number;
}

export type BlockReason =
  | "terminal"
  | "optout"
  | "no-email"
  | "replied"
  | "finished"
  | "too-soon"
  | "weekend";

export const BLOCK_LABELS: Record<BlockReason, string> = {
  terminal: "Fiche close — la relation est terminée",
  optout: "Opposition au démarchage",
  "no-email": "Aucune adresse électronique sur la fiche",
  replied: "Le contact a répondu",
  finished: "Toutes les étapes ont été envoyées",
  "too-soon": "Le délai de l'étape n'est pas écoulé",
  weekend: "Aucun départ le samedi ni le dimanche",
};

/** Ces motifs **arrêtent** l'inscription ; les autres la mettent en attente. */
export const TERMINAL_BLOCKS: readonly BlockReason[] = [
  "terminal",
  "optout",
  "no-email",
  "replied",
  "finished",
];

export function stopsEnrollment(reason: BlockReason): boolean {
  return TERMINAL_BLOCKS.includes(reason);
}

/**
 * L'étape suivante d'une inscription, ou le motif qui l'empêche.
 *
 * `steps` est la liste ordonnée des délais. Le délai d'une étape court depuis
 * **l'envoi précédent**, pas depuis l'inscription : reporter un départ d'un jour
 * doit décaler la suite d'un jour, sinon reporter trois fois ferait partir deux
 * messages le même matin.
 */
export type NextStep =
  | { readonly ok: true; readonly step: number }
  | { readonly ok: false; readonly reason: BlockReason };

export function nextStep(
  contact: SequenceContact,
  state: SequenceState,
  steps: ReadonlyArray<{ readonly position: number; readonly delayDays: number }>,
  now: Date,
): NextStep {
  if (isTerminal(contact.lifecycle)) return { ok: false, reason: "terminal" };
  // L'opposition ferme vaut quel que soit le cycle de vie — règle du jalon 10,
  // portée par le domaine et non par un bouton grisé.
  if (optedOut(contact)) return { ok: false, reason: "optout" };
  if (contact.email.trim() === "") return { ok: false, reason: "no-email" };

  // **La réponse arrête tout**, et c'est la seule sécurité du système tant que
  // la détection est manuelle. Elle est testée avant le délai : un contact qui
  // a répondu ne doit pas rester « en attente de l'étape 2 ».
  if (state.repliedAt !== null) return { ok: false, reason: "replied" };

  const wanted = state.lastStep + 1;
  const step = steps.find((entry) => entry.position === wanted);
  if (step === undefined || wanted > MAX_STEPS) return { ok: false, reason: "finished" };

  if (isWeekend(now)) return { ok: false, reason: "weekend" };

  if (state.lastSentAt !== null) {
    const due = new Date(state.lastSentAt);
    due.setDate(due.getDate() + step.delayDays);
    if (now < due) return { ok: false, reason: "too-soon" };
  }

  return { ok: true, step: wanted };
}

/**
 * Le mode automatique est-il déverrouillé, et sinon pourquoi.
 *
 * Rendu à l'écran **et** vérifié au serveur avant chaque envoi automatique : un
 * interrupteur activé puis des conditions qui cessent d'être remplies ne doit
 * pas laisser la séquence partir toute seule. L'interrupteur exprime une
 * intention ; les conditions, un fait.
 */
export interface AutoUnlock {
  readonly unlocked: boolean;
  readonly validated: number;
  readonly replies: number;
  /** Ce qui manque, en une phrase. Vide quand c'est déverrouillé. */
  readonly reason: string;
}

export function autoUnlock(validated: number, replies: number): AutoUnlock {
  const missing: string[] = [];
  if (validated < AUTO_MIN_VALIDATED) {
    missing.push(
      `${AUTO_MIN_VALIDATED - validated} départ${
        AUTO_MIN_VALIDATED - validated > 1 ? "s" : ""
      } validé${AUTO_MIN_VALIDATED - validated > 1 ? "s" : ""} à la main`,
    );
  }
  if (replies < AUTO_MIN_REPLIES) {
    missing.push("au moins une réponse obtenue par cette séquence");
  }

  return {
    unlocked: missing.length === 0,
    validated,
    replies,
    reason:
      missing.length === 0
        ? ""
        : `Il manque ${missing.join(" et ")}. Une séquence validée vingt fois mais jamais répondue n'est pas éprouvée, elle est tolérée.`,
  };
}

/**
 * Ce départ peut-il partir sans validation humaine ?
 *
 * Trois conditions, toutes nécessaires — et la première est celle qu'on ne
 * négocie pas.
 */
export function canSendAutomatically(
  step: number,
  sequenceAutoMode: boolean,
  unlock: AutoUnlock,
): boolean {
  return autoAllowedForStep(step) && sequenceAutoMode && unlock.unlocked;
}
