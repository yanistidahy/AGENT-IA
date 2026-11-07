"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  GRANULARITIES,
  GRANULARITY_LABELS,
  TIMELINE_METRICS,
  TIMELINE_VIEWS,
  VIEW_LABELS,
  timelineMetricLabel,
} from "@/lib/domain/timeline";

/**
 * **La barre d'outils du graphique : indicateur, vue, granularité.**
 *
 * Les trois choix vivent **dans l'URL**, comme tous les états de ce produit
 * depuis le jalon 1 : la vue se partage, se met en favori et survit à un
 * rechargement — c'est l'item 4 du test d'acceptation, et c'est aussi la seule
 * façon de garder la page en rendu serveur.
 *
 * Le composant **écrit** dans l'URL ; il ne reçoit aucun gestionnaire, parce
 * qu'une fonction ne franchit pas la frontière serveur → client (jalon 12).
 *
 * À la différence de la barre de filtres, changer un de ces trois choix ne
 * remet **pas** `metric` à zéro — justement parce que l'indicateur du graphique
 * *est* cette clé : on ne regarde pas les réponses pour revenir aux messages.
 */

const CONTROL =
  "min-h-11 rounded-control border border-line bg-surface px-2.5 text-[12.5px] text-ink outline-none focus:border-brand";

export function TimelineToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const value = (key: string, fallback: string) => params.get(key) ?? fallback;

  function write(key: string, raw: string): void {
    const next = new URLSearchParams(params.toString());
    if (raw === "") next.delete(key);
    else next.set(key, raw);
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <div
      className="flex flex-wrap items-end gap-2.5"
      data-timeline-toolbar
      role="group"
      aria-label="Réglages du graphique dans le temps"
    >
      <label className="text-[11.5px] text-muted">
        Indicateur
        <select
          value={value("metric", "messages")}
          onChange={(event) => write("metric", event.target.value)}
          data-timeline-metric
          className={`mt-0.5 block ${CONTROL}`}
        >
          {TIMELINE_METRICS.map((metric) => (
            <option key={metric} value={metric}>
              {timelineMetricLabel(metric)}
            </option>
          ))}
        </select>
      </label>

      <label className="text-[11.5px] text-muted">
        Vue
        <select
          value={value("vue", "total")}
          onChange={(event) => write("vue", event.target.value)}
          data-timeline-view
          className={`mt-0.5 block ${CONTROL}`}
        >
          {TIMELINE_VIEWS.map((view) => (
            <option key={view} value={view}>
              {VIEW_LABELS[view]}
            </option>
          ))}
        </select>
      </label>

      <label className="text-[11.5px] text-muted">
        Granularité
        <select
          value={value("pas", "semaine")}
          onChange={(event) => write("pas", event.target.value)}
          data-timeline-granularity
          className={`mt-0.5 block ${CONTROL}`}
        >
          {GRANULARITIES.map((granularity) => (
            <option key={granularity} value={granularity}>
              {GRANULARITY_LABELS[granularity]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
