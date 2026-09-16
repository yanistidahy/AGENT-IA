/**
 * Ce qu'Alex a lu sur un prospect, et ce qu'il a le droit d'en écrire.
 *
 * **La règle qui décide de tout ce module : un fait sur le prospect vient
 * d'une page lue, ou il ne s'écrit pas.** Un brouillon qui parle de « votre
 * gamme de probiotiques » à une marque de bougies ne coûte pas un email, il
 * coûte le prospect — définitivement. La recherche ajoute de la précision ;
 * elle n'ajoute jamais de licence à supposer.
 *
 * D'où la forme retenue : la recherche ne rend pas une prose libre mais des
 * **faits attribués**, chacun avec la source qui le porte. Une prose libre se
 * recopie sans qu'on sache ce qui vient de la page et ce qui vient du modèle ;
 * un fait porte son URL, et la carte de départ peut le montrer.
 */

/** Pourquoi une recherche n'a rien donné. L'ordre est celui de la cause. */
export type ResearchGap = "no-domain" | "unreachable" | "thin" | null;

export const GAP_LABELS: Readonly<Record<NonNullable<ResearchGap>, string>> = {
  "no-domain": "Aucun site connu sur la fiche ni sur la société",
  unreachable: "Le site n'a pas pu être lu",
  thin: "Le site a été lu mais n'apprend rien d'exploitable",
};

export interface ResearchSource {
  readonly url: string;
  readonly title: string;
}

export interface ResearchFact {
  /** Ce que le fait décrit : « produit », « modèle », « positionnement »… */
  readonly label: string;
  /** Le fait lui-même, en une phrase. */
  readonly detail: string;
  /** La page d'où il vient. Vide est refusé — voir `usableFacts`. */
  readonly sourceUrl: string;
}

export interface Research {
  readonly gap: ResearchGap;
  /** Une ligne : ce qu'Alex a appris. C'est elle que la carte affiche. */
  readonly summary: string;
  readonly facts: readonly ResearchFact[];
  readonly sources: readonly ResearchSource[];
  readonly fetchedAt: Date;
}

/**
 * Un fait sans source n'est pas un fait.
 *
 * Le modèle peut rendre un fait parfaitement plausible sans l'avoir lu nulle
 * part — c'est précisément le mode de défaillance qu'on craint. Le filtre est
 * donc structurel : pas d'URL, pas de fait, et la décision se prend avant que
 * quoi que ce soit n'atteigne le prompt de rédaction.
 */
export function usableFacts(facts: readonly ResearchFact[]): ResearchFact[] {
  return facts.filter(
    (fact) =>
      fact.detail.trim() !== "" &&
      fact.sourceUrl.trim() !== "" &&
      /^https?:\/\//i.test(fact.sourceUrl.trim()),
  );
}

/**
 * La recherche a-t-elle de quoi rendre un brouillon plus précis ?
 *
 * **Deux faits, pas un.** Un seul fait produit l'accroche générique qu'on
 * cherche à quitter (« j'ai vu que vous vendez des compléments ») : il faut le
 * produit *et* quelque chose autour — le modèle d'affaires, le positionnement,
 * l'hésitation qu'il crée — pour que le paragraphe dise quelque chose que le
 * prospect reconnaisse comme le concernant.
 */
export function isUsable(research: Research): boolean {
  return research.gap === null && usableFacts(research.facts).length >= 2;
}

/** La fraîcheur : au-delà, on relit le site. */
export const FRESH_DAYS = 90;

/**
 * Une recherche périmée est **utilisée quand même**, et rafraîchie à part.
 *
 * Refuser de s'en servir ferait retomber le brouillon en générique parce qu'une
 * lecture a trois mois — alors qu'une marque change rarement de métier en un
 * trimestre. Ce que la péremption déclenche, c'est une nouvelle lecture, pas un
 * appauvrissement du message.
 */
export function isStale(research: Research, now: Date): boolean {
  return isStaleAt(research.fetchedAt, now);
}

/**
 * La même règle, sur une date nue.
 *
 * L'estimation compte des sociétés à relire sans charger leurs faits : elle n'a
 * qu'une date sous la main, et la faire passer par un objet `Research`
 * incomplet demanderait une assertion de type, c'est-à-dire de mentir au
 * compilateur pour une question de fraîcheur.
 */
export function isStaleAt(fetchedAt: Date, now: Date): boolean {
  const age = now.getTime() - fetchedAt.getTime();
  return age > FRESH_DAYS * 24 * 60 * 60 * 1000;
}

/* ------------------------------------------------------------------------ */

/**
 * **Le garde-fou : une affirmation produit sans source correspondante.**
 *
 * Même famille que la garde du tiret long et celle de la signature : une
 * consigne de prompt est une intention, et « presque toujours » ne suffit pas
 * quand le prix d'un écart est le prospect. Celle-ci ne réécrit rien — elle
 * **signale**, parce qu'un remplacement automatique dans un texte commercial
 * ferait plus de dégâts qu'il n'en répare.
 *
 * Le contrôle est volontairement **étroit** : il porte sur le vocabulaire
 * concret — les noms de catégorie de produit — et non sur toute phrase. Une
 * garde large signalerait chaque brouillon, et une alerte qui sonne toujours
 * est une alerte qu'on apprend à ignorer (leçon du jalon 62).
 */

/** Ce qui compte comme une affirmation produit, au singulier comme au pluriel. */
const CATEGORY_WORDS = [
  "probiotique",
  "complement",
  "complements alimentaires",
  "cosmetique",
  "bougie",
  "parfum",
  "vitamine",
  "creme",
  "serum",
  "shampoing",
  "the",
  "cafe",
  "bijou",
  "montre",
  "lunette",
  "chaussure",
  "vetement",
  "lingerie",
  "maquillage",
  "soin",
  "huile",
  "gelule",
  "boisson",
  "snack",
  "jouet",
  "couche",
  "matelas",
  "sac",
  "abonnement",
];

export interface Ungrounded {
  readonly word: string;
  /** La phrase du brouillon qui le porte, pour que l'écran montre où regarder. */
  readonly sentence: string;
}

const fold = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * Les affirmations produit du brouillon absentes de ce qui a été lu.
 *
 * `corpus` est **tout ce qu'Alex a réellement lu** — le texte des pages, pas
 * son résumé : un résumé aurait déjà perdu le mot qu'on cherche, et la garde
 * signalerait un fait pourtant exact.
 */
export function ungroundedClaims(body: string, corpus: string): Ungrounded[] {
  const haystack = fold(corpus);
  const found: Ungrounded[] = [];

  for (const sentence of body.split(/(?<=[.!?])\s+|\n+/)) {
    const folded = fold(sentence);
    for (const word of CATEGORY_WORDS) {
      // Le mot doit être entier : « the » ne doit pas se reconnaître dans
      // « théorie », ni « sac » dans « sachant ».
      const pattern = new RegExp(`(^|[^a-z])${word}s?([^a-z]|$)`);
      if (!pattern.test(folded)) continue;
      if (haystack.includes(word)) continue;
      if (found.some((entry) => entry.word === word)) continue;
      found.push({ word, sentence: sentence.trim() });
    }
  }
  return found;
}

/** La phrase d'alerte, quand il y en a une. */
export function describeUngrounded(claims: readonly Ungrounded[]): string | null {
  if (claims.length === 0) return null;
  const words = claims.map((claim) => `« ${claim.word} »`).join(", ");
  return `À vérifier avant d'envoyer : ${words} ${
    claims.length > 1 ? "n'apparaissent" : "n'apparaît"
  } dans aucune des pages lues. Relisez la phrase concernée.`;
}
