import type { Lifecycle } from "./types";
import { addDays } from "./dates";

/**
 * La qualification, et ce qu'elle engage.
 *
 * `Qualifié` ne décrit pas notre activité mais **l'engagement du prospect** :
 * il a exprimé le désir de l'offre. Une démo faite ne qualifie personne ; une
 * demande de prix, si. C'est ce qui justifie qu'y passer crée une affaire —
 * à partir de là, il y a quelque chose à suivre, à chiffrer et à perdre.
 *
 * Le module est pur : il dit **quand** une affaire doit naître et **avec quoi**,
 * jamais comment l'écrire.
 */
export const QUALIFIED: Lifecycle = "Qualifié";

/** Issues d'interaction qui valent qualification — le prospect s'est engagé. */
export const QUALIFYING_OUTCOMES: readonly string[] = ["meeting", "interested"];

/**
 * Ce passage demande-t-il de créer une affaire ?
 *
 * Uniquement l'**entrée** dans `Qualifié`. Repasser d'un `Qualifié` à lui-même
 * ne crée rien : sans cette condition, chaque enregistrement de fiche
 * fabriquerait une affaire de plus.
 */
export function entersQualified(before: Lifecycle | null, after: Lifecycle): boolean {
  return after === QUALIFIED && before !== QUALIFIED;
}

/** L'issue consignée vaut-elle qualification ? */
export function outcomeQualifies(outcome: string): boolean {
  return QUALIFYING_OUTCOMES.includes(outcome);
}

export interface DealDraft {
  readonly name: string;
  readonly amount: number;
  readonly offer: string;
  readonly owner: string;
  readonly companyId: string | null;
  readonly contactId: string;
  readonly expectedClose: Date;
}

export interface QualificationInput {
  readonly contactId: string;
  readonly contactName: string;
  readonly companyId: string | null;
  readonly companyName: string | null;
  readonly owner: string;
  readonly amount: number;
  readonly offer: string;
}

/** Jours avant la clôture prévue, à défaut d'une date choisie. */
export const EXPECTED_CLOSE_DAYS = 30;

/**
 * L'affaire à créer, pré-remplie depuis la fiche.
 *
 * Le nom prend la société quand elle existe, et retombe sur la personne sinon :
 * « Assistant IA — (sans société) » n'aide personne à retrouver une ligne dans
 * une liste de trente.
 */
export function draftFromContact(input: QualificationInput, now: Date): DealDraft {
  const who = input.companyName ?? input.contactName;
  return {
    name: `${input.offer} — ${who}`.trim(),
    amount: input.amount,
    offer: input.offer,
    owner: input.owner,
    companyId: input.companyId,
    contactId: input.contactId,
    expectedClose: addDays(now, EXPECTED_CLOSE_DAYS),
  };
}

/**
 * Le montant est **obligatoire** et strictement positif.
 *
 * Une affaire à zéro euro pèse zéro dans le pipeline pondéré et dans la
 * prévision : elle serait invisible partout où elle compte, tout en existant.
 * Mieux vaut refuser la qualification que fabriquer une affaire fantôme.
 */
export function validAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Message unique du refus, pour que l'écran et l'API disent la même chose. */
export const AMOUNT_REQUIRED =
  "Le montant est obligatoire pour qualifier : une affaire à zéro pèserait zéro dans la prévision.";

/**
 * Ce qu'on répond quand une affaire ouverte existe déjà.
 *
 * Qualifier deux fois n'est pas une erreur de l'utilisateur — c'est ce qui
 * arrive quand un prospect confirme son intérêt une seconde fois. On ne crée
 * donc rien, on ne se plaint pas, et on montre où est l'affaire.
 */
export function alreadyQualified(dealName: string): string {
  return `Ce contact porte déjà une affaire ouverte — « ${dealName} ». Aucune seconde affaire n'a été créée.`;
}
