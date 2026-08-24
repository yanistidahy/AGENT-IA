"use client";

import { useCallback, type ReactNode } from "react";

/**
 * Bande d'onglets.
 *
 * Motif ARIA complet, flèches comprises : la bande de portraits du jalon 18
 * portait `role="tablist"` sans la navigation au clavier qu'il promet, et c'est
 * exactement le genre d'à-peu-près qui rend une aide technique inutilisable.
 * Ici les flèches déplacent la sélection, `Home` et `Fin` vont aux extrémités,
 * et le bouclage est volontaire — sur cinq onglets, revenir au premier après le
 * dernier est ce qu'attend quelqu'un qui parcourt.
 */
export interface TabDefinition<K extends string> {
  readonly key: K;
  readonly label: string;
  /** Compteur discret, quand le nombre aide à choisir l'onglet. */
  readonly count?: number;
}

export function Tabs<K extends string>({
  tabs,
  active,
  onSelect,
  idPrefix,
}: {
  tabs: readonly TabDefinition<K>[];
  active: K;
  onSelect: (key: K) => void;
  /** Préfixe des `id`, pour relier chaque onglet à son panneau. */
  idPrefix: string;
}) {
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const index = tabs.findIndex((tab) => tab.key === active);
      if (index === -1) return;

      const move = (delta: number) => {
        event.preventDefault();
        const next = tabs[(index + delta + tabs.length) % tabs.length];
        if (next !== undefined) onSelect(next.key);
      };

      if (event.key === "ArrowRight") move(1);
      else if (event.key === "ArrowLeft") move(-1);
      else if (event.key === "Home") {
        event.preventDefault();
        const first = tabs[0];
        if (first !== undefined) onSelect(first.key);
      } else if (event.key === "End") {
        event.preventDefault();
        const last = tabs[tabs.length - 1];
        if (last !== undefined) onSelect(last.key);
      }
    },
    [active, onSelect, tabs],
  );

  return (
    <div role="tablist" onKeyDown={onKeyDown} className="flex gap-0.5 border-b border-line">
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.key}`}
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.key}`}
            // Un seul onglet dans l'ordre de tabulation : la tabulation entre
            // dans la bande, les flèches y circulent, la tabulation suivante en
            // sort vers le contenu. C'est ce que le motif attend.
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(tab.key)}
            // 44 px de haut sous `lg` : l'onglet se touche au pouce, dans le
            // tiroir plein écran du téléphone.
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-semibold transition-colors max-lg:min-h-11 max-lg:flex-1 ${
              selected
                ? "border-brand text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1.5 font-mono text-[11px] font-normal text-muted tabular-nums">
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  tabKey,
  active,
  idPrefix,
  children,
}: {
  tabKey: string;
  active: string;
  idPrefix: string;
  children: ReactNode;
}) {
  const selected = tabKey === active;
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${tabKey}`}
      aria-labelledby={`${idPrefix}-tab-${tabKey}`}
      // Masqué plutôt que démonté : l'onglet Historique charge la chronologie
      // par le réseau, et le démonter ferait repayer cette lecture à chaque
      // aller-retour entre onglets.
      hidden={!selected}
      className={selected ? "" : "hidden"}
    >
      {children}
    </div>
  );
}
