"use client";

import { ALL_PEOPLE } from "@/lib/domain/task-tabs";

/**
 * **« Tous · Yanis · Mohamed »**, sous les onglets.
 *
 * L'ancien onglet « Vos tâches » mentait : l'espace de travail a **un seul mot
 * de passe partagé** (jalon 9), donc le produit ne sait pas qui est « vous » —
 * il listait en réalité toutes les tâches dues, celles de Mohamed comprises.
 * Plutôt que d'inventer des comptes utilisateurs, le choix de la personne
 * devient un contrôle explicite, à côté d'un onglet qui dit ce qu'il fait.
 *
 * **Les noms viennent de la donnée**, jamais d'une liste écrite en dur : les
 * assignés présents sur les tâches, réunis aux propriétaires de référence. Une
 * liste figée afficherait Mohamed après son départ et manquerait la troisième
 * personne le jour où elle arrive.
 *
 * Le choix vit dans l'URL : la vue se met en favori et survit à un rechargement
 * (règle du jalon 1).
 */
interface PersonFilterProps {
  readonly people: readonly string[];
  readonly person: string;
  readonly onSelect: (person: string) => void;
}

const PILL =
  "inline-flex min-h-[44px] shrink-0 items-center rounded-control border px-3 py-2 text-[12.5px] font-semibold transition-colors lg:min-h-0";

export function PersonFilter({ people, person, onSelect }: PersonFilterProps) {
  if (people.length === 0) return null;

  const options = [{ value: ALL_PEOPLE, label: "Tous" }, ...people.map((name) => ({ value: name, label: name }))];

  return (
    <div
      role="group"
      aria-label="Filtrer par personne"
      data-person-filter="1"
      className="mb-3 flex items-center gap-2 overflow-x-auto pb-1"
    >
      <span className="shrink-0 font-mono text-[10px] tracking-[0.1em] text-muted uppercase">
        Assigné à
      </span>
      {options.map((option) => {
        const active = option.value === person;
        return (
          <button
            key={option.value === ALL_PEOPLE ? "__tous" : option.value}
            type="button"
            aria-pressed={active}
            data-person={option.value === ALL_PEOPLE ? "tous" : option.value}
            onClick={() => onSelect(option.value)}
            className={`${PILL} ${
              active
                ? "border-brand bg-brand-l text-brand-d"
                : "border-line bg-surface text-ink hover:bg-surface-2"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
