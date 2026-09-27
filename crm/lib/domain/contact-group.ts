import { containsWords, labelWords } from "./words";

/**
 * **Le groupe de fonction d'un contact : à qui on écrit, pas ce qu'il vaut.**
 *
 * On écrit à plusieurs personnes d'une même marque — le fondateur, le
 * marketing, le commercial — et le même paragraphe ne peut pas leur parler à
 * tous. Ce module range un intitulé libre (`Contact.title`) dans **quatre**
 * cases, et c'est tout ce qu'il fait : il ne lit aucune base, ne décide
 * d'aucun envoi, et sert **le même appel** à l'import, au recalcul et à la
 * fiche. Une garde statique l'impose : trois classements légèrement différents
 * mettraient la même personne dans trois groupes selon la porte d'entrée.
 *
 * ## Deux étages, et c'est toute la règle
 *
 * | Étage | Ce qu'il porte | Exemple |
 * |---|---|---|
 * | **spécifique** | le métier | `marketing`, `sales`, `CMO`, `directeur général` |
 * | **séniorité** | le rang | `fondateur`, `CEO`, `dirigeant` |
 *
 * **Le spécifique l'emporte toujours.** « Directeur marketing » est un poste de
 * marketing, « Directrice commerciale » un poste commercial, et seuls
 * « directeur général » / « directrice générale » — donc une expression
 * spécifique à deux mots, pas le mot « directeur » — rejoignent Direction.
 * Conséquence assumée et validée : **« Co-fondatrice & CMO » va en Marketing &
 * digital**, parce que `CMO` décrit ce qu'elle fait quand `co-fondatrice` décrit
 * son rang.
 *
 * À égalité de spécificité entre deux groupes, l'ordre est **Commercial >
 * Marketing & digital > Direction**, et les intitulés qui l'empruntent sont
 * listés par `ambiguousTitles()` pour être relus. Ce n'est pas un ordre de
 * valeur : c'est le groupe dont l'angle est le plus concret, donc le moins
 * coûteux s'il se trompe.
 *
 * ## Ce qui n'est jamais deviné
 *
 * L'appariement se fait **sur des mots entiers** (`words.ts`) : « coo » ne se
 * reconnaît pas dans « coordinatrice », ni « adv » dans « advertising ». Un
 * intitulé qu'aucun mot-clé ne couvre va dans **Autre** — pas dans le groupe
 * qui lui ressemble le plus. C'est l'interdit posé au jalon 25 sur les
 * domaines, et au jalon 53 sur les rôles : on ne range pas quelqu'un par
 * ressemblance orthographique.
 */

export const CONTACT_GROUPS = ["direction", "marketing", "commercial", "autre"] as const;
export type ContactGroup = (typeof CONTACT_GROUPS)[number];

export function isContactGroup(value: string): value is ContactGroup {
  return (CONTACT_GROUPS as readonly string[]).includes(value);
}

export const GROUP_LABELS: Record<ContactGroup, string> = {
  direction: "Direction",
  marketing: "Marketing & digital",
  commercial: "Commercial",
  autre: "Autre",
};

/**
 * D'où vient le groupe d'une fiche.
 *
 * **`none` n'est pas `autre`, et c'est la distinction qui compte.** Une fiche
 * jamais classée — toutes celles d'avant ce jalon, tant que le recalcul n'a pas
 * tourné — n'est pas « une fonction qu'aucun mot-clé ne couvre » : c'est une
 * fonction que **personne n'a encore lue**. Les confondre ferait d'un filtre
 * « Autre » une liste silencieusement fausse, et d'un compteur « Autre 150 » un
 * chiffre qui décrit notre retard plutôt que le portefeuille.
 */
export const GROUP_SOURCES = ["none", "auto", "manual"] as const;
export type GroupSource = (typeof GROUP_SOURCES)[number];

export function isGroupSource(value: string): value is GroupSource {
  return (GROUP_SOURCES as readonly string[]).includes(value);
}

/** Le libellé affiché, « Non classé » compris. */
export function groupLabel(group: string, source: string): string {
  if (source === "none") return "Non classé";
  return isContactGroup(group) ? GROUP_LABELS[group] : GROUP_LABELS.autre;
}

/* ------------------------------------------------------ les mots-clés ----- */

/**
 * Les mots-clés **spécifiques** : ils décrivent un métier.
 *
 * Écrits tels qu'on les prononce ; `words.ts` absorbe la casse, les accents et
 * la ponctuation. Une entrée à plusieurs mots exige la suite complète :
 * `directeur general` ne se déclenche pas sur « directeur » seul, ce qui est
 * précisément ce qui fait que « Directeur marketing » n'est pas de la Direction.
 */
const SPECIFIC: Record<ContactGroup, readonly string[]> = {
  direction: ["directeur general", "directrice generale", "chief of staff"],
  marketing: [
    "marketing",
    "communication",
    "brand",
    "cmo",
    "e commerce",
    "ecommerce",
    "digital",
    "growth",
    "social media",
    "community",
    "crm",
    "acquisition",
    "marketplace",
  ],
  commercial: [
    "commercial",
    "commerciale",
    "sales",
    "ventes",
    "wholesale",
    "business developer",
    "account manager",
    "developpement commercial",
    "adv",
  ],
  autre: [],
};

/**
 * Les mots-clés de **séniorité** : ils décrivent un rang.
 *
 * Ils ne portent que Direction, et ils ne gagnent que lorsque aucun mot-clé
 * spécifique ne s'applique. « Fondateur » seul est un dirigeant ; « Co-fondateur
 * & CMO » est un marketeur, et c'est ce que le destinataire lira.
 */
const SENIORITY: readonly string[] = [
  "fondateur",
  "fondatrice",
  "co fondateur",
  "co fondatrice",
  "cofondateur",
  "cofondatrice",
  "founder",
  "co founder",
  "cofounder",
  "ceo",
  "coo",
  "pdg",
  "dirigeant",
  "dirigeante",
  "president",
  "presidente",
  "gerant",
  "gerante",
];

/** L'ordre de départage, du plus concret au plus général. Documenté, pas subi. */
const TIE_BREAK: readonly ContactGroup[] = ["commercial", "marketing", "direction"];

export interface GroupVerdict {
  readonly group: ContactGroup;
  /** Le mot-clé qui a décidé — vide quand rien n'a été reconnu. */
  readonly matched: string;
  /** Deux groupes revendiquaient l'intitulé avec la même précision. */
  readonly ambiguous: boolean;
}

/** La meilleure correspondance d'un groupe : la suite de mots la plus longue. */
function bestMatch(haystack: readonly string[], keywords: readonly string[]): string {
  let best = "";
  for (const keyword of keywords) {
    const parts = labelWords(keyword);
    if (!containsWords(haystack, parts)) continue;
    if (parts.length > labelWords(best).length) best = keyword;
  }
  return best;
}

/**
 * Le groupe d'un intitulé.
 *
 * **La seule fonction de classification du produit.** Import, recalcul et fiche
 * l'appellent ; aucun écran ne recompose la règle.
 */
export function classifyTitle(title: string): GroupVerdict {
  const haystack = labelWords(title);
  if (haystack.length === 0) return { group: "autre", matched: "", ambiguous: false };

  // Étage 1 : le métier.
  const hits: { group: ContactGroup; keyword: string; size: number }[] = [];
  for (const group of CONTACT_GROUPS) {
    const keyword = bestMatch(haystack, SPECIFIC[group]);
    if (keyword !== "") hits.push({ group, keyword, size: labelWords(keyword).length });
  }

  if (hits.length > 0) {
    const longest = Math.max(...hits.map((hit) => hit.size));
    const finalists = hits.filter((hit) => hit.size === longest);
    const winner =
      finalists.length === 1
        ? finalists[0]
        : finalists.sort(
            (a, b) => TIE_BREAK.indexOf(a.group) - TIE_BREAK.indexOf(b.group),
          )[0];
    if (winner !== undefined) {
      return {
        group: winner.group,
        matched: winner.keyword,
        ambiguous: finalists.length > 1,
      };
    }
  }

  // Étage 2 : le rang, et lui seul mène à Direction.
  const senior = bestMatch(haystack, SENIORITY);
  if (senior !== "") return { group: "direction", matched: senior, ambiguous: false };

  return { group: "autre", matched: "", ambiguous: false };
}

/** Raccourci : le groupe seul. */
export function groupOfTitle(title: string): ContactGroup {
  return classifyTitle(title).group;
}

/**
 * Les intitulés qui ont emprunté l'ordre de départage.
 *
 * Ils sont **listés**, jamais tus : un intitulé rangé par convention plutôt que
 * par évidence mérite une relecture humaine, et c'est le seul endroit où la
 * classification fait un choix qu'elle ne peut pas justifier autrement.
 */
export function ambiguousTitles(titles: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  for (const title of titles) {
    if (classifyTitle(title).ambiguous) seen.add(title.trim());
  }
  return [...seen];
}
