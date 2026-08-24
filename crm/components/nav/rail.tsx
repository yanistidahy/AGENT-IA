"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Wordmark, Mark } from "@/components/brand/logo";
import { Icon } from "@/components/ui/icon";
import type { AgentProfile } from "@/lib/api/agents";
import { AgentDock } from "@/components/agents/agent-dock";
import { RailNav } from "./rail-nav";
import { RAIL_COOKIE, SEARCH_EVENT } from "./rail-state";

/**
 * Rail de navigation — repliable, sur toutes les tailles d'écran.
 *
 * ## Les trois états, et qui les décide
 *
 * | Écran | Par défaut | Le bouton (ou Ctrl+B) fait |
 * |---|---|---|
 * | ≥ lg, déplié | 236 px, libellés | replie en bande d'icônes de 64 px |
 * | ≥ lg, replié | bande d'icônes | redéplie |
 * | < lg | **toujours** la bande d'icônes | ouvre le rail complet en surcouche |
 *
 * **Replié ne veut pas dire caché** : la bande garde une icône par
 * destination, donc chaque écran reste à un geste — un rail entièrement
 * masqué en demanderait deux. Sur téléphone, la surcouche se referme dès
 * qu'on choisit une destination.
 *
 * ## L'état vient d'un cookie, pas du stockage local
 *
 * La page est rendue côté serveur : un état lu dans `localStorage` après
 * l'hydratation ferait clignoter le rail — déplié un instant, puis replié.
 * Le cookie voyage avec la requête, la coquille le lit avant de rendre, et
 * le premier octet envoyé est déjà dans le bon état. C'est le même
 * raisonnement que le bandeau de sauvegarde du jalon 20, en sens inverse :
 * là il fallait être visible sans script, ici il faut être stable avant lui.
 */
export type RailTotals = {
  readonly pipelineValue: number;
  readonly wonCount: number;
  /** Tâches en retard — pastille sur l'entrée Tâches. */
  readonly overdueCount: number;
} | null;

export function Rail({
  totals,
  agents,
  initialCollapsed,
}: {
  totals: RailTotals;
  /** Le conseil, tel qu'il est réglé en base. Déjà filtré sur les agents actifs. */
  agents: readonly AgentProfile[];
  /** L'état replié lu dans le cookie, côté serveur — pas de clignotement. */
  initialCollapsed: boolean;
}) {
  const pathname = usePathname();
  const [docked, setDocked] = useState<AgentProfile | null>(null);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  // La surcouche se referme dès qu'on choisit une destination : c'est un menu,
  // pas un écran — la laisser ouverte cacherait la page qu'on vient de demander.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggle = () => {
    if (window.matchMedia("(min-width: 64rem)").matches) {
      setCollapsed((current) => !current);
    } else {
      setMobileOpen((current) => !current);
    }
  };

  // Le cookie suit l'état — dans un effet, pas dans le setter : un setter doit
  // rester pur, React le rejoue en mode strict. Un an : c'est une préférence,
  // pas une session.
  useEffect(() => {
    document.cookie = `${RAIL_COOKIE}=${collapsed ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }, [collapsed]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggle();
      }
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // `toggle` lit tout dans des setters fonctionnels : l'écouteur n'a pas à
    // être reposé à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toggle est stable par construction
  }, []);

  const dockAgent = (agent: AgentProfile) => {
    setDocked(agent);
    setMobileOpen(false);
  };

  return (
    <>
      <aside
        className={`bg-rail text-rail-text flex w-14 shrink-0 flex-col gap-0.5 overflow-y-auto py-[18px] max-lg:items-center max-lg:px-1.5 ${
          collapsed ? "lg:w-16 lg:items-center lg:px-1.5" : "lg:w-[236px] lg:px-3"
        }`}
      >
        <div className={collapsed ? "hidden" : "max-lg:hidden px-2.5 pt-1.5 pb-2"}>
          <Wordmark size={34} />
        </div>
        <div className={collapsed ? "pb-1 max-lg:hidden" : "pb-1 lg:hidden"}>
          <Mark size={26} />
        </div>

        {/* Deux boutons, un par taille d'écran : le même bouton porterait un
            libellé faux sur l'une des deux — « Replier » alors qu'il ouvre la
            surcouche. Chacun dit ce qu'il fait. */}
        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          aria-label={collapsed ? "Déplier le rail" : "Replier le rail"}
          aria-expanded={!collapsed}
          title={`${collapsed ? "Déplier" : "Replier"} le rail (Ctrl+B)`}
          className={`text-rail-dim hover:bg-rail-2 hover:text-white max-lg:hidden flex items-center rounded-control transition-colors ${
            collapsed
              ? "size-11 justify-center"
              : "w-full gap-2.5 px-[11px] py-2 text-[13.5px] font-medium"
          }`}
        >
          <Icon name="panel" size={19} className="shrink-0" />
          {!collapsed && <span>Replier</span>}
        </button>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Ouvrir la navigation"
          aria-haspopup="dialog"
          className="text-rail-dim hover:bg-rail-2 hover:text-white lg:hidden flex size-11 items-center justify-center rounded-control transition-colors"
        >
          <Icon name="panel" size={19} className="shrink-0" />
        </button>

        {/* La recherche au doigt : Ctrl+K n'existe pas sur un téléphone. */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(SEARCH_EVENT))}
          aria-label="Rechercher"
          title="Rechercher (Ctrl+K)"
          className={`text-rail-dim hover:bg-rail-2 hover:text-white flex size-11 items-center justify-center rounded-control transition-colors ${
            collapsed ? "" : "lg:hidden"
          }`}
        >
          <Icon name="search" size={19} className="shrink-0" />
        </button>

        {/* Deux densités rendues, une seule visible : le serveur connaît le
            cookie (bureau) et le CSS connaît la largeur (téléphone). */}
        <div className={`${collapsed ? "hidden" : "max-lg:hidden"} flex min-h-0 flex-1 flex-col`}>
          <RailNav
            compact={false}
            pathname={pathname}
            totals={totals}
            agents={agents}
            dockedSlug={docked?.slug ?? null}
            onDock={dockAgent}
          />
        </div>
        <div className={collapsed ? "contents" : "contents lg:hidden"}>
          <div className={collapsed ? "" : "lg:hidden"}>
            <RailNav
              compact
              pathname={pathname}
              totals={totals}
              agents={agents}
              dockedSlug={docked?.slug ?? null}
              onDock={dockAgent}
            />
          </div>
        </div>
      </aside>

      {/* La surcouche mobile : le rail complet, par-dessus l'écran. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-label="Navigation">
          <button
            type="button"
            aria-label="Fermer la navigation"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-ink/50"
          />
          <div className="bg-rail text-rail-text absolute inset-y-0 left-0 flex w-[min(300px,85vw)] flex-col gap-0.5 overflow-y-auto px-3 py-[18px] shadow-float">
            <div className="flex items-center justify-between px-2.5 pt-1.5 pb-2">
              <Wordmark size={30} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Fermer"
                className="text-rail-dim hover:text-white flex size-11 items-center justify-center rounded-control"
              >
                <Icon name="x" size={20} />
              </button>
            </div>
            <RailNav
              compact={false}
              pathname={pathname}
              totals={totals}
              agents={agents}
              dockedSlug={docked?.slug ?? null}
              onDock={dockAgent}
            />
          </div>
        </div>
      )}

      <AgentDock agent={docked} open={docked !== null} onClose={() => setDocked(null)} />
    </>
  );
}
