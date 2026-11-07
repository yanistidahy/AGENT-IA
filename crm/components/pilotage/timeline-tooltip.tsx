"use client";

import { CHANNEL_LABELS, type OutreachChannel } from "@/lib/domain/outreach";
import { sourceLabel } from "@/lib/domain/pilotage";
import { gapLabel, shareLabel } from "@/lib/domain/timeline";
import type { PointView } from "./timeline-chart";

/**
 * **Ce que dit un point quand on s'y arrête.**
 *
 * L'ancien graphique ne disait rien au survol : une barre de 349 contre une de
 * 44, et aucun moyen de savoir d'où venait l'écart. Cinq choses sont donc
 * écrites, dans l'ordre où on se les demande :
 *
 * 1. **les dates exactes** — « lun. 2 nov. – dim. 8 nov. ». « Semaine du
 *    2 nov. » laisse deviner si le dimanche est dedans ;
 * 2. **le total**, et l'écart à la cible quand il y en a une ;
 * 3. **la répartition par canal**, valeur et part ;
 * 4. **l'évolution** par rapport à la période précédente ;
 * 5. **l'origine** — lemlist, CRM, manuel. Trois chemins écrivent des messages
 *    depuis le jalon 112, et c'est la première question qu'on se pose devant un
 *    total qui surprend.
 *
 * Aucun calcul ici : `gapLabel` et `shareLabel` vivent dans le domaine, parce
 * que la garde du jalon 109 refuse une addition dans un fichier de pilotage —
 * et parce qu'un pourcentage écrit dans une vue est une seconde définition.
 */

interface Props {
  readonly point: PointView;
  readonly channels: readonly OutreachChannel[];
  readonly visible: readonly OutreachChannel[];
  /** Le canal survolé en vue « Par canal », s'il y en a un. */
  readonly focused: OutreachChannel | null;
}

export function TimelineTooltip({ point, channels, visible, focused }: Props) {
  const shown = channels.filter((channel) => visible.includes(channel));
  const sources = Object.entries(point.bySource).filter(([, count]) => count > 0);

  return (
    <div
      className="pointer-events-none w-[230px] rounded-card border border-line bg-white p-2.5 text-[11.5px] shadow-lg"
      data-timeline-tooltip
      role="status"
    >
      <p className="font-medium text-ink" data-tooltip-dates>
        {point.exact}
      </p>

      <p className="mt-1 text-ink">
        <strong data-tooltip-total>{point.total}</strong>{" "}
        {point.total === 1 ? "fait" : "faits"}
        {point.target !== null ? (
          <span className="ml-1 text-muted" data-tooltip-target>
            / cible {point.target} ({gapLabel(point.total, point.target)})
          </span>
        ) : null}
      </p>

      {point.previous !== null ? (
        <p className="mt-0.5 text-muted" data-tooltip-previous>
          période précédente : {point.previous} ({gapLabel(point.total, point.previous)})
        </p>
      ) : null}

      {shown.length > 0 ? (
        <ul className="mt-1.5 border-t border-line-2 pt-1.5">
          {shown.map((channel) => (
            <li
              key={channel}
              className={`flex justify-between gap-2 ${
                focused === channel ? "font-medium text-ink" : "text-muted"
              }`}
              data-tooltip-channel={channel}
            >
              <span className="truncate">{CHANNEL_LABELS[channel]}</span>
              <span className="shrink-0">
                {point.byChannel[channel] ?? 0}{" "}
                <span className="text-muted">
                  ({shareLabel(point.byChannel[channel] ?? 0, point.total)})
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {sources.length > 0 ? (
        <p className="mt-1.5 border-t border-line-2 pt-1.5 text-muted" data-tooltip-sources>
          {sources.map(([source, count]) => `${sourceLabel(source)} ${count}`).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
