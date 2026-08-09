"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Champ de saisie avec suggestions et création à la volée.
 *
 * Écrit à la main plutôt que tiré d'une librairie : le comportement tient en
 * quelques dizaines de lignes, et une dépendance de plus pour cela coûterait
 * plus cher à maintenir qu'elle ne fait gagner.
 *
 * Le champ ne rend pas un identifiant : il rend soit un identifiant existant,
 * soit **un nom à créer**. La création réelle est faite côté serveur, dans la
 * même transaction que l'enregistrement parent — voir `lib/api/company-resolve.ts`.
 */
export interface ComboboxOption {
  readonly id: string;
  readonly label: string;
}

export type ComboboxValue =
  | { readonly kind: "none" }
  | { readonly kind: "existing"; readonly id: string }
  | { readonly kind: "new"; readonly name: string };

interface ComboboxProps {
  readonly options: readonly ComboboxOption[];
  readonly value: ComboboxValue;
  readonly onChange: (value: ComboboxValue) => void;
  readonly placeholder?: string;
  readonly emptyLabel?: string;
  readonly createLabel?: (input: string) => string;
  readonly id?: string;
}

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[13.5px] outline-none focus:border-flux";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Rechercher ou créer…",
  emptyLabel = "Aucun",
  createLabel = (input) => `Créer « ${input} »`,
  id,
}: ComboboxProps) {
  const selectedLabel =
    value.kind === "existing"
      ? (options.find((option) => option.id === value.id)?.label ?? "")
      : value.kind === "new"
        ? value.name
        : "";

  const [query, setQuery] = useState(selectedLabel);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  // La valeur peut changer depuis l'extérieur (réinitialisation du formulaire) :
  // le texte affiché suit, sans écraser une saisie en cours.
  useEffect(() => {
    if (!open) setQuery(selectedLabel);
  }, [selectedLabel, open]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (boxRef.current !== null && event.target instanceof Node) {
        if (!boxRef.current.contains(event.target)) setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const trimmed = query.trim();
  const matches = useMemo(() => {
    if (trimmed === "") return options.slice(0, 8);
    const needle = normalize(trimmed);
    return options.filter((option) => normalize(option.label).includes(needle)).slice(0, 8);
  }, [options, trimmed]);

  const exact = matches.some((option) => normalize(option.label) === normalize(trimmed));
  const canCreate = trimmed !== "" && !exact;

  /** Options affichées : « aucun », les correspondances, puis « créer ». */
  const rows: Array<{ key: string; label: string; apply: () => void; create?: boolean }> = [
    { key: "__none", label: emptyLabel, apply: () => onChange({ kind: "none" }) },
    ...matches.map((option) => ({
      key: option.id,
      label: option.label,
      apply: () => onChange({ kind: "existing", id: option.id }),
    })),
    ...(canCreate
      ? [
          {
            key: "__create",
            label: createLabel(trimmed),
            apply: () => onChange({ kind: "new", name: trimmed }),
            create: true,
          },
        ]
      : []),
  ];

  const choose = (index: number) => {
    const row = rows[index];
    if (row === undefined) return;
    row.apply();
    setQuery(row.key === "__none" ? "" : row.create === true ? trimmed : row.label);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => (current + 1) % rows.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current - 1 + rows.length) % rows.length);
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery(selectedLabel);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <input
        id={id}
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
          // Tant qu'on tape, la valeur est « à créer » : si le texte correspond
          // finalement à une société existante, le serveur la retrouvera par son
          // nom plutôt que d'en fabriquer une jumelle.
          const next = event.target.value.trim();
          onChange(next === "" ? { kind: "none" } : { kind: "new", name: next });
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={CONTROL}
      />

      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-[220px] w-full overflow-y-auto rounded-control border border-line bg-surface shadow-float"
        >
          {rows.map((row, index) => (
            <li key={row.key}>
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
                className={`w-full px-3 py-1.5 text-left text-[13px] transition-colors ${
                  index === active ? "bg-surface-2" : ""
                } ${row.create === true ? "font-semibold text-flux-d" : ""} ${
                  row.key === "__none" ? "text-muted" : ""
                }`}
              >
                {row.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Champs à envoyer à l'API pour la valeur choisie. */
export function companyFields(value: ComboboxValue): {
  companyId?: string | null;
  companyName?: string;
} {
  if (value.kind === "existing") return { companyId: value.id };
  if (value.kind === "new") return { companyName: value.name };
  return { companyId: null };
}
