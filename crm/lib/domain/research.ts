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

/**
 * Pourquoi une recherche n'a rien donné. L'ordre est celui de la cause.
 *
 * **`failed` est séparé de `unreachable`, et c'est la leçon du jalon 74.** Les
 * deux produisaient le même repli générique et la même ligne à l'écran, si bien
 * qu'un appel refusé par l'API et une société sans site se lisaient pareil : on
 * cherchait la donnée manquante pendant que c'était la chaîne qui était cassée.
 *
 * - `no-domain` : la fiche ne porte aucune adresse. **Rien n'a été tenté.**
 * - `failed` : l'appel lui-même n'a pas abouti. `summary` porte la raison
 *   exacte, et c'est elle qu'il faut lire.
 * - `unreachable` : l'appel a abouti, le site n'a pas pu être lu.
 * - `thin` : le site a été lu, il n'apprend rien d'exploitable.
 */
export type ResearchGap = "no-domain" | "failed" | "unreachable" | "thin" | null;

export const GAP_LABELS: Readonly<Record<NonNullable<ResearchGap>, string>> = {
  "no-domain": "Aucun site connu sur la fiche ni sur la société",
  failed: "La recherche a échoué",
  unreachable: "Le site n'a pas pu être lu",
  thin: "Le site a été lu mais n'apprend rien d'exploitable",
};

/**
 * Une recherche échouée ne se garde pas trois mois.
 *
 * Un `failed` mis en cache comme un résultat gèle la société sur le repli
 * générique pour toute la fraîcheur — c'est-à-dire qu'une coupure d'une minute
 * coûte quatre-vingt-dix jours de messages tièdes, sans que rien ne le dise.
 * On réessaie donc au prochain brouillon, après une courte fenêtre qui évite de
 * rappeler l'API à chaque contact d'une même maison composé dans la foulée.
 */
export const RETRY_MINUTES = 30;

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
  return isStaleAt(research.fetchedAt, now, research.gap);
}

/**
 * La même règle, sur une date nue.
 *
 * L'estimation compte des sociétés à relire sans charger leurs faits : elle n'a
 * qu'une date sous la main, et la faire passer par un objet `Research`
 * incomplet demanderait une assertion de type, c'est-à-dire de mentir au
 * compilateur pour une question de fraîcheur.
 */
export function isStaleAt(fetchedAt: Date, now: Date, gap: ResearchGap = null): boolean {
  const age = now.getTime() - fetchedAt.getTime();
  if (gap === "failed") return age > RETRY_MINUTES * 60 * 1000;
  return age > FRESH_DAYS * 24 * 60 * 60 * 1000;
}

/* ------------------------------------------------------------------------ */

/**
 * **Ce que l'écran dit d'une recherche : une seule décision, deux surfaces.**
 *
 * Le tiroir de contact et la file des départs affichaient deux choses
 * différentes de la même recherche — l'un ne disait rien du tout. Ils rendent
 * désormais cette carte, et aucun des deux ne recompose la phrase : c'est la
 * discipline du panneau de rédaction (jalon 66) et de la signature (jalon 67),
 * appliquée à l'affichage de la recherche.
 *
 * Trois états, et ils doivent rester **distinguables d'un coup d'œil** :
 *
 * - `none` — aucune société rattachée, ou aucun site connu : rien n'a été
 *   tenté, et c'est la fiche qu'il faut compléter ;
 * - `failed` — la chaîne est cassée, et `detail` porte la raison exacte : c'est
 *   nous qu'il faut corriger, pas la fiche ;
 * - `read` — la lecture a eu lieu, et le nombre de sources le prouve.
 */
export type ResearchState = "none" | "failed" | "read";

export interface ResearchCard {
  readonly state: ResearchState;
  /** La ligne que l'écran affiche, déjà accordée. */
  readonly headline: string;
  /** La raison exacte d'un échec, ou le résumé d'une lecture. Vide sinon. */
  readonly detail: string;
  readonly sources: readonly ResearchSource[];
}

/**
 * La carte d'une recherche, ou de son absence.
 *
 * `null` veut dire « aucune société rattachée à cette fiche » : il n'y a même
 * pas de maison à documenter, ce qui n'est pas la même chose qu'une maison sans
 * site.
 */
export function researchCard(research: Research | null): ResearchCard {
  if (research === null) {
    return {
      state: "none",
      headline: "Aucune société rattachée à cette fiche",
      detail: "",
      sources: [],
    };
  }

  if (research.gap === "failed") {
    return {
      state: "failed",
      headline: "La recherche a échoué",
      // Sans la raison, un échec ressemble à une fiche incomplète — c'est
      // exactement la confusion qui a coûté une journée.
      detail: research.summary.trim() === "" ? "raison non enregistrée" : research.summary.trim(),
      sources: research.sources,
    };
  }

  if (research.gap === "no-domain") {
    return {
      state: "none",
      headline: "Aucun site connu sur la fiche",
      detail: "",
      sources: [],
    };
  }

  if (!isUsable(research)) {
    return {
      state: "failed",
      headline: "La recherche a échoué",
      detail:
        research.gap === null
          ? "le site a été lu mais aucun fait sourcé n'en est ressorti"
          : GAP_LABELS[research.gap].toLowerCase(),
      sources: research.sources,
    };
  }

  const count = research.sources.length;
  return {
    state: "read",
    headline: `Recherche effectuée, ${count} source${count > 1 ? "s" : ""} lue${count > 1 ? "s" : ""}`,
    detail: research.summary,
    sources: research.sources,
  };
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
