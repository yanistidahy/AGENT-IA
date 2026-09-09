/**
 * **Ce que va coûter une composition, dit avant de la lancer.**
 *
 * Composer cinquante brouillons, c'est cinquante appels au modèle. À deux
 * centimes pièce c'est un euro — sans importance une fois, désagréable en
 * découverte sur la facture. Le nombre s'affiche donc sur la confirmation,
 * **avant** le clic, jamais après.
 *
 * ## L'estimation apprend de ce qui a réellement été facturé
 *
 * Le compteur du jalon 36 enregistre une ligne par appel, avec ses jetons. On
 * s'en sert : la moyenne des brouillons **réellement composés sur ce modèle**
 * décrit mieux le prochain que n'importe quelle constante. Une valeur écrite en
 * dur cesserait d'être vraie au premier changement de prompt — et le prompt
 * d'Alex a grossi à chaque jalon.
 *
 * En dessous de `MIN_SAMPLE` appels, la moyenne ne décrit rien : trois
 * brouillons dont l'un a été tronqué donnent un chiffre qui ne se reproduira
 * pas. On retombe alors sur les repères mesurés au jalon 36 (audit du contexte
 * d'un brouillon), et **l'écran dit laquelle des deux sources il utilise** — une
 * estimation dont on ignore la provenance ne se conteste pas.
 */

/**
 * Repères du jalon 36, en l'absence d'historique.
 *
 * L'entrée vient de l'audit du contexte d'un brouillon (prompt système d'Alex,
 * dossier du contact, protocole) ; la sortie est un email d'une vingtaine de
 * lignes. Ce ne sont pas des chiffres inventés : ils ont été mesurés sur le fil.
 */
export const DEFAULT_DRAFT_TOKENS = { input: 3000, output: 1500 } as const;

/** En dessous, la moyenne mesurée ne décrit pas encore le prochain appel. */
export const MIN_SAMPLE = 3;

/**
 * Au-delà, on ne compose pas dans la requête.
 *
 * Dix brouillons tiennent dans un aller-retour ; cinquante n'y tiendraient pas
 * — le proxy couperait, et l'écran afficherait un échec sur un travail à moitié
 * fait. Au-delà, la composition part en arrière-plan et la file se remplit à
 * mesure.
 */
export const INLINE_MAX = 10;

export interface DraftSample {
  /** Nombre d'appels mesurés sur ce modèle, usage « brouillon ». */
  readonly calls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface CostEstimate {
  /** Combien de brouillons seront composés — donc combien d'appels. */
  readonly drafts: number;
  readonly micros: number;
  /** D'où viennent les jetons : mesurés chez nous, ou repères du jalon 36. */
  readonly source: "measured" | "default";
  readonly model: string;
  /** La composition tient-elle dans la requête, ou part-elle en arrière-plan ? */
  readonly background: boolean;
}

/**
 * L'estimation, en micro-dollars entiers.
 *
 * Entiers pour la même raison qu'au jalon 36 : une somme de flottants dérive,
 * et un coût affiché doit pouvoir s'additionner sans bouger.
 */
export function estimateComposition(input: {
  readonly drafts: number;
  readonly model: string;
  readonly sample: DraftSample | null;
  /** `costMicros` du modèle — injecté pour que ce module reste pur. */
  readonly price: (usage: { input: number; output: number }) => number;
}): CostEstimate {
  const usable =
    input.sample !== null && input.sample.calls >= MIN_SAMPLE
      ? { input: input.sample.inputTokens, output: input.sample.outputTokens }
      : null;

  const perDraft = usable ?? DEFAULT_DRAFT_TOKENS;
  const micros = Math.max(0, input.drafts) * input.price(perDraft);

  return {
    drafts: Math.max(0, input.drafts),
    micros: Math.round(micros),
    source: usable === null ? "default" : "measured",
    model: input.model,
    background: input.drafts > INLINE_MAX,
  };
}

/**
 * « ≈ 0,48 $ » — deux décimales, et jamais « 0,00 $ » pour un travail réel.
 *
 * Un coût arrondi à zéro se lit « gratuit », ce qui ferait composer sans y
 * penser. En dessous du centime on écrit « moins de 0,01 $ », qui est vrai et
 * ne promet pas la gratuité.
 */
export function describeCost(micros: number): string {
  if (micros <= 0) return "0,00 $";
  const dollars = micros / 1_000_000;
  if (dollars < 0.01) return "moins de 0,01 $";
  return `${dollars.toFixed(2).replace(".", ",")} $`;
}

/** La phrase de la confirmation, dans la langue du produit. */
export function describeEstimate(estimate: CostEstimate): string {
  if (estimate.drafts === 0) return "Aucun brouillon à composer : rien ne sera appelé.";

  const calls = `${estimate.drafts} appel${estimate.drafts > 1 ? "s" : ""} au modèle`;
  const basis =
    estimate.source === "measured"
      ? "d'après vos brouillons déjà facturés"
      : "d'après les repères du jalon 36, faute d'historique";

  return `${estimate.drafts} brouillon${estimate.drafts > 1 ? "s" : ""} à composer — ${calls}, environ ${describeCost(estimate.micros)} (${basis}, ${estimate.model}).`;
}
