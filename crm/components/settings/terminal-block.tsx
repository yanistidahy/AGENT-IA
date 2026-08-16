"use client";

import { MaintenanceBlock as Block } from "./maintenance-block";

/**
 * Les fiches terminales qui portent encore un statut de relance **en base**.
 *
 * **Ce bloc ne corrige pas l'affichage — l'affichage est déjà correct.** Depuis
 * le jalon 29, une fiche au cycle terminal n'affiche aucun statut de relance,
 * nulle part, quelle que soit la valeur stockée : la règle est appliquée à la
 * lecture, par `resolveDisplayStatus()`, sur toutes les surfaces à la fois.
 *
 * Ce qui reste ici est du rangement : la valeur périmée dort encore dans la
 * colonne. La laisser ne produit aucune contradiction visible ; l'effacer rend
 * simplement les exports et les requêtes directes aussi propres que l'écran.
 * C'est facultatif, et à faire quand on veut.
 *
 * La distinction n'est pas de la nuance : elle dit qu'on n'a **jamais** besoin
 * de cliquer ici pour qu'un écran cesse de mentir. Une consultation qui doit
 * écrire pour être juste est exactement ce qu'on a refusé aux agents.
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
      title="Rangement : statuts périmés des fiches terminales"
      summary={`${plan.total} fiche(s) au cycle de vie terminal gardant en base un statut de relance ou une échéance. Aucun de ces statuts n'est affiché nulle part : l'écran applique déjà la règle à la lecture.`}
      hint="Facultatif — c'est du rangement de données, pas un correctif d'affichage. N'écrit que status, statusSetAt et nextReminder, et referme la tâche miroir de relance. Le cycle de vie, le motif de perte, les notes et l'historique ne sont pas touchés. La sauvegarde est téléchargée avant écriture."
      disabled={busy || plan.total === 0}
      onApply={() =>
        onApply(
          "terminal",
          plan.total,
          `Ranger le statut stocké de ${plan.total} fiche(s) terminale(s). L’affichage est déjà correct sans cela. Une sauvegarde sera téléchargée.`,
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
