"use client";

import { useState } from "react";
import { requestJson } from "@/lib/client/http";
import { AUTO_MIN_VALIDATED, MAX_STEPS } from "@/lib/domain/sequence-rules";

/**
 * Les séquences d'emails, et l'interrupteur qui ne s'active pas tout seul.
 *
 * **Le mode automatique dit pourquoi il est verrouillé.** Un interrupteur grisé
 * sans explication se lit comme une panne, et on cherche comment le forcer ;
 * un interrupteur qui annonce « il manque 14 départs validés à la main et au
 * moins une réponse » énonce un contrat qu'on peut remplir.
 *
 * Il est verrouillé à l'écran **et** revérifié au serveur : l'écran n'est pas la
 * seule porte, et c'est la même leçon que l'acceptation groupée des domaines du
 * jalon 26.
 */

export interface SequenceStepView {
  id?: string;
  position: number;
  delayDays: number;
  brief: string;
}

export interface SequenceView {
  id: string;
  name: string;
  active: boolean;
  autoMode: boolean;
  steps: SequenceStepView[];
  enrolled: number;
  running: number;
  unlock: { unlocked: boolean; validated: number; replies: number; reason: string };
}

function isPayload(value: unknown): value is { sequences: SequenceView[] } {
  return typeof value === "object" && value !== null && "sequences" in value;
}

const FIELD =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none";
const BUTTON =
  "rounded-control px-3 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-50";

export function EmailSequencesPanel({ initial }: { readonly initial: readonly SequenceView[] }) {
  const [sequences, setSequences] = useState<SequenceView[]>([...initial]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const patch = (id: string, change: Partial<SequenceView>) =>
    setSequences((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)),
    );

  const save = async (sequence: SequenceView) => {
    setBusy(true);
    setError(null);
    setDone(null);
    const result = await requestJson(
      "/api/sequences-email",
      {
        method: "POST",
        body: JSON.stringify({
          id: sequence.id === "" ? undefined : sequence.id,
          name: sequence.name,
          active: sequence.active,
          autoMode: sequence.autoMode,
          steps: sequence.steps.map((step) => ({
            delayDays: step.delayDays,
            brief: step.brief,
          })),
        }),
      },
      isPayload,
    );
    setBusy(false);
    if (result.ok) {
      setSequences(result.data.sequences);
      setDone("Séquence enregistrée.");
    } else setError(result.message);
  };

  const create = () =>
    setSequences((current) => [
      ...current,
      {
        id: "",
        name: "Nouvelle séquence",
        active: false,
        autoMode: false,
        steps: [{ position: 1, delayDays: 0, brief: "" }],
        enrolled: 0,
        running: 0,
        unlock: { unlocked: false, validated: 0, replies: 0, reason: "" },
      },
    ]);

  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-muted">
        Ces séquences <b className="font-semibold text-ink">envoient des emails</b> — à ne pas
        confondre avec les séquences de tâches plus bas, qui créent des rappels à faire à la
        main. Trois étapes au maximum : une séquence qui s'arrête d'elle-même limite les dégâts
        d'une réponse non repérée mieux que n'importe quel mécanisme.
      </p>

      {sequences.map((sequence) => (
        <section
          key={sequence.id === "" ? "new" : sequence.id}
          className="rounded-card border border-line bg-surface-2 p-3.5"
        >
          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <input
              className={FIELD}
              value={sequence.name}
              onChange={(event) => patch(sequence.id, { name: event.target.value })}
            />
            <label className="flex items-center gap-1.5 text-[12.5px]">
              <input
                type="checkbox"
                checked={sequence.active}
                onChange={(event) => patch(sequence.id, { active: event.target.checked })}
              />
              Active
            </label>
            <span className="self-center text-[12px] text-muted">
              {sequence.running} en cours · {sequence.enrolled} inscrits
            </span>
          </div>

          <ol className="mt-3 space-y-2">
            {sequence.steps.map((step, index) => (
              <li key={index} className="grid gap-2 sm:grid-cols-[7rem_1fr_auto]">
                <label>
                  <span className="block text-[11.5px] font-semibold text-muted">
                    {index === 0 ? "Jour 0" : "Jours après"}
                  </span>
                  <input
                    className={FIELD}
                    type="number"
                    value={step.delayDays}
                    disabled={index === 0}
                    onChange={(event) =>
                      patch(sequence.id, {
                        steps: sequence.steps.map((entry, position) =>
                          position === index
                            ? { ...entry, delayDays: Number(event.target.value) }
                            : entry,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  <span className="block text-[11.5px] font-semibold text-muted">
                    Consigne donnée à Alex pour l'étape {index + 1}
                  </span>
                  <input
                    className={FIELD}
                    value={step.brief}
                    placeholder="ex. rappeler la démonstration sans répéter le premier message"
                    onChange={(event) =>
                      patch(sequence.id, {
                        steps: sequence.steps.map((entry, position) =>
                          position === index ? { ...entry, brief: event.target.value } : entry,
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="self-end text-[11.5px] font-semibold text-[#B2311F] underline disabled:opacity-40"
                  disabled={sequence.steps.length === 1}
                  onClick={() =>
                    patch(sequence.id, {
                      steps: sequence.steps.filter((_, position) => position !== index),
                    })
                  }
                >
                  Retirer
                </button>
              </li>
            ))}
          </ol>

          {sequence.steps.length < MAX_STEPS && (
            <button
              type="button"
              className="mt-2 text-[12px] font-semibold text-brand underline"
              onClick={() =>
                patch(sequence.id, {
                  steps: [
                    ...sequence.steps,
                    { position: sequence.steps.length + 1, delayDays: 4, brief: "" },
                  ],
                })
              }
            >
              Ajouter une étape ({sequence.steps.length} sur {MAX_STEPS})
            </button>
          )}

          <div className="mt-3 rounded-control border border-line bg-surface px-3 py-2">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={sequence.autoMode}
                disabled={!sequence.unlock.unlocked}
                onChange={(event) => patch(sequence.id, { autoMode: event.target.checked })}
              />
              <span className="text-[12.5px]">
                <b className="font-semibold">Mode automatique</b> — les étapes 2 et 3 partent
                sans validation.{" "}
                <span className="text-muted">
                  La première étape passe toujours par vous : un premier message froid engage la
                  réputation du domaine.
                </span>
                <span className="mt-0.5 block text-[11.5px] text-muted">
                  {sequence.unlock.unlocked
                    ? `Déverrouillé : ${sequence.unlock.validated} départs validés à la main (${AUTO_MIN_VALIDATED} requis) et ${sequence.unlock.replies} réponse(s) obtenue(s).`
                    : `Verrouillé. ${sequence.unlock.reason}`}
                </span>
              </span>
            </label>
          </div>

          <button
            type="button"
            className={`${BUTTON} mt-3 bg-brand text-white hover:bg-brand-d`}
            disabled={busy}
            onClick={() => void save(sequence)}
          >
            Enregistrer
          </button>
        </section>
      ))}

      {error !== null && (
        <p className="rounded-control border border-[#F5D5CF] bg-pulse-l px-3 py-2 text-[12.5px] text-[#B2311F]">
          {error}
        </p>
      )}
      {done !== null && (
        <p className="rounded-control border border-[#BEE3DA] bg-win-l px-3 py-2 text-[12.5px] text-win-d">
          {done}
        </p>
      )}

      <button
        type="button"
        className={`${BUTTON} border border-line hover:bg-surface-2`}
        onClick={create}
      >
        Nouvelle séquence d'emails
      </button>
    </div>
  );
}
