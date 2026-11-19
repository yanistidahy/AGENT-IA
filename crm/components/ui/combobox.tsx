"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { byName, sortKey } from "@/lib/domain/sort-key";
import { fold } from "@/lib/domain/text";

/**
 * Champ de saisie avec suggestions, et création à la volée **si on l'autorise**.
 *
 * Écrit à la main plutôt que tiré d'une librairie : le comportement tient en
 * quelques dizaines de lignes, et une dépendance de plus pour cela coûterait
 * plus cher à maintenir qu'elle ne fait gagner.
 *
 * Le champ ne rend pas un identifiant : il rend soit un identifiant existant,
 * soit **un nom à créer**. La création réelle est faite côté serveur, dans la
 * même transaction que l'enregistrement parent — voir `lib/api/company-resolve.ts`.
 *
 * ## `allowCreate`, ajouté au jalon 116
 *
 * Une société se crée à la volée parce qu'on la découvre en remplissant la
 * fiche d'un contact. **Un contact, non** : il se crée depuis `/contacts`, avec
 * son cycle de vie, sa source et son consentement. Le compteur manuel du
 * pilotage montrait pourquoi le drapeau manquait — il proposait « Créer
 * “Camille” », et `manual-counter.tsx` jetait silencieusement un
 * `{kind: "new"}` : le message se comptait **sans contact**, sans un mot à
 * l'écran. Proposer un geste qui ne fait rien est pire que ne pas le proposer.
 *
 * Avec `allowCreate: false`, la rangée « Créer » disparaît **et** la frappe
 * cesse d'émettre une valeur : la sélection ne change qu'au choix d'une rangée.
 */
export interface ComboboxOption {
  readonly id: string;
  readonly label: string;
  /**
   * La clé sur laquelle filtrer, déjà pliée, quand le libellé ne suffit pas :
   * un contact se cherche aussi par son adresse et par sa société.
   */
  readonly search?: string;
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
  /** Faux : aucune création, et la frappe ne change plus la valeur. */
  readonly allowCreate?: boolean;
  /** Vrai : la liste arrive déjà triée par l'appelant, on n'y retouche pas. */
  readonly preordered?: boolean;
  /** Combien de rangées de correspondances au plus. `null` les montre toutes. */
  readonly maxRows?: number | null;
}

const CONTROL =
  "w-full rounded-control border border-line bg-surface px-2.5 py-2 text-[13.5px] outline-none focus:border-brand";

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Rechercher ou créer…",
  emptyLabel = "Aucun",
  createLabel = (input) => `Créer « ${input} »`,
  id,
  allowCreate = true,
  preordered = false,
  maxRows = 8,
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
  /*
    **Le texte affiché n'est un filtre que si quelqu'un l'a tapé.**

    Sans cette distinction, ouvrir un champ déjà renseigné donnait une liste
    d'**une** rangée : celle de la valeur courante, puisque le libellé affiché
    servait de terme de recherche. Mesuré dans un navigateur au jalon 116 — on
    ouvrait le sélecteur d'une affaire liée à « Giovanni Amico » et il ne
    proposait que Giovanni, c'est-à-dire exactement le contact qu'on cherchait à
    remplacer. On repart donc de la liste entière, et le filtre ne s'applique
    qu'à la frappe.
  */
  const [touched, setTouched] = useState(false);
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
  /*
    **Trié ici, une fois, pour tous les appelants.** Un combobox est une liste
    où l'on cherche un nom : l'ordre alphabétique y est toujours le bon, et le
    laisser à chaque appelant garantissait qu'un seul d'entre eux l'oublierait.
    Le tri se fait sur la clé pliée — « Élixir » se range entre « Eden » et
    « Effet », et non après « Z ».

    `preordered` est l'exception, ajoutée au jalon 116 : une liste de contacts
    arrive triée par `contactOptions()`, sur le **prénom**, et retrier ici sur
    le libellé serait un second ordre — qui tomberait juste la plupart du temps
    et faux sur les fiches libellées par leur adresse.
  */
  const sorted = useMemo(
    () => (preordered ? [...options] : byName(options, (option) => sortKey([option.label]))),
    [options, preordered],
  );
  const matches = useMemo(() => {
    const cut = (list: readonly ComboboxOption[]) =>
      maxRows === null ? [...list] : list.slice(0, maxRows);
    if (!touched || trimmed === "") return cut(sorted);
    const needle = fold(trimmed);
    // La clé fournie gagne sur le libellé : un contact se trouve par son
    // adresse et par sa société, qui ne s'affichent pas.
    return cut(sorted.filter((option) => (option.search ?? fold(option.label)).includes(needle)));
  }, [sorted, trimmed, maxRows, touched]);

  const exact = matches.some((option) => fold(option.label) === fold(trimmed));
  const canCreate = allowCreate && trimmed !== "" && !exact;

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
    setTouched(false);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      // **La première flèche ouvre, elle n'avance pas.** Sinon la rangée 0 —
      // « Aucun », puis le premier contact — n'est jamais atteignable au clavier
      // sans remonter, ce qui se remarque dès qu'on ferme la liste par mégarde.
      if (!open) {
        setOpen(true);
        return;
      }
      setActive((current) => (current + 1) % rows.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => (current - 1 + rows.length) % rows.length);
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      choose(active);
    } else if (event.key === "Escape") {
      /*
        **Échap referme la liste, pas le tiroir qui la contient.**

        Défaut réel, trouvé par la recette du jalon 116 : `Drawer` écoute Échap
        sur `document` (pour se fermer), et l'événement y arrivait après être
        passé par le champ. Abandonner une recherche fermait donc le panneau
        d'édition **et perdait la saisie en cours** — un clavier qui annule plus
        que ce qu'on lui demande.

        `stopImmediatePropagation` sur l'événement natif est nécessaire :
        `stopPropagation()` ne vaut que pour la propagation synthétique de
        React, et n'empêche pas un écouteur posé sur `document`. La liste
        fermée, en revanche, on ne touche à rien : Échap doit alors fermer le
        tiroir, comme partout ailleurs.
      */
      if (open) {
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation();
      }
      setOpen(false);
      setTouched(false);
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
          setTouched(true);
          setActive(0);
          // Sans création, la frappe ne **filtre** : la valeur ne change qu'au
          // choix d'une rangée. Émettre ici un `{kind:"new"}` que l'appelant ne
          // peut pas honorer effacerait le contact déjà lié dès la première
          // lettre tapée pour en chercher un autre.
          if (!allowCreate) return;
          // Tant qu'on tape, la valeur est « à créer » : si le texte correspond
          // finalement à une société existante, le serveur la retrouvera par son
          // nom plutôt que d'en fabriquer une jumelle.
          const next = event.target.value.trim();
          onChange(next === "" ? { kind: "none" } : { kind: "new", name: next });
        }}
        onFocus={() => {
          setOpen(true);
          // Rouvrir, c'est repartir de la liste entière : une frappe
          // abandonnée ne doit pas filtrer la fois suivante.
          setTouched(false);
        }}
        onKeyDown={onKeyDown}
        className={CONTROL}
      />

      {open && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 max-h-[220px] w-full overflow-y-auto rounded-control border border-line bg-surface shadow-float"
        >
          {rows.map((row, index) => (
            <li key={row.key} role="option" aria-selected={index === active} data-option-id={row.key}>
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(index)}
                className={`w-full px-3 py-1.5 text-left text-[13px] transition-colors ${
                  index === active ? "bg-surface-2" : ""
                } ${row.create === true ? "font-semibold text-brand-d" : ""} ${
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
