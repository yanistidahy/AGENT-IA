/**
 * **Cette fiche est-elle une fiche de démonstration ?**
 *
 * La carte d'un départ écrivait « Données de démonstration : ni site ni société
 * liée » sur une vraie personne. Le libellé confondait deux choses qui n'ont
 * rien à voir : **ce qu'Alex avait sous la main pour nommer la boutique**
 * (`describeDemoSource`, jalon 68, dont la valeur est juste) et **la nature de
 * la fiche**. Lu sur un prospect réel, il fait douter de toute la file — on se
 * demande si le message est parti à un contact d'essai.
 *
 * La réponse est ici, et elle ne devine rien : elle ne repose que sur des faits
 * vérifiables.
 *
 * 1. **l'identifiant du jeu de démonstration.** `prisma/seed.ts` sème des
 *    identifiants courts et lisibles — `p1`, `c12` — là où une fiche réelle
 *    reçoit un `cuid` de vingt-cinq caractères. Une fiche qui porte l'un des
 *    premiers **est** une fiche du seed ;
 * 2. **un domaine réservé aux essais.** `.test`, `.example`, `.invalid`,
 *    `.localhost` et `example.com` / `example.org` sont réservés par la RFC 2606
 *    et la RFC 6761 : aucun courriel ne peut y arriver, donc une fiche qui en
 *    porte une n'est pas un prospect.
 *
 * **Tout le reste est une vraie fiche**, et c'est le bon sens de l'erreur : se
 * taire sur une fiche d'essai ne coûte rien, crier « démonstration » sur un
 * prospect coûte la confiance qu'on accorde à l'écran.
 */

/** Les identifiants du seed : une lettre, puis un petit nombre. */
const SEED_ID = /^[a-z]{1,3}\d{1,3}$/;

/** Réservés par la RFC 2606 et la RFC 6761 : rien n'y arrive jamais. */
const RESERVED_SUFFIXES = [".test", ".example", ".invalid", ".localhost"];
const RESERVED_DOMAINS = ["example.com", "example.org", "example.net"];

export function isSeedId(id: string): boolean {
  return SEED_ID.test(id.trim());
}

export function isReservedEmail(email: string): boolean {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  if (at === -1) return false;
  const host = email.trim().toLowerCase().slice(at + 1);
  if (host === "") return false;
  return (
    RESERVED_DOMAINS.includes(host) ||
    RESERVED_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix))
  );
}

export interface DemoDataInput {
  readonly id: string;
  readonly email: string;
}

export function isDemoContact(contact: DemoDataInput): boolean {
  return isSeedId(contact.id) || isReservedEmail(contact.email);
}
