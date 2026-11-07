"use client";

import { useCallback, useEffect, useState } from "react";
import type { ComboboxValue } from "@/components/ui/combobox";
import { CounterFooter } from "./manual-counter-footer";
import { CounterInputs } from "./manual-counter-inputs";
import {
  MANUAL_CHANNELS,
  MANUAL_SHAPES,
  tallyTotal,
  type ManualChannel,
} from "@/lib/domain/manual-count";

/**
 * **« Messages manuels » : compter en un geste, depuis un téléphone.**
 *
 * Le bloc est conçu pour l'usage réel qu'il sert : on vient d'envoyer trois DM
 * LinkedIn, on sort le téléphone, on compte. Trois conséquences de forme :
 *
 * 1. **un bouton par canal, atteignable sans réglage préalable.** Le
 *    propriétaire et le contact sont des réglages ; les cinq boutons sont le
 *    geste. Demander de choisir avant de compter ferait renoncer à compter ;
 * 2. **les cibles tactiles font 44 px** (règle du jalon 46) et la grille passe
 *    à une colonne sous 420 px : pas de défilement horizontal à 390 px ;
 * 3. **le propriétaire est mémorisé par appareil**, pas par compte. Le même
 *    espace de travail sert deux personnes (jalon 9 : un seul mot de passe
 *    partagé), et c'est l'appareil qui dit qui tape. `localStorage` est lu dans
 *    un `try/catch` : en navigation privée, avec les données de site bloquées,
 *    l'accès **lève** au lieu de rendre `null`, et un bloc qui tombe pour cela
 *    serait inutilisable là où il sert le plus.
 *
 * ## Ce que le bloc dit, et qu'il faut dire
 *
 * « Avec un contact, le message compte aussi dans les nouvelles personnes
 * contactées ; sans contact, il compte seulement dans les messages envoyés. »
 * C'est la seule chose qui ne se devine pas, et la phrase est sous le bloc.
 */

export interface ManualTallyView {
  readonly channel: string;
  readonly label: string;
  readonly count: number;
}

export interface ManualEntryView {
  readonly entryId: string;
  readonly channel: string;
  readonly label: string;
  readonly count: number;
  readonly at: string;
  readonly owner: string;
  readonly contactId: string | null;
  readonly contactName: string;
}

export interface ManualContactOption {
  readonly id: string;
  readonly label: string;
}

interface Props {
  readonly owners: readonly string[];
  readonly contacts: readonly ManualContactOption[];
  readonly initialToday: readonly ManualTallyView[];
  readonly initialHistory: readonly ManualEntryView[];
}

/** La clé du propriétaire retenu. Nommée pour qu'on la retrouve dans un débogueur. */
const OWNER_KEY = "auraflow.manual-counter.owner";

/**
 * Lit et écrit `localStorage` **sans jamais lever**.
 *
 * Ce n'est pas de la prudence décorative : l'accès lève en navigation privée et
 * quand les données de site sont bloquées, et le bloc doit rester utilisable —
 * il demandera simplement qui tape à chaque fois, ce qui est le repli honnête.
 */
function readOwner(): string {
  try {
    return window.localStorage.getItem(OWNER_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeOwner(value: string): void {
  try {
    window.localStorage.setItem(OWNER_KEY, value);
  } catch {
    // Rien à faire : le choix vaudra pour cette visite seulement.
  }
}

interface Reply {
  readonly message?: string;
  readonly today?: readonly ManualTallyView[];
  readonly history?: readonly ManualEntryView[];
  readonly error?: { readonly message?: string };
}

export function ManualCounter({ owners, contacts, initialToday, initialHistory }: Props) {
  const [owner, setOwner] = useState("");
  const [askOwner, setAskOwner] = useState(false);
  /*
    **Rien d'« à propos du propriétaire » n'est rendu avant le montage.**

    Le serveur ne connaît pas `localStorage` : il rendrait donc « Qui a envoyé
    ces messages ? » même sur un appareil qui a déjà répondu, et l'effet le
    remplacerait aussitôt. Deux conséquences, mesurées à la recette : un
    clignotement à chaque chargement, et une **course** — le test de navigateur
    a vu le bloc de choix, puis l'a trouvé disparu au moment de cliquer.

    On rend donc une ligne de réserve de la même hauteur jusqu'au montage.
    L'écran ne saute pas, et l'état affiché est toujours l'état réel.
  */
  const [mounted, setMounted] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [day, setDay] = useState("");
  const [contact, setContact] = useState<ComboboxValue>({ kind: "none" });
  const [today, setToday] = useState<readonly ManualTallyView[]>(initialToday);
  const [history, setHistory] = useState<readonly ManualEntryView[]>(initialHistory);
  const [busy, setBusy] = useState("");
  const [said, setSaid] = useState("");

  /*
    Le propriétaire est lu **après le montage**, jamais au rendu : le serveur ne
    connaît pas `localStorage`, et l'y lire ferait diverger les deux rendus.
    C'est la cause des avertissements d'hydratation, et on ne la crée pas.
  */
  useEffect(() => {
    setMounted(true);
    const remembered = readOwner();
    if (remembered !== "" && owners.includes(remembered)) {
      setOwner(remembered);
      return;
    }
    // Rien de retenu : on demande, plutôt que de choisir à la place de
    // quelqu'un. Un propriétaire faux fausse le filtre « par personne ».
    setAskOwner(true);
  }, [owners]);

  function chooseOwner(value: string): void {
    setOwner(value);
    writeOwner(value);
    setAskOwner(false);
  }

  const apply = useCallback((reply: Reply, fallback: string) => {
    setSaid(reply.message ?? reply.error?.message ?? fallback);
    if (reply.today !== undefined) setToday(reply.today);
    if (reply.history !== undefined) setHistory(reply.history);
  }, []);

  async function count(channel: ManualChannel): Promise<void> {
    if (owner === "") {
      setAskOwner(true);
      setSaid("Dites d'abord qui a envoyé ces messages.");
      return;
    }
    setBusy(channel);
    setSaid("");
    try {
      const response = await fetch("/api/outreach/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          quantity: Number.parseInt(quantity, 10),
          owner,
          contactId: contact.kind === "existing" ? contact.id : null,
          at: day === "" ? undefined : new Date(`${day}T12:00:00`).toISOString(),
        }),
      });
      apply((await response.json()) as Reply, "Réponse inattendue.");
    } catch {
      setSaid("L'appel a échoué : l'application n'a pas répondu.");
    } finally {
      setBusy("");
    }
  }

  async function undo(entryId: string): Promise<void> {
    setBusy(entryId);
    setSaid("");
    try {
      const response = await fetch("/api/outreach/manual", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId }),
      });
      apply((await response.json()) as Reply, "Réponse inattendue.");
    } catch {
      setSaid("L'appel a échoué : l'application n'a pas répondu.");
    } finally {
      setBusy("");
    }
  }

  const last = history[0];
  // Le total vient du domaine : un écran de mesure n'additionne pas (jalon 109).
  const total = tallyTotal(today);

  return (
    <section
      id="messages-manuels"
      data-manual-counter
      className="rounded-card border border-line bg-surface p-3.5"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-title text-[15px] text-ink">Messages manuels</h2>
        <span className="text-[12px] text-muted" data-manual-today-total>
          {total === 0 ? "rien aujourd'hui" : `${total} aujourd'hui`}
        </span>
      </header>

      {/* Qui tape : demandé une fois, retenu par appareil. */}
      {!mounted ? (
        <p className="mt-1.5 h-[18px] text-[12.5px] text-muted" aria-hidden data-manual-owner-pending />
      ) : askOwner || owner === "" ? (
        <div className="mt-2.5" data-manual-owner-ask>
          <p className="text-[12.5px] text-muted">Qui a envoyé ces messages ?</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {owners.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => chooseOwner(name)}
                data-manual-owner={name}
                className="min-h-11 rounded-control border border-line px-3 text-[13px] font-medium text-ink hover:bg-brand-l"
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-1.5 text-[12.5px] text-muted">
          Au nom de <strong className="text-ink">{owner}</strong>{" "}
          <button
            type="button"
            onClick={() => setAskOwner(true)}
            data-manual-owner-change
            className="underline hover:text-brand-d"
          >
            changer
          </button>
        </p>
      )}

      {/* Les cinq boutons. Une colonne sous 420 px, deux au-delà. */}
      <div className="mt-2.5 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        {MANUAL_CHANNELS.map((channel) => (
          <button
            key={channel}
            type="button"
            onClick={() => void count(channel)}
            disabled={busy !== ""}
            data-manual-add={channel}
            className="flex min-h-11 items-center justify-between gap-2 rounded-control border border-line bg-white px-3 text-[13px] font-medium text-ink hover:border-brand hover:bg-brand-l/50 disabled:opacity-60"
          >
            <span className="truncate">{MANUAL_SHAPES[channel].label}</span>
            <span className="shrink-0 rounded-full bg-brand px-2 py-0.5 text-[12px] text-white">
              +{quantity === "" ? 1 : quantity}
            </span>
          </button>
        ))}
      </div>

      <CounterInputs
        quantity={quantity}
        onQuantity={setQuantity}
        day={day}
        onDay={setDay}
        contacts={contacts}
        contact={contact}
        onContact={setContact}
      />

      <CounterFooter
        today={today}
        last={last}
        history={history}
        said={said}
        busy={busy}
        onUndo={(id) => void undo(id)}
      />
    </section>
  );
}
