"use client";

import { CHANNEL_LABELS, type OutreachChannel } from "@/lib/domain/outreach";
import { sourceLabel } from "@/lib/domain/pilotage";
import { gapLabel, shareLabel } from "@/lib/domain/timeline";
import type { PointView } from "./timeline-chart";

/**
 * **Ce que dit une période, dans un panneau sous le graphique.**
 *
 * C'était une infobulle flottante au jalon 113, et le prototype validé la
 * déplace sous le tracé. Ce n'est pas un goût : une infobulle se place en
 * travers du graphique qu'on essaie de lire, elle ne survit pas à un doigt sur
 * un écran tactile, et elle ne peut pas porter de lien — or le panneau en porte
 * un, « Voir les N messages », qui est la raison pour laquelle on s'est arrêté
 * là.
 *
 * Sept choses sont écrites, dans l'ordre où on se les demande :
 *
 * 1. **les dates exactes** — « lun. 2 nov. – dim. 8 nov. ». « Semaine du
 *    2 nov. » laisse deviner si le dimanche est dedans ;
 * 2. **le total** ;
 * 3. **l'écart à la cible**, quand il y en a une ;
 * 4. **la période précédente**, et l'évolution ;
 * 5. **la répartition par canal**, valeur et part ;
 * 6. **l'origine** — lemlist, CRM, manuel. Trois chemins écrivent des messages
 *    depuis le jalon 112, et c'est la première question qu'on se pose devant un
 *    total qui surprend ;
 * 7. **le lien vers la liste**, qui sort du même tableau filtré que la barre.
 *
 * **Le panneau est toujours là**, et porte la dernière période quand on ne
 * survole rien : un bloc qui apparaît au survol déplace tout ce qui le suit, et
 * on perd la barre qu'on visait. Aucun calcul ici — `gapLabel` et `shareLabel`
 * vivent dans le domaine.
 */

interface Props {
  readonly point: PointView;
  readonly channels: readonly OutreachChannel[];
  readonly visible: readonly OutreachChannel[];
  /** Le canal survolé en vue « Par canal », s'il y en a un. */
  readonly focused: OutreachChannel | null;
  /** Vrai quand rien n'est survolé : le panneau montre la dernière période. */
  readonly fallback: boolean;
  readonly metricLabel: string;
}

export function TimelineDetail({
  point,
  channels,
  visible,
  focused,
  fallback,
  metricLabel,
}: Props) {
  const shown = channels.filter((channel) => visible.includes(channel));
  const sources = Object.entries(point.bySource).filter(([, count]) => count > 0);

  return (
    <div
      className="mt-2 rounded-board border border-line bg-surface-2 p-3 text-[12px]"
      data-timeline-detail
      data-detail-default={fallback ? "1" : "0"}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-medium text-ink" data-tooltip-dates>
          {point.exact}
          {fallback ? (
            <span className="ml-2 text-[11px] font-normal text-muted">
              dernière période · survolez une barre pour en lire une autre
            </span>
          ) : null}
        </p>
        <a
          href={point.href}
          data-detail-link
          className="text-[12px] font-semibold text-brand-d hover:underline"
        >
          Voir les {point.total} {metricLabel.toLowerCase()}
        </a>
      </div>

      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <Fact term="Total">
          <strong data-tooltip-total>{point.total}</strong>
        </Fact>
        <Fact term="Cible">
          {point.target === null ? (
            <span className="text-muted">—</span>
          ) : (
            <span data-tooltip-target>
              {point.target} <span className="text-muted">({gapLabel(point.total, point.target)})</span>
            </span>
          )}
        </Fact>
        <Fact term="Période précédente">
          {point.previous === null ? (
            <span className="text-muted">—</span>
          ) : (
            <span data-tooltip-previous>
              {point.previous}{" "}
              <span className="text-muted">({gapLabel(point.total, point.previous)})</span>
            </span>
          )}
        </Fact>
        <Fact term="Origine">
          {sources.length === 0 ? (
            <span className="text-muted">—</span>
          ) : (
            <span data-tooltip-sources>
              {sources.map(([source, count]) => `${sourceLabel(source)} ${count}`).join(" · ")}
            </span>
          )}
        </Fact>
      </dl>

      {shown.length > 0 ? (
        <ul className="mt-2 grid gap-x-4 gap-y-0.5 border-t border-line pt-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((channel) => (
            <li
              key={channel}
              className={`flex justify-between gap-2 ${
                focused === channel ? "font-medium text-ink" : "text-muted"
              }`}
              data-tooltip-channel={channel}
            >
              <span className="truncate">{CHANNEL_LABELS[channel]}</span>
              <span className="shrink-0 tabular-nums">
                {point.byChannel[channel] ?? 0}{" "}
                <span className="text-muted">
                  ({shareLabel(point.byChannel[channel] ?? 0, point.total)})
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Fact({ term, children }: { readonly term: string; readonly children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{term}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  );
}
