"use client";

import { Combobox, type ComboboxValue } from "@/components/ui/combobox";
import type { ContactPickerOption } from "@/lib/domain/contact-picker";

/**
 * **Le seul sélecteur de contact du produit.**
 *
 * Il ne cherche rien et ne gère aucune touche lui-même : tout vient de
 * `Combobox`, qui porte déjà le filtre, les flèches, Entrée, Échap et le clic
 * extérieur depuis le jalon 6. Ce composant ne fait que trois choses, et c'est
 * exactement pour elles qu'il existe plutôt qu'un `Combobox` recopié à quatre
 * endroits :
 *
 * 1. il **interdit la création** (`allowCreate={false}`) — un contact se crée
 *    depuis `/contacts`, avec son cycle de vie, sa source et son consentement,
 *    jamais au passage d'un formulaire d'affaire ;
 * 2. il **ne retrie pas** : la liste arrive de `contactOptions()`, calculée
 *    côté serveur, et c'est la seule fonction du produit qui décide de l'ordre
 *    des contacts ;
 * 3. il **montre toute la liste** (`maxRows={null}`) : la borne de huit
 *    rangées du choix d'une société vient d'un cas où la frappe est l'usage
 *    normal. Ici, parcourir est un usage normal aussi — on cherche parfois
 *    « qui, chez cette marque ? » sans avoir de nom en tête — et la liste
 *    défile.
 *
 * L'identifiant entre et sort tel quel : `null` est « aucun contact ». Les
 * appelants n'ont donc pas à connaître `ComboboxValue`, dont la variante
 * « à créer » n'a pas de sens ici.
 */
interface ContactPickerProps {
  /** Déjà triée et libellée par `contactOptions()`. */
  readonly options: readonly ContactPickerOption[];
  readonly value: string | null;
  readonly onChange: (contactId: string | null) => void;
  readonly placeholder?: string;
  readonly emptyLabel?: string;
  readonly id?: string;
}

export function ContactPicker({
  options,
  value,
  onChange,
  placeholder = "Chercher un contact…",
  emptyLabel = "Aucun contact",
  id,
}: ContactPickerProps) {
  const current: ComboboxValue =
    value === null || value === "" ? { kind: "none" } : { kind: "existing", id: value };

  return (
    <div data-contact-picker className="relative">
      <Combobox
        id={id}
        options={options}
        value={current}
        onChange={(next) => onChange(next.kind === "existing" ? next.id : null)}
        allowCreate={false}
        preordered
        maxRows={null}
        placeholder={placeholder}
        emptyLabel={emptyLabel}
      />
    </div>
  );
}
