import type { DealLike, DealStatus, StageLike } from "./types";

/**
 * Conséquences d'un déplacement d'affaire entre étapes.
 *
 * Fonction pure : la couche API applique le plan dans une transaction Prisma,
 * mais la règle métier se teste sans base.
 */
export interface StageMovePlan {
  readonly stageId: string;
  readonly status: DealStatus;
  readonly closedAt: Date | null;
  readonly lastActivityAt: Date;
  /** Texte de la note système consignée dans l'historique de l'affaire. */
  readonly note: string;
}

export function isWinStage(stage: StageLike): boolean {
  return stage.prob >= 100;
}

/**
 * Règles reprises du prototype :
 * — arriver sur une étape à 100 % gagne l'affaire et date la clôture ;
 * — une affaire perdue le reste tant qu'on ne la rouvre pas explicitement ;
 * — tout autre déplacement remet l'affaire en cours.
 *
 * Écart assumé : le prototype ne remettait pas `closedAt` à `null` en
 * rouvrant une affaire gagnée. Une affaire « en cours » portant une date de
 * clôture est incohérente et fausse le calcul du cycle de vente ; on l'efface.
 */
export function planStageMove(
  deal: DealLike,
  fromStage: StageLike | undefined,
  toStage: StageLike,
  now: Date,
): StageMovePlan {
  const note = `Étape modifiée : ${fromStage?.name ?? "inconnue"} → ${toStage.name}`;

  if (isWinStage(toStage)) {
    return {
      stageId: toStage.id,
      status: "won",
      closedAt: now,
      lastActivityAt: now,
      note,
    };
  }

  if (deal.status === "lost") {
    return {
      stageId: toStage.id,
      status: "lost",
      closedAt: deal.closedAt,
      lastActivityAt: now,
      note,
    };
  }

  return {
    stageId: toStage.id,
    status: "open",
    closedAt: null,
    lastActivityAt: now,
    note,
  };
}

/** Clôture explicite depuis la fiche : « Marquer perdue », « Marquer gagnée ». */
export function planClose(
  status: Exclude<DealStatus, "open">,
  now: Date,
): Omit<StageMovePlan, "stageId"> {
  return {
    status,
    closedAt: now,
    lastActivityAt: now,
    note: status === "won" ? "Affaire marquée gagnée" : "Affaire marquée perdue",
  };
}
