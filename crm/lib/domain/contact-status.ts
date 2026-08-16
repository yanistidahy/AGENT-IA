import {
  followUpStatus,
  type ContactFilter,
  type FollowUpLike,
  type FollowUpStatus,
  appliedInSql,
} from "./follow-up";
import { resolveStatus, type ResolvedStatus } from "./status";
import { isTerminal } from "./lost";
import type { Lifecycle, PilotageSettings } from "./types";

/**
 * **Le statut d'un contact se décide ici, et nulle part ailleurs.**
 *
 * Ce module existe parce que la logique avait dérivé en trois endroits qui ne
 * se parlaient plus :
 *
 * 1. la **pastille** affichait `resolveStatus()` — donc le statut saisi ;
 * 2. les **puces** filtraient sur `followUpStatus()` — donc le statut calculé,
 *    en ignorant complètement ce qui était saisi ;
 * 3. l'**accueil**, le **portefeuille** et les **outils du conseil**
 *    calculaient eux aussi, sans jamais lire le champ saisi.
 *
 * Résultat mesuré sur la base de vérification : 66 fiches portaient
 * « Jamais contacté » en base, la puce du même nom en renvoyait **2**, et
 * l'accueil affichait un statut différent de `/contacts` sur **110** fiches.
 *
 * Il est placé au-dessus de `follow-up.ts` (le calcul) et de `status.ts` (la
 * saisie) plutôt qu'entre les deux : ni l'un ni l'autre n'a besoin de connaître
 * son voisin, et l'ordre des dépendances reste acyclique.
 */

/**
 * Le nombre d'interactions qui compte pour un statut de relance.
 *
 * **Une note de correction n'est pas une prise de contact.** Les corrections de
 * données consignent une interaction par fiche pour expliquer ce qu'elles ont
 * écrit — c'est ce qui rend l'historique lisible six mois plus tard. Mais
 * `followUpStatus()` teste `activityCount === 0` pour dire « jamais contacté » :
 * en comptant ces notes, la correction qui écrit « Jamais contacté » se réfute
 * elle-même à la seconde où elle l'écrit.
 *
 * C'est exactement l'exclusion établie au jalon 22 pour les rapports de
 * prospection (`CORRECTION_OWNER`), qui n'avait jamais atteint le statut de
 * relance. Le champ porte donc désormais un nom qui dit ce qu'il compte.
 */
export interface ContactStatusLike extends FollowUpLike {
  /** Statut saisi. Vide = on retombe sur le calcul. */
  readonly status: string;
  /**
   * Le cycle de vie tranche avant tout le reste quand il est terminal.
   * Facultatif pour les appelants qui n'en disposent pas — ils obtiennent alors
   * l'ancien comportement, ce qui est correct pour un contact non terminal.
   */
  readonly lifecycle?: Lifecycle;
}

/**
 * Le statut d'un contact, saisi ou calculé, avec sa clé canonique.
 *
 * `key` est ce sur quoi les puces filtrent : un libellé saisi qui correspond à
 * un statut connu du domaine rend sa clé, un libellé libre rend `null`. Sans
 * cette clé, filtrer sur un statut saisi reviendrait à comparer des chaînes
 * libres — et « Contacté — en attente » n'a pas de clé, ce qui est un fait sur
 * le vocabulaire, pas un oubli.
 */
export function resolveContactStatus(
  contact: ContactStatusLike,
  settings: PilotageSettings,
  now: Date,
): ResolvedStatus | null {
  // **Le cycle de vie terminal l'emporte sur tout.** Une fiche « Perdu » n'est
  // pas « en attente » de quelque chose : elle n'attend rien. Rendre `null`
  // plutôt qu'un libellé permet aux vues de n'afficher **qu'une** pastille, et
  // aux puces de ne jamais la revendiquer.
  if (contact.lifecycle !== undefined && isTerminal(contact.lifecycle)) return null;

  return resolveStatus({ status: contact.status, followUp: followUpStatus(contact, settings, now) });
}

/**
 * **Ce que chaque puce sélectionne, décidé une seule fois.**
 *
 * Aucune vue ne réimplémente ce prédicat : `/contacts` l'appelle après lecture,
 * et le test de parité vérifie que toutes les surfaces s'accordent contact par
 * contact.
 *
 * Trois familles, et elles ne se mesurent pas de la même façon :
 *
 * - `reminder` porte sur une **date**, pas sur un statut : tout contact ayant
 *   une relance programmée, en retard ou non. C'est le pipeline de relances vu
 *   d'un coup, et c'est délibérément plus large que le statut `due`.
 * - `never` et `silent` portent sur le **statut résolu** — saisi s'il existe,
 *   calculé sinon. C'est le correctif de ce jalon : ils lisaient le calcul seul.
 * - le reste porte sur l'**historique des interactions**, que SQL tranche en une
 *   clause ; ils sont déjà appliqués en base et rendent `true` ici.
 */
export function matchesContactFilter(
  contact: ContactStatusLike,
  filter: ContactFilter,
  settings: PilotageSettings,
  now: Date,
): boolean {
  if (filter === "reminder") return contact.nextReminder !== null;

  // Déjà tranché en SQL : répondre « faux » ici viderait la liste.
  if (appliedInSql(filter)) return true;

  // Une fiche terminale n'appartient à aucune puce de statut de relance.
  return resolveContactStatus(contact, settings, now)?.key === filter;
}

/** La clé canonique du statut affiché, ou `null` pour un libellé libre. */
export function statusKey(
  contact: ContactStatusLike,
  settings: PilotageSettings,
  now: Date,
): FollowUpStatus | null {
  return resolveContactStatus(contact, settings, now)?.key ?? null;
}
