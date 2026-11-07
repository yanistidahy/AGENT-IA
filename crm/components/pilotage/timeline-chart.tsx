"use client";

import { useState } from "react";
import { CHANNEL_LABELS, type OutreachChannel } from "@/lib/domain/outreach";
import { NO_DATA } from "@/lib/domain/pilotage";
import { TimelinePlot, bandOf } from "./timeline-plot";
import { TimelineTooltip } from "./timeline-tooltip";

/**
 * **« Dans le temps », refondu.**
 *
 * Le composant reçoit une série **déjà calculée** par
 * `lib/domain/timeline.ts` : il ne compte rien, ne découpe rien et ne somme
 * rien, et `tests/pilotage-source.test.ts` échoue s'il s'y met. Ce qu'il porte,
 * c'est l'interaction que le jalon 113 demande et qui n'existait pas — survol,
 * focus clavier, légende cliquable.
 *
 * ## Pourquoi c'est un composant client, contre la convention
 *
 * Les graphiques de ce produit sont des composants **serveur** depuis le jalon
 * 5 : du SVG statique, aucun JavaScript envoyé au navigateur. C'est une bonne
 * règle et elle tient toujours pour l'entonnoir et l'anneau. Elle ne tient pas
 * ici : une infobulle au survol, atteignable au clavier, et une légende qui
 * masque une série sont de l'interaction, pas de la mise en page. Le compromis
 * retenu garde le calcul là où il était — **tout** est calculé sur le serveur,
 * et seul le placement et l'écoute des événements traversent.
 *
 * ## Le survol et le focus disent la même chose
 *
 * `onMouseEnter` et `onFocus` posent le même état. Un graphique dont
 * l'information n'existe qu'au survol est un graphique que personne ne lit au
 * clavier, et les liens de chaque barre rendent le focus naturel : tabuler
 * parcourt les périodes et affiche leur infobulle.
 */

export interface PointView {
  readonly key: string;
  readonly short: string;
  readonly exact: string;
  readonly total: number;
  readonly target: number | null;
  readonly previous: number | null;
  readonly byChannel: Readonly<Record<string, number>>;
  readonly bySource: Readonly<Record<string, number>>;
  /** La liste de ce seau, construite côté serveur à partir du même tableau. */
  readonly href: string;
  /** La liste de ce seau pour un canal donné. */
  readonly channelHref: Readonly<Record<string, string>>;
}

interface Props {
  readonly points: readonly PointView[];
  readonly view: "total" | "canal";
  readonly channels: readonly OutreachChannel[];
  readonly peak: number;
  readonly metricLabel: string;
  readonly granularityLabel: string;
  /** Dit pourquoi la plage commence là où elle commence. */
  readonly rangeNote: string;
}

/** La largeur du tracé : assez de place par période pour qu'un libellé tienne. */
function widthFor(count: number, view: "total" | "canal"): number {
  const perPoint = view === "total" ? 46 : 54;
  return Math.max(320, 44 + count * perPoint);
}

export function TimelineChart({
  points,
  view,
  channels,
  peak,
  metricLabel,
  granularityLabel,
  rangeNote,
}: Props) {
  const [hidden, setHidden] = useState<readonly OutreachChannel[]>([]);
  const [hover, setHover] = useState<{ key: string; channel: OutreachChannel | null } | null>(null);

  const visible = channels.filter((channel) => !hidden.includes(channel));
  const point = hover === null ? null : (points.find((entry) => entry.key === hover.key) ?? null);

  function toggle(channel: OutreachChannel): void {
    setHidden((current) =>
      current.includes(channel)
        ? current.filter((entry) => entry !== channel)
        : [...current, channel],
    );
  }

  if (points.length === 0) {
    return (
      <section className="rounded-card border border-line bg-surface p-3.5" data-timeline>
        <h2 className="font-display text-[15px] font-semibold tracking-tight">Dans le temps</h2>
        <p className="mt-2 text-[13px] text-muted">{NO_DATA}</p>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-line bg-surface p-3.5" data-timeline>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-[15px] font-semibold tracking-tight">
          Dans le temps
          <span className="ml-2 text-[12px] font-normal text-muted">
            {metricLabel} · par {granularityLabel.toLowerCase()}
          </span>
        </h2>
        <p className="text-[11.5px] text-muted" data-timeline-range>
          {rangeNote}
        </p>
      </header>

      {/*
        **Le graphique défile dans son propre cadre.** À 390 px, douze semaines
        ne tiennent pas : ou l'on écrase les libellés jusqu'à l'illisible, ou
        l'on fait défiler. Le défilement reste **à l'intérieur** du cadre, donc
        la page elle-même ne défile jamais horizontalement — c'est l'item 6 du
        test d'acceptation, et c'est la règle du jalon 46.
      */}
      <div className="relative mt-2">
        <div className="overflow-x-auto" data-timeline-frame>
          <TimelinePlot
            points={points}
            view={view}
            channels={channels}
            visible={visible}
            peak={peak}
            width={widthFor(points.length, view)}
            onEnter={(key, channel) => setHover({ key, channel })}
            onLeave={() => setHover(null)}
          />
        </div>

        {point !== null ? (
          <div className="pointer-events-none absolute right-2 top-2 z-10">
            <TimelineTooltip
              point={point}
              channels={channels}
              visible={visible}
              focused={hover?.channel ?? null}
            />
          </div>
        ) : null}
      </div>

      {view === "canal" && channels.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5" data-timeline-legend>
          {channels.map((channel) => {
            const band = bandOf(channel);
            const off = hidden.includes(channel);
            return (
              <li key={channel}>
                <button
                  type="button"
                  onClick={() => toggle(channel)}
                  aria-pressed={!off}
                  data-legend={channel}
                  data-on={off ? "0" : "1"}
                  className={`flex min-h-11 items-center gap-1.5 rounded-control px-1.5 text-[11.5px] ${
                    off ? "text-muted opacity-55" : "text-ink"
                  } hover:bg-line-2`}
                >
                  {/* La couleur **et** le motif : une légende qui ne se
                      distingue que par la teinte ne se lit pas en noir et
                      blanc, ni par un daltonien. */}
                  <svg width="22" height="10" aria-hidden>
                    <line
                      x1="1"
                      y1="5"
                      x2="21"
                      y2="5"
                      stroke={band.color}
                      strokeWidth="2"
                      strokeDasharray={band.dash}
                    />
                  </svg>
                  <span className={off ? "line-through" : ""}>{CHANNEL_LABELS[channel]}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {view === "canal" && visible.length === 0 ? (
        <p className="mt-1.5 text-[12px] text-muted" data-timeline-all-hidden>
          Tous les canaux sont masqués : rouvrez-en un dans la légende.
        </p>
      ) : null}
    </section>
  );
}
