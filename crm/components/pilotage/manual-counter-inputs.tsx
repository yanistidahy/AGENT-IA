"use client";

import { Combobox, type ComboboxValue } from "@/components/ui/combobox";
import { MAX_BACKDATE_DAYS, MAX_BATCH } from "@/lib/domain/manual-count";
import type { ManualContactOption } from "./manual-counter";

/**
 * **Les trois réglages d'une saisie, et la phrase qui dit ce qu'ils changent.**
 *
 * De la saisie pure : ce composant ne décide rien et n'appelle rien, il remonte
 * trois valeurs. Séparé du bloc pour tenir la borne de 250 lignes par
 * composant, sur une couture qui ne coupe aucun état en deux — les trois
 * valeurs vivent dans le bloc, qui les passe et les reçoit.
 *
 * Les bornes du champ de date viennent du domaine (`MAX_BACKDATE_DAYS`) : le
 * navigateur refuse donc ce que le serveur refuserait, et le refus arrive avant
 * le clic plutôt qu'après.
 */

interface Props {
  readonly quantity: string;
  readonly onQuantity: (value: string) => void;
  readonly day: string;
  readonly onDay: (value: string) => void;
  readonly contacts: readonly ManualContactOption[];
  readonly contact: ComboboxValue;
  readonly onContact: (value: ComboboxValue) => void;
}

/** La date du jour au format du champ `date`, dans le fuseau du navigateur. */
function todayInput(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function minInput(): string {
  const floor = new Date(Date.now() - MAX_BACKDATE_DAYS * 86_400_000);
  const month = String(floor.getMonth() + 1).padStart(2, "0");
  const day = String(floor.getDate()).padStart(2, "0");
  return `${floor.getFullYear()}-${month}-${day}`;
}

export function CounterInputs({
  quantity,
  onQuantity,
  day,
  onDay,
  contacts,
  contact,
  onContact,
}: Props) {
  return (
    <>
  {/*
    **Le nombre reste visible, la date et le contact passent derrière un dépli.**

    Le bloc est au-dessus du tableau de bord : chaque pixel qu'il prend pousse
    l'entonnoir et les tableaux vers le bas, et la recette l'a mesuré — le
    premier jet rendait la marche « contactés » **hors de l'écran** à 1440 × 900,
    et `reachable()` l'a signalé en échouant. Un bloc de saisie ne doit pas
    coûter la lecture de l'écran qui l'héberge.

    Le partage suit donc le cas courant : « +1 » et « +5 » se font sans rien
    ouvrir (le nombre est là, collé aux boutons), tandis qu'antidater et lier une
    fiche — plus rares — demandent un geste. La phrase qui dit ce que le contact
    change reste **toujours visible** : c'est la seule chose du bloc qui ne se
    devine pas.
  */}
  <div className="mt-2 flex items-center gap-2">
    <label className="text-[12px] text-muted" htmlFor="manual-quantity">
      par clic
    </label>
    <input
      id="manual-quantity"
      type="number"
      min={1}
      max={MAX_BATCH}
      value={quantity}
      onChange={(event) => onQuantity(event.target.value)}
      data-manual-quantity
      aria-label="Nombre de messages"
      className="w-16 rounded-control border border-line bg-surface px-2 py-1.5 text-center text-[13px] text-ink outline-none focus:border-brand"
    />
    <span className="text-[12px] text-muted">message(s)</span>
  </div>

  <p className="mt-2 text-[11.5px] leading-snug text-muted" data-manual-note>
    Avec un contact, le message compte aussi dans « nouvelles personnes contactées » et dans le
    taux de réponse. Sans contact, il compte seulement dans « messages envoyés ».
  </p>

  <details className="mt-1.5" data-manual-more>
    <summary className="cursor-pointer text-[12px] text-muted hover:text-brand-d">
      Antidater ou lier une fiche
    </summary>

    <div className="mt-2 flex flex-wrap items-end gap-2.5">
      <label className="text-[12px] text-muted">
        Date
        <input
          type="date"
          value={day === "" ? todayInput() : day}
          min={minInput()}
          max={todayInput()}
          onChange={(event) => onDay(event.target.value)}
          data-manual-date
          className="mt-0.5 block rounded-control border border-line bg-surface px-2 py-1.5 text-[13px] text-ink outline-none focus:border-brand"
        />
      </label>
      <div className="min-w-[200px] flex-1">
        <p className="text-[12px] text-muted">Contact (facultatif)</p>
        <div className="mt-0.5" data-manual-contact>
          <Combobox
            options={contacts}
            value={contact}
            onChange={onContact}
            placeholder="Chercher une fiche…"
            emptyLabel="Aucune fiche ne correspond"
          />
        </div>
      </div>
    </div>
  </details>
    </>
  );
}
