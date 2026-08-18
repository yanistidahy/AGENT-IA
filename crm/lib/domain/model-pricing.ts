/**
 * Ce que coûte un appel au modèle, et ce que chaque modèle sait faire.
 *
 * **Les tarifs et la ligne de modèles viennent de la référence de l'API**
 * (`platform.claude.com/docs/en/about-claude/models/overview`), relue le
 * 18 août 2026 — pas d'une valeur retenue de mémoire. La date est écrite
 * ci-dessous pour qu'on sache quand elle a cessé d'être fraîche.
 *
 * Le module est **pur** : aucun accès base, aucun réseau. C'est ce qui permet
 * de tester le calcul de coût sans clé, et de l'importer aussi bien depuis le
 * runtime serveur que depuis l'écran de réglages.
 */

/** Date de relecture de la référence. À reporter si les tarifs changent. */
export const PRICING_READ_AT = "2026-08-18";

/** Les quatre usages qui appellent le modèle. */
export const PURPOSES = ["draft", "revision", "chat", "shift"] as const;
export type Purpose = (typeof PURPOSES)[number];

export const PURPOSE_LABELS: Record<Purpose, string> = {
  draft: "Rédaction d'email",
  revision: "Reprise de brouillon",
  chat: "Conversation",
  shift: "Vacation",
};

export interface ModelSpec {
  readonly id: string;
  readonly label: string;
  /** Dollars par million de jetons d'entrée. */
  readonly input: number;
  /** Dollars par million de jetons de sortie — **la réflexion y est comprise**. */
  readonly output: number;
  /**
   * Le modèle accepte-t-il `thinking: {type: "adaptive"}` ?
   *
   * Haiku 4.5 ne le connaît pas : lui envoyer le champ renvoie un 400. Un
   * sélecteur de modèle qui ignorerait cette différence casserait la rédaction
   * au premier essai du modèle le moins cher — c'est-à-dire exactement celui
   * qu'on veut pouvoir essayer.
   */
  readonly adaptiveThinking: boolean;
  /** Le modèle accepte-t-il `output_config.effort` ? */
  readonly effort: boolean;
  /** Une phrase pour le sélecteur — pourquoi on le choisirait. */
  readonly note: string;
}

/**
 * Les modèles proposés, du moins cher au plus cher.
 *
 * La liste est volontairement courte : les modèles hérités (Opus 4.x, Sonnet
 * 4.6) coûtent le même prix que leur successeur ou davantage, les proposer
 * n'offrirait qu'une façon de payer autant pour moins bien.
 */
export const MODELS: readonly ModelSpec[] = [
  {
    id: "claude-haiku-4-5",
    label: "Haiku 4.5",
    input: 1,
    output: 5,
    adaptiveThinking: false,
    effort: false,
    note: "Le moins cher. Prose plus plate, pas de réflexion adaptative.",
  },
  {
    id: "claude-sonnet-5",
    label: "Sonnet 5",
    input: 2,
    output: 10,
    adaptiveThinking: true,
    effort: true,
    note: "Qualité proche d'Opus à la moitié du prix. Le bon défaut pour écrire.",
  },
  {
    id: "claude-opus-5",
    label: "Opus 5",
    input: 5,
    output: 25,
    adaptiveThinking: true,
    effort: true,
    note: "Le plus fort sur le raisonnement. À garder là où l'on juge.",
  },
  {
    id: "claude-fable-5",
    label: "Fable 5",
    input: 10,
    output: 50,
    adaptiveThinking: true,
    effort: true,
    note: "Capacité maximale, deux fois le prix d'Opus. Rarement justifié ici.",
  },
];

export function findModel(id: string): ModelSpec | null {
  return MODELS.find((model) => model.id === id) ?? null;
}

export function isKnownModel(id: string): boolean {
  return findModel(id) !== null;
}

/**
 * Les modèles par défaut, un par usage.
 *
 * **Rédaction et reprise : Sonnet 5.** Écrire un email à partir d'un dossier
 * fourni et de règles écrites n'est pas du raisonnement : c'est de la mise en
 * forme. Sonnet 5 est annoncé « proche d'Opus » et coûte 2,5 fois moins cher
 * des deux côtés. Haiku 4.5 coûte encore moitié moins, mais ces messages
 * partent à de vrais prospects sous le nom d'une vraie personne : c'est le
 * dernier endroit où rogner sur la prose. Il reste dans le sélecteur pour être
 * essayé sur trois brouillons, ce qui est la seule façon d'en juger.
 *
 * **Conversation : Sonnet 5.** Le milieu de gamme demandé.
 *
 * **Vacation : Opus 5.** Une vacation *juge* — elle décide ce qui mérite d'être
 * signalé, et une erreur de jugement quotidienne coûte plus cher que l'écart
 * de tarif.
 */
export const DEFAULT_MODELS: Record<Purpose, string> = {
  draft: "claude-sonnet-5",
  revision: "claude-sonnet-5",
  chat: "claude-sonnet-5",
  shift: "claude-opus-5",
};

export interface TokenUsage {
  readonly input: number;
  readonly output: number;
  /**
   * Jetons de réflexion, quand ils sont mesurables — sinon `null`.
   *
   * **Ils ne s'ajoutent pas à la sortie : ils en font partie.** L'API ne les
   * facture pas séparément et ne les isole pas quand `display: "omitted"`. Les
   * additionner au coût les compterait deux fois ; les afficher comme un zéro
   * ferait croire qu'il n'y en a pas. D'où `null` : « non ventilé par l'API ».
   */
  readonly thinking: number | null;
  readonly cacheRead: number;
  readonly cacheWrite: number;
}

export const NO_USAGE: TokenUsage = {
  input: 0,
  output: 0,
  thinking: null,
  cacheRead: 0,
  cacheWrite: 0,
};

/**
 * Le coût d'un appel, en **micro-dollars entiers**.
 *
 * Entier et non flottant : les coûts s'additionnent sur un mois entier, et une
 * somme de flottants dérive. Le micro-dollar donne quatre décimales de cent —
 * assez fin pour qu'un appel à 0,0002 $ ne s'arrondisse pas à rien.
 *
 * La lecture de cache est facturée un dixième du tarif d'entrée, l'écriture
 * 1,25 fois. Aucun appel du CRM ne pose de `cache_control` aujourd'hui : ces
 * deux termes valent zéro, et ils existent pour que le jour où l'on mettra le
 * prompt système en cache, le compteur reste juste.
 */
export function costMicros(modelId: string, usage: TokenUsage): number {
  const model = findModel(modelId);
  if (model === null) return 0;

  const perToken = (dollarsPerMillion: number, tokens: number): number =>
    (dollarsPerMillion * tokens) / 1_000_000;

  const dollars =
    perToken(model.input, usage.input) +
    perToken(model.output, usage.output) +
    perToken(model.input * 0.1, usage.cacheRead) +
    perToken(model.input * 1.25, usage.cacheWrite);

  return Math.round(dollars * 1_000_000);
}

/** « 0,1974 $ » — quatre décimales sous le cent, deux au-delà. */
export function formatCost(micros: number): string {
  const dollars = micros / 1_000_000;
  const digits = dollars >= 1 ? 2 : 4;
  return `${dollars.toFixed(digits).replace(".", ",")} $`;
}

/**
 * Ce qu'un appel devrait coûter, par usage, en micro-dollars.
 *
 * Ce ne sont pas des plafonds mais des ordres de grandeur : ils servent à
 * repérer l'appel qui coûte dix fois ce qu'il devrait — un contexte qui a
 * gonflé, une boucle d'outils qui tourne, un modèle changé par erreur.
 */
export const EXPECTED_MICROS: Record<Purpose, number> = {
  draft: 15_000,
  revision: 15_000,
  chat: 40_000,
  shift: 60_000,
};

/** Au-delà de ce multiple de l'attendu, l'appel est consigné comme anomalie. */
export const ANOMALY_FACTOR = 4;

export function isAnomalous(purpose: Purpose, micros: number): boolean {
  return micros > EXPECTED_MICROS[purpose] * ANOMALY_FACTOR;
}

/**
 * Où en est le mois par rapport au plafond.
 *
 * `null` quand aucun plafond n'est réglé : **zéro pour cent d'un plafond
 * inexistant n'existe pas**, et afficher une jauge vide laisserait croire à un
 * budget illimité mesuré. Même règle que les taux sans dénominateur du jalon 20.
 */
export interface BudgetState {
  readonly spentMicros: number;
  readonly ceilingMicros: number;
  readonly ratio: number;
  readonly level: "ok" | "warn" | "over";
}

export const BUDGET_WARN_RATIO = 0.8;

export function budgetState(spentMicros: number, ceilingMicros: number): BudgetState | null {
  if (ceilingMicros <= 0) return null;
  const ratio = spentMicros / ceilingMicros;
  const level = ratio >= 1 ? "over" : ratio >= BUDGET_WARN_RATIO ? "warn" : "ok";
  return { spentMicros, ceilingMicros, ratio, level };
}
