"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { TASK_TABS, type TaskTabId } from "@/lib/domain/task-tabs";

/**
 * La rangée d'onglets, chacun avec sa pastille.
 *
 * **La pastille vient du même prédicat que la liste** : elle est calculée en
 * amont par `tabCounts()` sur le tableau complet des lignes, et la liste par
 * `rowsForTab()` sur ce même tableau. Aucun nombre n'est recomposé ici — une
 * pastille qui annoncerait 7 au-dessus d'une liste de 5 ferait perdre la
 * confiance dans les deux (jalons 49 et 78).
 *
 * **Défile horizontalement sous `lg`**, sans variante mobile : six onglets ne
 * tiennent pas dans la largeur d'un téléphone, et les replier derrière un menu
 * cacherait précisément ce qu'on vient lire.
 */
interface TaskTabBarProps {
  readonly tab: TaskTabId;
  readonly counts: Record<TaskTabId, number>;
  readonly savedTabs: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly activeSaved: string;
  readonly onSelect: (tab: TaskTabId) => void;
  readonly onOpenSaved: (id: string) => void;
  readonly onSave: (name: string) => void;
  readonly onDeleteSaved: (id: string) => void;
}

const PILL =
  "inline-flex shrink-0 items-center gap-1.5 rounded-control border px-3 py-2 text-[12.5px] font-semibold transition-colors min-h-[44px] lg:min-h-0";

export function TaskTabBar({
  tab,
  counts,
  savedTabs,
  activeSaved,
  onSelect,
  onOpenSaved,
  onSave,
  onDeleteSaved,
}: TaskTabBarProps) {
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const submit = () => {
    const clean = name.trim();
    if (clean === "") return;
    onSave(clean);
    setName("");
    setNaming(false);
  };

  return (
    <div className="mb-3">
      <div
        role="tablist"
        aria-label="Onglets de tâches"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {TASK_TABS.map((definition) => {
          const active = activeSaved === "" && definition.id === tab;
          return (
            <button
              key={definition.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(definition.id)}
              className={`${PILL} ${
                active
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-ink hover:bg-surface-2"
              }`}
            >
              {definition.label}
              <span
                className={`rounded-full px-1.5 py-[1px] font-mono text-[11px] ${
                  active ? "bg-white/20 text-white" : "bg-paper text-muted"
                }`}
              >
                {counts[definition.id]}
              </span>
            </button>
          );
        })}

        {savedTabs.map((saved) => {
          const active = activeSaved === saved.id;
          return (
            <span
              key={saved.id}
              className={`${PILL} ${
                active
                  ? "border-brand bg-brand text-white"
                  : "border-line bg-surface text-ink hover:bg-surface-2"
              }`}
            >
              <button type="button" onClick={() => onOpenSaved(saved.id)}>
                {saved.name}
              </button>
              <button
                type="button"
                aria-label={`Supprimer l'onglet ${saved.name}`}
                onClick={() => onDeleteSaved(saved.id)}
                className={active ? "text-white/80 hover:text-white" : "text-muted hover:text-ink"}
              >
                <Icon name="x" size={13} />
              </button>
            </span>
          );
        })}

        <button
          type="button"
          onClick={() => setNaming(true)}
          aria-label="Enregistrer cette vue comme onglet"
          className={`${PILL} border-dashed border-line bg-surface text-muted hover:text-ink`}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>

      {naming && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface px-3 py-2">
          <span className="text-[12.5px] text-muted">
            Enregistre la recherche et les filtres courants sous un nom. L&apos;onglet ne
            contient rien : il rejoue cette question.
          </span>
          <input
            autoFocus
            className="rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand"
            placeholder="Nom de l'onglet"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
              if (event.key === "Escape") setNaming(false);
            }}
          />
          <button
            type="button"
            onClick={submit}
            className="rounded-control bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-d"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => setNaming(false)}
            className="text-[12.5px] text-muted hover:text-ink"
          >
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
