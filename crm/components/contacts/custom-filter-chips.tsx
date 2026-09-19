"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import { describeFilterDeletion } from "@/lib/domain/custom-filters";

/**
 * Les **filtres personnalisés** : une puce par groupe, plus le contrôle qui
 * les gère.
 *
 * Un groupe nommé se pose et se retire exactement comme « Jamais contacté » ou
 * « À relancer », et se croise avec elles — c'était la demande, et c'est ce qui
 * justifie qu'il soit une puce plutôt qu'un écran. Ce qui le distingue tient en
 * une phrase, dite dans le panneau : **les autres puces posent une question et
 * leur réponse change toute seule ; celle-ci porte un choix, et ne bouge que
 * quand quelqu'un la change.**
 *
 * Le compte vit sur la puce et porte sur **tout le portefeuille**, jamais sur
 * la liste filtrée : une puce qui compte son propre résultat afficherait
 * toujours le total de ce qu'elle vient de sélectionner (règle du jalon 6).
 *
 * **Sur la première rangée**, avec Instagram et « Ajoutés », et pour la même
 * raison dure : la seconde rangée est un groupe `overflow-hidden` qui découpe
 * tout panneau posé en `absolute` sous son bouton — le défaut du jalon 60. Une
 * puce à menu ne peut pas vivre dans un conteneur qui rogne.
 */

export interface CustomFilterOption {
  readonly id: string;
  readonly name: string;
  readonly members: number;
}

function isFilters(value: unknown): value is { filters: CustomFilterOption[] } {
  return typeof value === "object" && value !== null && "filters" in value;
}

const CHIP =
  "rounded-control border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors";
const SECONDARY =
  "min-h-[44px] rounded-control border border-line bg-surface px-2.5 text-[12.5px] lg:min-h-0 lg:py-1";
const ACTION =
  "min-h-[44px] rounded-control bg-brand px-2.5 text-[12.5px] font-medium text-white hover:bg-brand-d disabled:opacity-50 lg:min-h-0 lg:py-1";

export function CustomFilterChips({
  filters,
  active,
  onChange,
  onChanged,
}: {
  readonly filters: readonly CustomFilterOption[];
  /** L'identifiant du filtre posé, s'il y en a un. */
  readonly active: string | null;
  readonly onChange: (updates: Record<string, string | null>) => void;
  /** Rejoue la page : c'est le serveur qui redit les comptes, pas le navigateur. */
  readonly onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const call = async (
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, unknown>,
  ): Promise<boolean> => {
    setBusy(true);
    setError(null);
    const result = await requestJson(
      "/api/custom-filters",
      { method, body: JSON.stringify(body) },
      isFilters,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    onChanged();
    return true;
  };

  const create = async () => {
    if (await call("POST", { name })) setName("");
  };

  const remove = async (filter: CustomFilterOption) => {
    // La confirmation **promet que les fiches restent**, et la phrase est
    // composée dans le domaine : dite à deux endroits, elle finirait par être
    // dite de deux façons (jalons 55, 64 et 66).
    if (!window.confirm(describeFilterDeletion(filter.name, filter.members))) return;
    if (await call("DELETE", { id: filter.id })) {
      // Le filtre posé vient de disparaître : le laisser dans l'URL filtrerait
      // sur un identifiant qui n'existe plus, donc sur rien, sans qu'aucun
      // contrôle ne le dise.
      if (active === filter.id) onChange({ filtre: null });
    }
  };

  const rename = async (id: string, next: string) => {
    if (await call("PATCH", { id, name: next })) setRenaming(null);
  };

  return (
    <>
      {/*
        Le contrôle **avant** ses puces, et pas seulement pour la lecture : son
        panneau est posé en `absolute left-0`, donc chaque puce ajoutée devant
        lui le pousserait vers la droite jusqu'à le faire déborder de l'écran.
        Ancré en tête de rangée, sa position ne dépend plus du nombre de filtres.
      */}
      <div className="relative">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => {
            setError(null);
            setOpen((value) => !value);
          }}
          className={`${CHIP} border-line bg-surface text-muted hover:bg-surface-2`}
        >
          Filtres personnalisés
          {filters.length > 0 && <span className="ml-1 font-normal">· {filters.length}</span>}
        </button>

        {open && (
          <div className="absolute top-full left-0 z-30 mt-1 w-[320px] rounded-card border border-line bg-surface p-3 text-[12.5px] shadow-card">
            <p className="mb-2 text-muted">
              Un groupe nommé, constitué à la main. Contrairement aux autres puces, il ne change
              jamais tout seul : il ne contient que ce que vous y mettez.
            </p>

            <div className="flex flex-wrap items-center gap-1.5">
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nom du filtre…"
                className="min-h-[44px] flex-1 rounded-control border border-line bg-surface px-2.5 text-[12.5px] lg:min-h-0 lg:py-1"
              />
              <button
                type="button"
                disabled={busy || name.trim() === ""}
                onClick={() => void create()}
                className={ACTION}
              >
                Créer un filtre
              </button>
            </div>
            <p className="mt-1 text-[11.5px] text-muted">
              Créé vide. Pour le remplir : cochez des fiches dans le tableau, puis « Ajouter
              à… » dans la barre de sélection.
            </p>

            <ul className="mt-2 space-y-1">
              {filters.map((filter) => (
                <li key={filter.id} className="flex flex-wrap items-center gap-1.5">
                  {renaming === filter.id ? (
                    <RenameRow
                      initial={filter.name}
                      busy={busy}
                      onCancel={() => setRenaming(null)}
                      onSubmit={(next) => void rename(filter.id, next)}
                    />
                  ) : (
                    <>
                      <span className="flex-1 truncate">
                        {filter.name}{" "}
                        <span className="text-muted tabular-nums">· {filter.members}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setRenaming(filter.id)}
                        className="min-h-[44px] text-brand-d hover:underline lg:min-h-0"
                      >
                        Renommer
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(filter)}
                        // Le nom dans l'étiquette : « Supprimer » tout court se
                        // confondrait avec les autres suppressions de l'écran,
                        // pour qui clique comme pour qui teste.
                        aria-label={`Supprimer le filtre ${filter.name}`}
                        className="min-h-[44px] text-muted hover:text-danger lg:min-h-0"
                      >
                        Supprimer
                      </button>
                    </>
                  )}
                </li>
              ))}
              {filters.length === 0 && (
                <li className="text-muted">Aucun filtre personnalisé pour l&apos;instant.</li>
              )}
            </ul>

            {error !== null && <p className="mt-2 text-danger">{error}</p>}

            <button type="button" onClick={() => setOpen(false)} className={`${SECONDARY} mt-2`}>
              Fermer
            </button>
          </div>
        )}
      </div>

      {filters.map((filter) => (
        <button
          key={filter.id}
          type="button"
          onClick={() => onChange({ filtre: active === filter.id ? null : filter.id })}
          title="Filtre personnalisé : il ne contient que ce que vous y avez mis."
          className={`${CHIP} ${
            active === filter.id
              ? "border-brand bg-brand text-white"
              : "border-brand-lift bg-brand-l text-brand-d hover:border-brand"
          }`}
        >
          {filter.name}
          <span className="ml-1 font-normal tabular-nums">{filter.members}</span>
        </button>
      ))}
    </>
  );
}

function RenameRow({
  initial,
  busy,
  onCancel,
  onSubmit,
}: {
  readonly initial: string;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onSubmit: (name: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-label={`Renommer ${initial}`}
        className="min-h-[44px] flex-1 rounded-control border border-line bg-surface px-2.5 text-[12.5px] lg:min-h-0 lg:py-1"
      />
      <button
        type="button"
        disabled={busy || value.trim() === ""}
        onClick={() => onSubmit(value)}
        className={ACTION}
      >
        Enregistrer
      </button>
      <button type="button" onClick={onCancel} className={SECONDARY}>
        Annuler
      </button>
    </>
  );
}
