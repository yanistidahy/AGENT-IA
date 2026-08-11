import { daysBetween } from "./dates";
import { median } from "./prospecting";
import type { StageLike } from "./types";

/**
 * Où les affaires avancent, et où elles stagnent.
 *
 * `lib/domain/kpis.ts` mesure déjà le résultat — chiffre d'affaires, taux de
 * gain, cycle. Ce module mesure le **chemin** : combien d'affaires passent d'une
 * étape à la suivante, et combien de temps elles y restent. C'est la seule façon
 * de répondre à « où est-ce que ça coince ? » autrement qu'à l'intuition.
 *
 * Les durées se lisent dans les visites d'étape (`deal_stage_visits`) : une
 * ligne à chaque entrée, la durée d'un passage étant l'écart avec l'entrée
 * suivante. Les affaires antérieures à cette table n'ont qu'une visite
 * reconstituée — leurs passages précédents n'ont jamais été enregistrés — et
 * l'écran doit dire sur combien de passages une moyenne repose.
 */

export interface VisitLike {
  readonly dealId: string;
  readonly stageId: string;
  readonly enteredAt: Date;
}

export interface StageFlow {
  readonly stageId: string;
  readonly name: string;
  /** Affaires ayant traversé l'étape, un passage par affaire au plus. */
  readonly entered: number;
  /** Parmi elles, celles qui ont atteint une étape plus avancée. */
  readonly advanced: number;
  /** `null` quand personne n'y est entré : un taux sur zéro n'existe pas. */
  readonly conversion: number | null;
  /** Médiane des durées de passage, en jours. `null` sans passage terminé. */
  readonly medianDays: number | null;
  /** Nombre de passages **terminés**, sur lequel la médiane repose. */
  readonly measured: number;
}

/**
 * Le parcours étape par étape.
 *
 * Une affaire qui recule puis avance à nouveau compte **une** entrée par
 * étape : sinon un aller-retour gonflerait le dénominateur et ferait chuter la
 * conversion sans que rien n'ait empiré.
 *
 * « Avancé » se juge sur la position de l'étape la plus avancée atteinte, pas
 * sur l'étape actuelle : une affaire revenue en arrière est bien passée par la
 * suivante, et l'oublier sous-estimerait la conversion.
 */
export function stageFlow(
  visits: readonly VisitLike[],
  stages: readonly StageLike[],
  now: Date,
): readonly StageFlow[] {
  const position = new Map(stages.map((stage) => [stage.id, stage.position]));

  // Passages par affaire, dans l'ordre chronologique.
  const byDeal = new Map<string, VisitLike[]>();
  for (const visit of visits) {
    byDeal.set(visit.dealId, [...(byDeal.get(visit.dealId) ?? []), visit]);
  }
  for (const [id, list] of byDeal) {
    byDeal.set(id, [...list].sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime()));
  }

  const entered = new Map<string, Set<string>>();
  const advanced = new Map<string, Set<string>>();
  const durations = new Map<string, number[]>();

  for (const [dealId, list] of byDeal) {
    const best = Math.max(
      ...list.map((visit) => position.get(visit.stageId) ?? -1),
      -1,
    );

    list.forEach((visit, index) => {
      const set = entered.get(visit.stageId) ?? new Set<string>();
      set.add(dealId);
      entered.set(visit.stageId, set);

      const here = position.get(visit.stageId);
      if (here !== undefined && best > here) {
        const moved = advanced.get(visit.stageId) ?? new Set<string>();
        moved.add(dealId);
        advanced.set(visit.stageId, moved);
      }

      // Seuls les passages **terminés** entrent dans la durée : le passage en
      // cours mesurerait « depuis quand elle est là », pas « combien de temps
      // elle y reste », et tirerait toutes les moyennes vers le bas.
      const next = list[index + 1];
      if (next !== undefined) {
        const days = Math.max(daysBetween(visit.enteredAt, next.enteredAt), 0);
        durations.set(visit.stageId, [...(durations.get(visit.stageId) ?? []), days]);
      }
    });
  }

  void now;

  return stages.map((stage) => {
    const seen = entered.get(stage.id)?.size ?? 0;
    const moved = advanced.get(stage.id)?.size ?? 0;
    const spans = durations.get(stage.id) ?? [];
    return {
      stageId: stage.id,
      name: stage.name,
      entered: seen,
      advanced: moved,
      conversion: seen === 0 ? null : Math.round((moved / seen) * 100),
      medianDays: median(spans),
      measured: spans.length,
    };
  });
}

/**
 * Taux de lapin entre deux étapes nommées.
 *
 * Rendu comme la part de ceux qui **ne** sont pas venus : c'est le chiffre qui
 * appelle une action, là où « 78 % de présence » se lit comme une réussite.
 * `null` si l'étape de départ n'existe pas ou n'a reçu personne.
 */
export function noShowRate(
  flows: readonly StageFlow[],
  fromStage: string,
  toStage: string,
): { readonly planned: number; readonly held: number; readonly rate: number | null } | null {
  const from = flows.find((flow) => flow.name === fromStage);
  const to = flows.find((flow) => flow.name === toStage);
  if (from === undefined || to === undefined) return null;
  if (from.entered === 0) return { planned: 0, held: 0, rate: null };

  const held = Math.min(to.entered, from.entered);
  return {
    planned: from.entered,
    held,
    rate: Math.round(((from.entered - held) / from.entered) * 100),
  };
}

export interface VelocityLike {
  readonly createdAt: Date;
  readonly closedAt: Date | null;
  readonly status: string;
}

/**
 * Jours entre l'ouverture d'une affaire et sa signature.
 *
 * Depuis que la qualification crée l'affaire, `createdAt` **est** la date de
 * qualification : la vélocité mesure donc bien « qualifié → gagné ». Pour les
 * affaires antérieures, `createdAt` est la date de saisie, ce qui n'est pas la
 * même chose — la mesure ne devient exacte qu'avec les affaires nées de la
 * qualification, et c'est à l'écran de le dire.
 */
export function velocityDays(deals: readonly VelocityLike[]): {
  readonly medianDays: number | null;
  readonly measured: number;
} {
  const spans = deals
    .filter((deal) => deal.status === "won" && deal.closedAt !== null)
    .map((deal) => Math.max(daysBetween(deal.createdAt, deal.closedAt as Date), 0));
  return { medianDays: median(spans), measured: spans.length };
}
