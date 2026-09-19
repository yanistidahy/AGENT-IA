import { rate, type Rate } from "./email-stats";

/**
 * Les quatre nombres, lus comme une suite.
 *
 * Quatre cartes côte à côte se lisent comme quatre mesures indépendantes. Or
 * ce sont **les mêmes personnes à quatre moments** : on écrit, elles ouvrent,
 * elles répondent, elles acceptent un rendez-vous. Ce qui compte n'est donc
 * aucun des quatre nombres pris seul, mais **la chute entre deux**.
 *
 * Trois décisions portent tout ce module :
 *
 * 1. **L'unité est la personne, pas le message.** Relancer trois fois la même
 *    personne ne fait pas trois envois dans l'entonnoir : la réponse se compte
 *    déjà par personne depuis le jalon 37, et mélanger les deux unités ferait
 *    baisser le taux à chaque relance. Le nombre de messages reste affiché,
 *    comme repère, sous la première étape.
 * 2. **Une estimation ne devient jamais le dénominateur d'un fait.** Le taux de
 *    réponse se rapporte donc aux personnes écrites, pas à celles qui « ont
 *    ouvert » — sans quoi un fait constaté se retrouverait divisé par un
 *    chiffre dont on sait qu'il est surestimé, et le résultat serait faux dans
 *    un sens qu'on ne saurait plus nommer.
 * 3. **Pas de dénominateur, pas de taux** : `null`, jamais `0 %`. Règle du
 *    jalon 20, reprise sans exception.
 *
 * Module pur : la forme de l'entonnoir se teste sans base.
 */

/**
 * La mise en garde, en une ligne.
 *
 * Trois lignes d'avertissement sous un chiffre en gros, c'est plus de mise en
 * garde que de fait, et cela finit par ne plus être lu du tout. La version
 * longue reste accessible au survol — elle n'est pas supprimée, elle est
 * repliée.
 */
export const OPEN_RATE_SHORT = "Surestimé : l'image se charge sans qu'on ait lu.";

export type FunnelKey = "sent" | "opened" | "replied" | "meetings";

/**
 * Une étape d'entonnoir, telle que `FunnelRow` la rend.
 *
 * `key` est une chaîne libre depuis le jalon 40 : l'entonnoir inter-canaux de
 * « Ma performance » réutilise le même composant, avec ses propres étapes.
 */
export interface FunnelStep {
  readonly key: string;
  readonly label: string;
  /** Nombre de **personnes** à cette étape. */
  readonly count: number;
  /**
   * Ce que ce nombre vaut. `fact` est constaté ou saisi à la main ; `estimate`
   * est le taux d'ouverture, et l'écran ne doit jamais les afficher pareil.
   */
  readonly kind: "fact" | "estimate";
  /**
   * Conversion depuis l'étape de référence.
   *
   * `null` sur la première étape : **rien ne précède le sommet d'un
   * entonnoir**, et afficher « 100 % » y serait une tautologie déguisée en
   * mesure. Le `Rate` lui-même vaut `null` quand le dénominateur est nul.
   */
  readonly rate: Rate | null;
  /** Le dénominateur, nommé — « 45 % » sans « de quoi » n'apprend rien. */
  readonly rateOf: string;
  /** Personnes perdues entre l'étape précédente et celle-ci. `null` en tête. */
  readonly drop: number | null;
}

export interface FunnelInput {
  /** Personnes écrites — le sommet de l'entonnoir. */
  readonly written: number;
  /** Messages partis, tous destinataires confondus. Repère, pas étape. */
  readonly messages: number;
  /** Personnes dont au moins un message suivi a été chargé. Estimation. */
  readonly opened: number;
  /** Personnes suivies : le dénominateur honnête de l'ouverture. */
  readonly tracked: number;
  readonly replied: number;
  readonly meetings: number;
  /**
   * De quoi rapprocher le sommet de l'entonnoir du tableau qui suit.
   *
   * « Personnes écrites 52 » au-dessus d'un tableau de 55 lignes se lit comme
   * un écart inexpliqué, et l'on cesse de croire les deux. Quand la portée sait
   * combien de personnes sont listées et combien n'ont jamais rien reçu, la
   * première carte le dit — ce n'est pas un second calcul, c'est le même
   * nombre, nommé.
   */
  readonly roster?: {
    /** Inscrits tels que le tableau les liste (retraits de campagne exclus). */
    readonly listed: number;
    /** Parmi eux, ceux à qui aucun message n'est jamais parti. */
    readonly neverWritten: number;
  };
}

/**
 * L'entonnoir, dans l'ordre où il se lit.
 *
 * La chute est calculée sur les nombres tels quels, sans les lisser : une étape
 * qui remonte — plus de réponses que d'ouvertures, ce qui arrive quand
 * quelqu'un répond depuis un client qui ne charge pas les images — doit se voir
 * plutôt que d'être corrigée en silence. C'est même un signal utile : il dit
 * que l'estimation d'ouverture est basse ce mois-ci.
 */
/**
 * Ce que dit la première carte sous son nombre.
 *
 * Toujours les messages partis — un repère, pas une étape. Et, quand la portée
 * le sait, **l'écart avec le tableau** : « 52 sur 55 inscrits · 3 jamais
 * écrits ». C'est la phrase qui manquait : sans elle, deux nombres justes
 * affichés l'un au-dessus de l'autre se lisent comme une erreur.
 */
function writtenNote(input: FunnelInput): string {
  const messages = `${input.messages} message${input.messages > 1 ? "s" : ""} parti${
    input.messages > 1 ? "s" : ""
  }`;
  const roster = input.roster;
  if (roster === undefined) return messages;
  if (roster.neverWritten === 0) return `${messages} · ${roster.listed} inscrit${roster.listed > 1 ? "s" : ""}`;
  return `sur ${roster.listed} inscrits · ${roster.neverWritten} jamais écrit${
    roster.neverWritten > 1 ? "s" : ""
  } · ${messages}`;
}

export function buildFunnel(input: FunnelInput): readonly FunnelStep[] {
  return [
    {
      key: "sent",
      label: "Personnes écrites",
      count: input.written,
      kind: "fact",
      rate: null,
      rateOf: writtenNote(input),
      drop: null,
    },
    {
      key: "opened",
      label: "Ont ouvert (estimation)",
      count: input.opened,
      kind: "estimate",
      // Le dénominateur est le nombre de personnes **suivies**, pas écrites :
      // un message envoyé sans pixel n'avait aucune chance d'être compté, et
      // le faire entrer au dénominateur ferait baisser le taux pour une raison
      // qui n'a rien à voir avec le destinataire.
      rate: rate(input.opened, input.tracked),
      rateOf: "des personnes suivies",
      drop: input.tracked - input.opened,
    },
    {
      key: "replied",
      label: "Ont répondu",
      count: input.replied,
      kind: "fact",
      rate: rate(input.replied, input.written),
      rateOf: "des personnes écrites",
      drop: input.written - input.replied,
    },
    {
      key: "meetings",
      label: "Rendez-vous obtenus",
      count: input.meetings,
      kind: "fact",
      rate: rate(input.meetings, input.replied),
      rateOf: "de celles qui ont répondu",
      drop: input.replied - input.meetings,
    },
  ];
}
