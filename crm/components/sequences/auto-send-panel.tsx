"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { requestJson } from "@/lib/client/http";
import { MIN_INTERVAL_SECONDS, type AutoSendSettings } from "@/lib/domain/auto-send";

/**
 * Le panneau de l'envoi automatique, en tête de « Départs du jour ».
 *
 * **Il dit ce qui se passe, pas ce qui est réglé.** Un interrupteur seul
 * laisserait la question qui compte sans réponse : le prochain mail part quand,
 * à qui, et combien en reste-t-il. La phrase est composée par le domaine
 * (`describePlan`) et rendue telle quelle : la recomposer ici en ferait une
 * seconde version, et c'est toujours la seconde qui finit par mentir.
 */

export interface AutoSendView {
  readonly settings: AutoSendSettings;
  readonly sentence: string;
  readonly plan: {
    readonly enabled: boolean;
    readonly remaining: number;
    readonly lateSeconds: number;
    readonly stoppedReason: string;
  };
  /** Ce qui a été retiré de la file aujourd'hui, et pourquoi. */
  readonly dropped: readonly { readonly name: string; readonly reason: string }[];
}

function isView(value: unknown): value is AutoSendView {
  return typeof value === "object" && value !== null && "sentence" in value && "settings" in value;
}

/** « 3 min 30 » plutôt que « 210 s » : c'est ainsi qu'on pense une cadence. */
function splitInterval(seconds: number): { minutes: number; rest: number } {
  return { minutes: Math.floor(seconds / 60), rest: seconds % 60 };
}

function toClock(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function fromClock(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (match === null) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function isSaved(value: unknown): value is { readonly status: AutoSendView } {
  if (typeof value !== "object" || value === null || !("status" in value)) return false;
  const bag: Record<string, unknown> = { ...value };
  return isView(bag["status"]);
}

export function AutoSendPanel({ initial }: { readonly initial: AutoSendView }) {
  const router = useRouter();
  const [view, setView] = useState<AutoSendView>(initial);
  const [draft, setDraft] = useState<AutoSendSettings>(initial.settings);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  /** Ne pas écraser ce que quelqu'un est en train de taper avec un rafraîchissement. */
  const editing = useRef(false);
  editing.current = open;

  /*
    **Le panneau se rafraîchit tant que l'envoi automatique tourne.** Sans cela,
    « prochain mail vers 10 h 42 » resterait à l'écran une heure après 10 h 42,
    et un écran qui annonce une heure dépassée est un écran qui ment. Il
    s'arrête de lui-même quand l'interrupteur est éteint : une page qui
    interroge le serveur toutes les cinq secondes sans rien à suivre est du
    bruit.
  */
  const refresh = useCallback(async () => {
    const result = await requestJson("/api/auto-send", {}, isView);
    if (!result.ok) return;
    setView(result.data);
    if (!editing.current) setDraft(result.data.settings);
  }, []);

  useEffect(() => {
    if (!view.plan.enabled) return;
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [view.plan.enabled, refresh]);

  const save = async (next: AutoSendSettings): Promise<void> => {
    setBusy(true);
    setError("");
    const result = await requestJson(
      "/api/auto-send",
      { method: "PATCH", body: JSON.stringify(next) },
      isSaved,
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setView(result.data.status);
    setDraft(result.data.status.settings);
    // La file a pu changer d'état pendant qu'on réglait : le serveur redit
    // qui reste, plutôt que le navigateur qui devine.
    router.refresh();
  };

  const { minutes, rest } = splitInterval(draft.intervalSeconds);
  const stopped = view.plan.stoppedReason !== "";
  const late = view.plan.lateSeconds > 0;

  return (
    <section
      className={`mx-6 mt-4 rounded-control border px-4 py-3 ${
        stopped
          ? "border-danger bg-[#FBEDEB]"
          : late
            ? "border-[#E8C37A] bg-[#FBF3E2]"
            : view.plan.enabled
              ? "border-win bg-win-l"
              : "border-line bg-paper"
      }`}
      aria-label="Envoi automatique"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] font-medium text-ink">{view.sentence}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save({ ...draft, enabled: !view.plan.enabled })}
            className={`min-h-[44px] rounded-control px-3 text-[13px] font-semibold text-white disabled:opacity-60 ${
              view.plan.enabled ? "bg-danger" : "bg-brand"
            }`}
          >
            {view.plan.enabled ? "Arrêter l'envoi automatique" : "Activer l'envoi automatique"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="min-h-[44px] rounded-control border border-line px-3 text-[13px]"
          >
            Réglages
          </button>
        </div>
      </div>

      {error !== "" && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}

      {/*
        **Un départ retiré de la file ne disparaît pas en silence.** Il quitte la
        file, c'est la règle du jalon 91 ; mais un envoi qui n'a pas eu lieu doit
        se lire quelque part, avec son motif.
      */}
      {view.dropped.length > 0 && (
        <ul className="mt-2 space-y-1 text-[12.5px] text-muted">
          {view.dropped.map((entry) => (
            <li key={`${entry.name}-${entry.reason}`}>
              <strong className="font-semibold text-ink">{entry.name}</strong> — retiré de la
              file : {entry.reason}
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 grid gap-3 border-t border-line-2 pt-3 sm:grid-cols-2">
          <label className="text-[12.5px]">
            <span className="block font-semibold uppercase tracking-wide text-muted">
              Intervalle
            </span>
            <span className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={minutes}
                aria-label="Intervalle, minutes"
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    intervalSeconds: Number(event.target.value) * 60 + rest,
                  })
                }
                className="w-20 rounded-control border border-line px-2 py-2"
              />
              <span>min</span>
              <input
                type="number"
                min={0}
                max={59}
                value={rest}
                aria-label="Intervalle, secondes"
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    intervalSeconds: minutes * 60 + Number(event.target.value),
                  })
                }
                className="w-20 rounded-control border border-line px-2 py-2"
              />
              <span>s</span>
            </span>
            <span className="mt-1 block text-muted">
              Une minute au moins : en dessous, ce n&apos;est plus une cadence.
            </span>
          </label>

          <label className="text-[12.5px]">
            <span className="block font-semibold uppercase tracking-wide text-muted">
              Fenêtre d&apos;envoi (heure de Paris, jours ouvrés)
            </span>
            <span className="mt-1 flex items-center gap-2">
              <input
                type="time"
                value={toClock(draft.startMinute)}
                aria-label="Début de la fenêtre"
                onChange={(event) => {
                  const minute = fromClock(event.target.value);
                  if (minute !== null) setDraft({ ...draft, startMinute: minute });
                }}
                className="rounded-control border border-line px-2 py-2"
              />
              <span>→</span>
              <input
                type="time"
                value={toClock(draft.endMinute)}
                aria-label="Fin de la fenêtre"
                onChange={(event) => {
                  const minute = fromClock(event.target.value);
                  if (minute !== null) setDraft({ ...draft, endMinute: minute });
                }}
                className="rounded-control border border-line px-2 py-2"
              />
            </span>
            <span className="mt-1 block text-muted">
              Rien ne part le samedi ni le dimanche : un brouillon écrit vendredi décrirait un
              état vieux de deux jours.
            </span>
          </label>

          <label className="flex items-start gap-2 text-[12.5px] sm:col-span-2">
            <input
              type="checkbox"
              checked={draft.vary}
              onChange={(event) => setDraft({ ...draft, vary: event.target.checked })}
              className="mt-1 h-5 w-5"
            />
            <span>
              <strong className="font-semibold">Varier l&apos;intervalle</strong> — chaque écart
              est tiré au hasard à plus ou moins 30 % de l&apos;intervalle, pour que la cadence
              ne soit pas régulière à la seconde.
            </span>
          </label>

          <div className="sm:col-span-2">
            <button
              type="button"
              disabled={busy || draft.intervalSeconds < MIN_INTERVAL_SECONDS}
              onClick={() => void save(draft)}
              className="min-h-[44px] rounded-control bg-brand px-3 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              Enregistrer les réglages
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
