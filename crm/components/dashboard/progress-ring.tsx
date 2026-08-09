import { ringDash, progressLabel, type DayProgress } from "@/lib/domain/progress";

/**
 * L'anneau d'avancement du jour.
 *
 * SVG écrit à la main, comme tous les graphiques du projet : deux cercles
 * concentriques et un `stroke-dasharray`, ce qui ne justifie pas une
 * bibliothèque de trois cents kilooctets.
 *
 * Le cercle SVG démarre à trois heures ; la rotation d'un quart de tour le fait
 * partir du haut, ce que tout le monde attend d'une jauge. Le texte central est
 * `aria-hidden` et l'information passe par un libellé complet — « 4/11 » lu à
 * voix haute ne veut rien dire.
 */
const RADIUS = 26;
const SIZE = 64;

export function ProgressRing({ progress }: { progress: DayProgress }) {
  const dash = ringDash(progress.ratio, RADIUS);
  const complete = progress.complete;

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={6}
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={complete ? "var(--color-flux)" : "var(--color-flux-d)"}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={dash.circumference}
            strokeDashoffset={dash.offset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        <span
          aria-hidden
          className="absolute inset-0 flex flex-col items-center justify-center leading-none"
        >
          {complete ? (
            <span className="text-[17px] text-flux-d">✓</span>
          ) : (
            <>
              <b className="font-display text-[15px] font-semibold tabular-nums">{progress.done}</b>
              <span className="font-mono text-[9px] text-muted tabular-nums">
                /{progress.planned}
              </span>
            </>
          )}
        </span>
      </div>

      <div className="leading-tight">
        <p className="font-mono text-[9.5px] tracking-[0.12em] text-muted uppercase">
          Traité aujourd'hui
        </p>
        <p className="text-[12.5px]">
          {progress.empty
            ? "file vide"
            : complete
              ? "file terminée"
              : `${progress.remaining} restant(s)`}
        </p>
        <span className="sr-only">{progressLabel(progress)}</span>
      </div>
    </div>
  );
}
