"use client";

import { MaintenanceBlock as Block } from "./maintenance-block";

/**
 * Les fiches terminales qui portent encore un statut de relance.
 *
 * Le cas signalé en usage : cycle « Perdu », statut saisi « Contacté — en
 * attente », parfois une relance encore programmée. Quatre affirmations sur la
 * même ligne, dont trois parlaient d'attente.
 *
 * Depuis le jalon 28, aucun chemin d'écriture ne peut plus produire cet état.
 * Ce bloc ne traite que l'existant, et devrait donc afficher zéro une fois
 * passé — c'est ce que dit son résumé.
 */
export interface TerminalPlan {
  total: number;
  rows: Array<{ label: string; lifecycle: string; status: string; hadReminder: boolean }>;
}

export function TerminalBlock({
  plan,
  busy,
  onApply,
}: {
  plan: TerminalPlan;
  busy: boolean;
  onApply: (operation: "terminal", expected: number, what: string) => void;
}) {
  return (
    <Block
      title="Fiches perdues au statut contradictoire"
      summary={`${plan.total} fiche(s) au cycle de vie terminal portant encore un statut de relance ou une échéance.`}
      hint="N'écrit que status, statusSetAt et nextReminder, et referme la tâche miroir de relance. Le cycle de vie, le motif de perte, les notes et l'historique ne sont pas touchés. La sauvegarde est téléchargée avant écriture."
      disabled={busy || plan.total === 0}
      onApply={() =>
        onApply(
          "terminal",
          plan.total,
          `Nettoyer le statut de ${plan.total} fiche(s) terminale(s). Une sauvegarde sera téléchargée.`,
        )
      }
    >
      {plan.rows.map((row, index) => (
        <li key={`${index}-${row.label}`} className="truncate">
          <b className="font-semibold">{row.label}</b>{" "}
          <span className="text-muted">({row.lifecycle})</span>
          {row.status !== "" && <> — statut « {row.status} »</>}
          {row.hadReminder && <span className="text-[#9A6410]"> · relance encore posée</span>}
        </li>
      ))}
    </Block>
  );
}
