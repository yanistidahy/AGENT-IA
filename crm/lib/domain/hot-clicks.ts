/**
 * **Ce que vaut un clic qui rend un prospect « chaud ».**
 *
 * Le jalon 92 a fait du clic le seul signal d'intérêt fiable du produit, et il
 * avait raison de l'opposer à l'ouverture du pixel : aucun relais ne clique à la
 * livraison, donc aucune déduplication n'était nécessaire. Ce module mesure si
 * cette affirmation tient, **sans changer la règle** — c'est ce qui a été
 * demandé, et c'est aussi la discipline du jalon 43, qui a commencé par
 * instrumenter les ouvertures avant de décider quoi que ce soit.
 *
 * Deux formes de clic sont suspectes, et chacune a sa raison :
 *
 * 1. **moins de deux minutes après l'envoi.** Personne ne reçoit un message, le
 *    lit et suit son lien en deux minutes. C'est la signature d'une passerelle
 *    de sécurité qui déréférence les liens à la livraison — le même raisonnement
 *    que le seuil de trente secondes des ouvertures (jalon 43), avec une marge
 *    plus large parce qu'un clic coûte plus cher qu'une ouverture : il entre dans
 *    une file d'appels ;
 * 2. **plusieurs liens distincts dans la même seconde.** Un humain clique un
 *    lien. Deux liens de natures différentes à la même seconde désignent un
 *    automate qui suit tout ce qu'il trouve.
 *
 * Ce qui compte pour décider n'est pas le nombre de clics suspects mais le
 * nombre de **prospects qui n'ont que ça** : celui qui a aussi répondu, ou qui
 * est passé en Qualifié, reste chaud à bon droit.
 *
 * Module pur : l'horloge et les données sont injectées, rien ne touche Prisma.
 */

/** Le délai sous lequel un clic ne peut pas être humain. */
export const DELIVERY_CLICK_SECONDS = 120;

export type ClickVerdict = "solide" | "livraison" | "simultane";

export interface ClickFact {
  /** L'envoi dont ce clic suit un lien : deux envois sont deux lectures. */
  readonly sendId: string;
  /** `demo` | `video` — deux liens distincts du même message. */
  readonly kind: string;
  readonly at: Date;
  readonly sentAt: Date;
  /** La fiche touchée, ou `null` quand l'envoi n'en a plus (jalon 45). */
  readonly contactId: string | null;
}

export interface ClickAudit {
  readonly clicks: number;
  /** Clics classés `livraison` : trop rapides pour être humains. */
  readonly delivery: number;
  /** Clics classés `simultane` : plusieurs liens à la même seconde. */
  readonly simultaneous: number;
  /** Clics qui ne portent aucun des deux soupçons. */
  readonly solid: number;
  /** Les fiches dont **au moins un** clic est solide. */
  readonly solidContacts: readonly string[];
  /** Les fiches dont **tous** les clics sont suspects. */
  readonly suspectOnlyContacts: readonly string[];
}

/**
 * La seconde d'un clic, par envoi — la clé qui détecte la simultanéité.
 *
 * Par **envoi** et non par contact : deux messages différents peuvent
 * légitimement être lus dans la même seconde par deux personnes de la même
 * maison, et c'est le même message suivi deux fois qui trahit l'automate.
 */
function secondKey(click: ClickFact): string {
  return `${click.sendId}|${Math.floor(click.at.getTime() / 1000)}`;
}

export function clickVerdict(
  click: ClickFact,
  kindsInSameSecond: number,
  threshold = DELIVERY_CLICK_SECONDS,
): ClickVerdict {
  const delay = (click.at.getTime() - click.sentAt.getTime()) / 1000;
  if (delay < threshold) return "livraison";
  if (kindsInSameSecond > 1) return "simultane";
  return "solide";
}

/**
 * L'audit complet d'un jeu de clics.
 *
 * Un clic sans fiche rattachée est compté dans les totaux — c'est un fait sur la
 * qualité du signal — mais ne peut désigner aucun prospect : il n'y a personne à
 * rappeler. C'est la distinction du jalon 45 entre une réponse détectée et une
 * réponse consignée.
 */
export function auditClicks(
  clicks: readonly ClickFact[],
  threshold = DELIVERY_CLICK_SECONDS,
): ClickAudit {
  const kinds = new Map<string, Set<string>>();
  for (const click of clicks) {
    const key = secondKey(click);
    const set = kinds.get(key) ?? new Set<string>();
    set.add(click.kind);
    kinds.set(key, set);
  }

  const solid = new Set<string>();
  const suspect = new Set<string>();
  let delivery = 0;
  let simultaneous = 0;
  let clean = 0;

  for (const click of clicks) {
    const verdict = clickVerdict(click, kinds.get(secondKey(click))?.size ?? 1, threshold);
    if (verdict === "livraison") delivery += 1;
    else if (verdict === "simultane") simultaneous += 1;
    else clean += 1;

    if (click.contactId === null) continue;
    if (verdict === "solide") solid.add(click.contactId);
    else suspect.add(click.contactId);
  }

  return {
    clicks: clicks.length,
    delivery,
    simultaneous,
    solid: clean,
    solidContacts: [...solid],
    suspectOnlyContacts: [...suspect].filter((id) => !solid.has(id)),
  };
}

export interface HotAudit {
  /** Le total affiché par le produit — la règle actuelle, inchangée. */
  readonly total: number;
  /** Ceux qui tiennent sans aucun clic : une réponse, un passage en Qualifié. */
  readonly withoutClick: number;
  /** Ceux qui reposent sur au moins un clic qu'aucun soupçon ne touche. */
  readonly solidClick: number;
  /**
   * **Ceux qui ne reposent que sur un clic douteux.** C'est le seul nombre qui
   * décide : il dit ce que le total perdrait si la règle changeait.
   */
  readonly suspectOnly: number;
  readonly clicks: ClickAudit;
}

/**
 * Le compte des prospects chauds, décomposé par la solidité de son signal.
 *
 * `total` reste **exactement** ce que la règle actuelle rend : ce jalon mesure,
 * il ne retire personne de la file. Les trois autres nombres disent sur quoi ce
 * total repose.
 */
export function auditHot(
  clicks: readonly ClickFact[],
  contactsWithOtherSignal: readonly string[],
  threshold = DELIVERY_CLICK_SECONDS,
): HotAudit {
  const audit = auditClicks(clicks, threshold);
  const other = new Set(contactsWithOtherSignal);
  const solid = new Set(audit.solidContacts);
  const suspectOnly = audit.suspectOnlyContacts.filter((id) => !other.has(id));

  const total = new Set([...other, ...solid, ...audit.suspectOnlyContacts]);
  return {
    total: total.size,
    withoutClick: other.size,
    solidClick: [...solid].filter((id) => !other.has(id)).length,
    suspectOnly: suspectOnly.length,
    clicks: audit,
  };
}
