"use client";

import { MaintenanceBlock as Block } from "./maintenance-block";

/**
 * Le report des statuts de la feuille, et les trois choses qu'il doit dire.
 *
 * Un bloc à part parce qu'il porte plus d'avertissements que les autres, et que
 * ces avertissements sont l'essentiel : ce qui est laissé de côté, ce que la
 * source se contredit elle-même, et ce que le report **ne fera pas**.
 */
export interface StatusPlan {
  total: number;
  unchanged: number;
  uncertain: number;
  conflicting: number;
  keepsReminder: number;
  byKind: { never: number; waiting: number; lost: number };
  touched: string[];
  warnings: string[];
  changes: Array<{
    label: string;
    fromStatus: string;
    toStatus: string;
    fromLifecycle: string;
    toLifecycle: string;
    toReason: string;
    uncertain: boolean;
    conflicting: boolean;
    keepsReminder: boolean;
  }>;
}

export function StatusesBlock({
  plan,
  busy,
  onApply,
}: {
  plan: StatusPlan;
  busy: boolean;
  onApply: (operation: "statuses", expected: number, what: string) => void;
}) {
  return (
    <Block
      title="Statuts depuis la feuille"
      summary={`${plan.total} fiche(s) — ${plan.byKind.never} « Jamais contacté », ${plan.byKind.waiting} « Contacté — en attente », ${plan.byKind.lost} perdu(s). ${plan.unchanged} déjà à jour, ${plan.touched.length} laissée(s) de côté.`}
      hint="N'écrit que status, statusSetAt, lifecycle et lostReason. Les fiches travaillées depuis l'enregistrement de la feuille sont laissées intactes et listées ci-dessous. Une interaction est consignée par fiche, et la sauvegarde est téléchargée avant écriture."
      disabled={busy || plan.total === 0}
      onApply={() =>
        onApply(
          "statuses",
          plan.total,
          `Reporter le statut de ${plan.total} fiche(s) depuis la feuille. Une sauvegarde sera téléchargée.`,
        )
      }
    >
      {plan.keepsReminder > 0 && (
        <li className="text-[#9A6410]">
          ⚠ {plan.keepsReminder} fiche(s) passant à « Jamais contacté » portent
          encore une relance programmée. Le report ne touche pas ce champ : elles
          continueront d'apparaître dans les listes de relance.
        </li>
      )}
      {plan.conflicting > 0 && (
        <li className="text-[#9A6410]">
          ⚠ {plan.conflicting} ligne(s) de la feuille disent « À contacter » et
          « Pas intéressé » à la fois — tranchées en faveur du refus.
        </li>
      )}
      {plan.touched.map((row) => (
        <li key={row} className="text-muted">
          ⏸ laissée intacte — {row}
        </li>
      ))}
      {plan.warnings.map((warning) => (
        <li key={warning} className="text-[#9A6410]">
          ⚠ {warning}
        </li>
      ))}
      {plan.changes.map((change, index) => (
        <li key={`${index}-${change.label}`}>
          <b className="font-semibold">{change.label}</b> — statut «{" "}
          {change.fromStatus === "" ? "vide" : change.fromStatus} » → «{" "}
          {change.toStatus === "" ? "vide" : change.toStatus} »
          {change.fromLifecycle !== change.toLifecycle &&
            ` · cycle ${change.fromLifecycle} → ${change.toLifecycle}`}
          {change.toReason !== "" && ` · ${change.toReason}`}
          {change.uncertain && <span className="text-[#9A6410]"> [incertain]</span>}
          {change.keepsReminder && <span className="text-[#9A6410]"> [relance conservée]</span>}
        </li>
      ))}
    </Block>
  );
}
