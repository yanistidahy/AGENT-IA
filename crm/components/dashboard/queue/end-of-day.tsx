import { tomorrowLabel } from "@/lib/domain/progress";

/**
 * L'état de fin de journée.
 *
 * Une file vide méritait mieux qu'un haussement d'épaules. Selon qu'on a
 * travaillé ou qu'il n'y avait rien à faire, ce n'est pas la même nouvelle — et
 * la question qui suit est toujours « et demain ? ». La réponse est donnée sans
 * qu'on ait à la chercher ailleurs.
 */
export function EndOfDay({
  complete,
  done,
  tomorrow,
}: {
  complete: boolean;
  done: number;
  tomorrow: number;
}) {
  if (!complete) {
    return (
      <p className="rounded-card border border-dashed border-line px-3.5 py-4 text-[12.5px] text-muted">
        Rien à traiter : aucune relance due, aucune tâche en retard, aucune affaire en sommeil.{" "}
        {tomorrowLabel(tomorrow)}
      </p>
    );
  }

  return (
    <div className="rounded-card border border-[#B9E7DC] bg-win-l px-4 py-4">
      <p className="font-display text-[15px] font-semibold text-win-d">
        Journée terminée — {done} élément(s) traité(s).
      </p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-win-d/80">
        La file est vide. {tomorrowLabel(tomorrow)}
      </p>
    </div>
  );
}
