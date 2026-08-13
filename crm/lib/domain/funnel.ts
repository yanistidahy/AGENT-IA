/**
 * L'entonnoir de prospection.
 *
 * Avec zéro affaire, une courbe de revenu ne dessine qu'une ligne plate : elle
 * occupe l'écran sans rien apprendre. La seule forme qui dise quelque chose
 * aujourd'hui est celle-ci — **où les prospects fuient**. Elle nomme deux faits
 * en un coup d'œil : combien n'ont jamais été approchés, et que rien ne se
 * transforme encore en affaire.
 *
 * Le module est pur : il ne sait ni compter ni dessiner. Il reçoit cinq nombres
 * et rend des bandes ordonnées, avec leur taux de passage et leur lien. Le SVG
 * est écrit à la main dans le composant — aucune bibliothèque de graphiques.
 */

export interface FunnelInput {
  /** Toutes les fiches, perdues comprises : c'est le portefeuille réel. */
  readonly total: number;
  /** Au moins une interaction, jamais : approchés une fois dans leur vie. */
  readonly contacted: number;
  /** Interaction dans les sept derniers jours. */
  readonly thisWeek: number;
  /** Au moins un échange dont l'issue n'est ni vide ni « sans réponse ». */
  readonly answered: number;
  /** Affaires, tous statuts confondus. */
  readonly deals: number;
}

export interface FunnelBand {
  readonly key: "total" | "contacted" | "week" | "answered" | "deals";
  readonly label: string;
  readonly value: number;
  /** Vue filtrée correspondante. Une bande qui ne mène nulle part est décorative. */
  readonly href: string;
  /**
   * Part de la bande précédente, en pourcentage entier. `null` sur la première
   * bande, et quand la précédente vaut zéro — un taux sur zéro n'existe pas, il
   * ne vaut pas 0 %.
   */
  readonly rate: number | null;
  /** Largeur relative au portefeuille, entre 0 et 1. Sert au dessin. */
  readonly share: number;
}

/**
 * Taux de passage d'une bande à la suivante.
 *
 * `null` quand la bande de départ est vide. Renvoyer 0 % serait une affirmation
 * fausse : on ne mesure pas un échec de conversion, on n'a rien à convertir.
 */
export function conversionRate(from: number, to: number): number | null {
  if (from <= 0) return null;
  return Math.round((to / from) * 100);
}

const CONTACTS = "/contacts?lifecycle=all";

export function buildFunnel(input: FunnelInput): readonly FunnelBand[] {
  const steps: ReadonlyArray<Omit<FunnelBand, "rate" | "share">> = [
    { key: "total", label: "contacts", value: input.total, href: CONTACTS },
    {
      key: "contacted",
      label: "contactés",
      value: input.contacted,
      href: `${CONTACTS}&followUp=contacted`,
    },
    {
      key: "week",
      label: "cette semaine",
      value: input.thisWeek,
      href: `${CONTACTS}&followUp=recent`,
    },
    {
      key: "answered",
      label: "réponses",
      value: input.answered,
      href: `${CONTACTS}&followUp=answered`,
    },
    { key: "deals", label: "affaires", value: input.deals, href: "/affaires?status=all" },
  ];

  const base = input.total;
  return steps.map((step, index) => {
    const previous = steps[index - 1];
    return {
      ...step,
      rate: previous === undefined ? null : conversionRate(previous.value, step.value),
      // Bornée des deux côtés. En bas : sous 4 % du portefeuille une bande
      // garderait une largeur nulle et disparaîtrait, alors que « 0 affaire »
      // est précisément ce qu'il faut voir. En haut : une fiche peut porter
      // plusieurs affaires, donc la dernière bande peut dépasser la première —
      // sans plafond elle sortait du cadre et se dessinait hors de l'image.
      share: base <= 0 ? 0 : Math.min(Math.max(step.value / base, 0.04), 1),
    };
  });
}

/**
 * Le trou dans le haut de l'entonnoir : les fiches jamais approchées.
 *
 * Sorti à part parce que ce n'est pas une bande — c'est ce qui manque entre les
 * deux premières, et c'est le chiffre qui devrait piloter la semaine.
 */
export function neverApproached(input: FunnelInput): number {
  return Math.max(input.total - input.contacted, 0);
}

/** Lien vers les fiches jamais approchées. */
export const NEVER_APPROACHED_HREF = `${CONTACTS}&followUp=never`;
