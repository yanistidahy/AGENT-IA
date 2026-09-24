"use client";

import { useState } from "react";
import {
  connectorLabel,
  describeTiming,
  moveStep,
  stepDays,
  stepPreview,
} from "@/lib/domain/sequence-steps";
import { MAX_STEPS } from "@/lib/domain/sequence-rules";
import { toStepMode, type StepMode } from "@/lib/domain/merge-tags";
import { ManualStepEditor, type SampleContact } from "./manual-step-editor";

/**
 * Les étapes d'une séquence, en frise.
 *
 * **Une séquence est une suite dans le temps, et l'écran le montre enfin.**
 * Trois rangées de champs alignées se lisaient comme un tableau de réglages :
 * il fallait ouvrir chaque champ pour savoir ce que la séquence raconte, et le
 * rythme — quatre jours, puis sept — n'apparaissait nulle part. Chaque étape a
 * donc son bloc numéroté, et le délai vit **sur le connecteur** entre deux
 * blocs, là où il décrit le passage de l'un à l'autre.
 *
 * **Repliées par défaut.** On vient d'abord voir la structure ; on ouvre celle
 * qu'on veut écrire. Le repli n'est pas un gain de place, c'est l'ordre des
 * deux questions.
 *
 * **La numérotation est l'indice, jamais une valeur stockée.** Retirer la
 * deuxième étape renumérote la troisième par construction — il n'existe aucun
 * état à recalculer, donc aucun « Étape 1, Étape 3 » possible.
 */

export interface StepDraft {
  id?: string;
  position: number;
  delayDays: number;
  brief: string;
  /** `alex` — Alex écrit ; `manual` — le texte est écrit à la main (jalon 87). */
  mode?: StepMode;
  subject?: string;
  body?: string;
  /** Le dernier objet réellement composé pour cette étape, s'il y en a un. */
  lastSubject?: string;
}

const FIELD =
  "w-full rounded-control border border-line bg-surface px-2.5 py-1.5 text-[13px] focus:border-brand focus:outline-none";
const ICON =
  "flex h-11 w-11 items-center justify-center rounded-control border border-line text-[13px] leading-none text-muted hover:border-brand hover:text-brand-d disabled:opacity-35 disabled:hover:border-line disabled:hover:text-muted lg:h-[30px] lg:w-[30px]";

export function SequenceSteps({
  steps,
  samples = [],
  onChange,
}: {
  readonly steps: readonly StepDraft[];
  /** Quelques inscrits réels, pour l'aperçu d'une étape écrite à la main. */
  readonly samples?: readonly SampleContact[];
  readonly onChange: (steps: StepDraft[]) => void;
}) {
  // Repliées par défaut : l'état ne porte que les exceptions.
  const [open, setOpen] = useState<readonly number[]>([]);
  const [sampleId, setSampleId] = useState("");
  const timings = stepDays(steps);

  const toggle = (index: number) =>
    setOpen((current) =>
      current.includes(index)
        ? current.filter((entry) => entry !== index)
        : [...current, index],
    );

  const patch = (index: number, change: Partial<StepDraft>) =>
    onChange(steps.map((step, position) => (position === index ? { ...step, ...change } : step)));

  const move = (index: number, direction: -1 | 1) => {
    onChange(moveStep(steps, index, direction));
    // Le repli suit le bloc déplacé : rouvrir au hasard après une flèche
    // donnerait l'impression que le contenu a bougé tout seul.
    setOpen((current) =>
      current.map((entry) =>
        entry === index ? index + direction : entry === index + direction ? index : entry,
      ),
    );
  };

  const remove = (index: number) => {
    onChange(steps.filter((_, position) => position !== index));
    setOpen([]);
  };

  return (
    <div className="mt-3">
      <ol className="space-y-0">
        {steps.map((step, index) => {
          const timing = timings[index] ?? { delayDays: 0, day: 0 };
          const mode = toStepMode(step.mode ?? "");
          const manual = mode === "manual";
          const preview = stepPreview(manual ? (step.body ?? "") : step.brief, mode);
          const expanded = open.includes(index);

          return (
            <li key={step.id ?? index}>
              {/*
                Le connecteur **avant** le bloc, sauf pour le premier : c'est
                l'attente entre l'étape précédente et celle-ci, donc elle se lit
                au-dessus du bloc qu'elle annonce. Verticale seule — la frise se
                lit à l'identique à 390 px, sans variante mobile à maintenir.

                Le trait est calé à 27 px — le centre de la pastille numérotée
                (12 px de marge du bloc, plus la moitié des 30 px du cercle) —
                pour que la frise passe *par* les numéros au lieu de longer le
                bord.
              */}
              {index > 0 && (
                <div className="flex items-center gap-2 pl-[27px]">
                  <span className="h-8 w-px shrink-0 bg-line" aria-hidden="true" />
                  <span className="rounded-control border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10.5px] tracking-[0.06em] text-muted">
                    {connectorLabel(timing.delayDays)}
                  </span>
                </div>
              )}

              <section className="rounded-card border border-line bg-surface p-3">
                <div className="flex flex-wrap items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-brand-l font-mono text-[12px] font-semibold text-brand-d"
                  >
                    {index + 1}
                  </span>

                  <button
                    type="button"
                    onClick={() => toggle(index)}
                    aria-expanded={expanded}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block text-[13px] font-semibold text-ink">
                      Étape {index + 1}
                      {/* Sous le titre à l'étroit, à côté dès qu'il y a la place. */}
                      <span className="mt-0.5 block font-normal text-muted sm:mt-0 sm:ml-2 sm:inline">
                        {describeTiming(index, timing)}
                      </span>
                    </span>
                    <span
                      className={`mt-0.5 block truncate text-[12px] ${
                        preview.empty ? "text-danger" : "text-muted"
                      }`}
                    >
                      {preview.text}
                    </span>
                    {step.lastSubject !== undefined && step.lastSubject !== "" && (
                      <span className="mt-0.5 block truncate text-[11.5px] text-muted">
                        Dernier objet composé : « {step.lastSubject} »
                      </span>
                    )}
                    <span className="mt-1 inline-block rounded-control border border-line-2 px-1.5 py-0.5 text-[11px] text-muted">
                      {preview.empty
                        ? manual
                          ? "Sans texte"
                          : "Sans consigne"
                        : manual
                          ? "Écrite à la main"
                          : "Rédigée par Alex"}
                    </span>
                  </button>

                  {/*
                    Les commandes passent sur leur propre rangée à l'étroit :
                    coincées à côté du titre, elles laissaient à l'aperçu une
                    colonne de quelques mots.
                  */}
                  <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:w-auto">
                    <button
                      type="button"
                      className={ICON}
                      disabled={index === 0}
                      aria-label={`Monter l'étape ${index + 1}`}
                      onClick={() => move(index, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={ICON}
                      disabled={index === steps.length - 1}
                      aria-label={`Descendre l'étape ${index + 1}`}
                      onClick={() => move(index, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={ICON}
                      aria-expanded={expanded}
                      aria-label={`${expanded ? "Replier" : "Ouvrir"} l'étape ${index + 1}`}
                      onClick={() => toggle(index)}
                    >
                      {expanded ? "▴" : "▾"}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[8rem_1fr]">
                    <label>
                      <span className="block text-[11.5px] font-semibold text-muted">
                        {index === 0 ? "Jour 0" : "Jours après l'étape précédente"}
                      </span>
                      <input
                        className={FIELD}
                        type="number"
                        min={0}
                        value={step.delayDays}
                        disabled={index === 0}
                        title={
                          index === 0
                            ? "La première étape part le jour de l'inscription."
                            : undefined
                        }
                        onChange={(event) =>
                          patch(index, { delayDays: Number(event.target.value) })
                        }
                      />
                    </label>
                    <fieldset className="min-w-0">
                      <legend className="block text-[11.5px] font-semibold text-muted">
                        Qui écrit cette étape
                      </legend>
                      {/*
                        Le choix est par étape, pas par campagne : on peut écrire
                        le premier message à la main et laisser la relance à
                        Alex, ou l'inverse. Rien n'est effacé en basculant — la
                        consigne et le texte cohabitent en base, et revenir en
                        arrière rend ce qu'on avait écrit.
                      */}
                      <div className="mt-1 flex gap-1.5">
                        {(["alex", "manual"] as const).map((value) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={mode === value}
                            onClick={() => patch(index, { mode: value })}
                            className={`min-h-[44px] flex-1 rounded-control border px-2 text-[12px] lg:min-h-0 lg:py-1.5 ${
                              mode === value
                                ? "border-brand bg-brand-l font-semibold text-brand-d"
                                : "border-line bg-surface text-muted hover:border-brand"
                            }`}
                          >
                            {value === "alex" ? "Rédigée par Alex" : "Écrite à la main"}
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    {manual ? (
                      <ManualStepEditor
                        subject={step.subject ?? ""}
                        body={step.body ?? ""}
                        samples={samples}
                        sampleId={sampleId}
                        onSample={setSampleId}
                        onChange={(change) => patch(index, change)}
                      />
                    ) : (
                      <label>
                        <span className="block text-[11.5px] font-semibold text-muted">
                          Consigne donnée à Alex pour l&apos;étape {index + 1}
                        </span>
                        <input
                          className={FIELD}
                          value={step.brief}
                          placeholder="ex. rappeler la démonstration sans répéter le premier message"
                          onChange={(event) => patch(index, { brief: event.target.value })}
                        />
                      </label>
                    )}
                    <button
                      type="button"
                      className="justify-self-start text-[11.5px] font-semibold text-danger underline disabled:opacity-40 sm:col-span-2"
                      disabled={steps.length === 1}
                      title={
                        steps.length === 1
                          ? "Une séquence a au moins une étape."
                          : "Les étapes suivantes se renumérotent."
                      }
                      onClick={() => remove(index)}
                    >
                      Retirer l&apos;étape {index + 1}
                    </button>
                  </div>
                )}
              </section>
            </li>
          );
        })}
      </ol>

      {steps.length < MAX_STEPS && (
        <button
          type="button"
          className="mt-2 text-[12px] font-semibold text-brand underline"
          onClick={() =>
            onChange([
              ...steps,
              { position: steps.length + 1, delayDays: 4, brief: "", mode: "alex" },
            ])
          }
        >
          Ajouter une étape ({steps.length} sur {MAX_STEPS})
        </button>
      )}
    </div>
  );
}
