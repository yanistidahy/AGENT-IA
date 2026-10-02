"use client";

import { useEffect, useState } from "react";
import { GROUP_LABELS, type ContactGroup } from "@/lib/domain/contact-group";
import {
  CUSTOM_SUBJECT_WARNING,
  editedVariant,
  subjectForGroup,
  SUBJECT_MODE_LABELS,
  SUBJECT_MODES,
  toSubjectMode,
  type OtherRouting,
  type StepSubjectSource,
  type StepVariant,
  type SubjectMode,
} from "@/lib/domain/step-variants";
import { STEP_ONE_SEEDS } from "@/lib/domain/step-variant-seeds";
import { ManualStepEditor, type SampleSet } from "./manual-step-editor";
import { GroupPreviews, VariantTabRow, type VariantTab } from "./variant-tabs";

/**
 * Le message d'une étape écrite à la main : le défaut, ses variantes, l'aperçu.
 *
 * Ce composant ne porte qu'**une** décision, et c'est celle de l'écran : quel
 * texte on est en train d'éditer. Le choix de ce qui partira réellement à un
 * contact vit dans le domaine (`templateFor`), et c'est lui que l'aperçu et la
 * composition appellent tous les deux.
 */
export function StepMessage({
  subject,
  body,
  variants,
  samples,
  otherRouting = "default",
  position,
  threadSteps,
  subjectMode = "thread",
  focusSubject = null,
  onWriteFirstSubject,
  onChange,
}: {
  readonly subject: string;
  readonly body: string;
  readonly variants: readonly StepVariant[];
  readonly samples: SampleSet;
  /** Le routage d'« Autre » et des non classés, lu sur la campagne. */
  readonly otherRouting?: OtherRouting;
  /** 1, 2 ou 3 — le pré-remplissage n'est proposé que sur la première étape. */
  readonly position: number;
  /**
   * **Toutes les étapes, telles que le décideur les lit** : leur objet, leur
   * mode et leurs variantes. C'est ce qui fait que l'écran voit exactement ce
   * que l'envoi verra — l'objet du fil se lit sur l'étape 1, groupe par groupe.
   */
  readonly threadSteps: readonly (StepSubjectSource & { readonly body: string })[];
  /** `thread` — l'objet de l'étape 1 ; `custom` — celui de cette étape. */
  readonly subjectMode?: SubjectMode;
  /**
   * Une demande d'ouverture venue d'une relance : « écrire l'objet dans l'étape
   * 1 », sur **le même groupe**. `key` change à chaque clic pour que deux
   * demandes successives sur le même onglet se distinguent.
   */
  readonly focusSubject?: { readonly tab: VariantTab; readonly key: number } | null;
  /** Ce que la relance appelle quand l'objet du fil manque pour son groupe. */
  readonly onWriteFirstSubject?: (tab: VariantTab) => void;
  readonly onChange: (change: {
    subject?: string;
    body?: string;
    subjectMode?: SubjectMode;
    variants?: readonly StepVariant[];
  }) => void;
}) {
  const [tab, setTab] = useState<VariantTab>("default");
  const [sampleId, setSampleId] = useState("");

  /*
    **Une demande venue d'une relance ouvre le bon onglet, puis demande le
    focus.** Deux clics successifs sur le même groupe doivent se distinguer, d'où
    la clé : sans elle, le second ne rejouerait pas l'effet et le champ ne
    reprendrait pas le focus — un lien qui ne fait rien la deuxième fois se lit
    comme une panne.
  */
  const [seen, setSeen] = useState(0);
  const asked = focusSubject !== null && focusSubject.key !== seen;
  useEffect(() => {
    if (focusSubject === null || focusSubject.key === seen) return;
    setTab(focusSubject.tab);
    setSeen(focusSubject.key);
  }, [focusSubject, seen]);

  const current = tab === "default" ? { subject, body } : editedVariant(variants, tab);
  /** Le mode effectif : l'étape 1 porte toujours son propre objet. */
  const mode: SubjectMode = position === 1 ? "thread" : toSubjectMode(subjectMode);

  const patch = (change: { subject?: string; body?: string }) => {
    if (tab === "default") {
      onChange(change);
      return;
    }
    const group = tab as ContactGroup;
    const next = { subject: current.subject, body: current.body, ...change, group };
    onChange({
      variants: [...variants.filter((variant) => variant.group !== group), next],
    });
  };

  /*
    **Le pré-remplissage n'écrase rien.** Une variante déjà écrite est laissée
    telle quelle : un bouton qui remettrait le texte d'usine sur ce qu'on vient
    de relire serait un bouton qu'on n'ose plus cliquer.
  */
  const seed = () => {
    const kept = new Map(variants.map((variant) => [variant.group, variant]));
    for (const [group, template] of Object.entries(STEP_ONE_SEEDS)) {
      if (template.subject === "" && template.body === "") continue;
      if (kept.has(group as ContactGroup)) continue;
      kept.set(group as ContactGroup, { group: group as ContactGroup, ...template });
    }
    onChange({ variants: [...kept.values()] });
  };

  return (
    <>
      <VariantTabRow
        tab={tab}
        step={{ subject, body }}
        variants={variants}
        onTab={setTab}
        onSeed={position === 1 ? seed : null}
      />
      {position > 1 && (
        /*
          **Le choix est au-dessus du champ, pas dans un réglage à part.** C'est
          là qu'on se demande « est-ce que je garde la conversation ? », et la
          conséquence se lit avant de cliquer plutôt qu'après l'envoi.
        */
        <fieldset className="sm:col-span-2 mt-2 rounded-control border border-line p-2.5">
          <legend className="px-1 text-[11.5px] font-semibold text-muted">
            Objet de cette relance
          </legend>
          <div className="flex flex-col gap-1.5">
            {SUBJECT_MODES.map((value) => (
              <label key={value} className="flex items-start gap-2 text-[12.5px]">
                <input
                  type="radio"
                  name={`subject-mode-${position}`}
                  data-subject-mode={value}
                  checked={mode === value}
                  onChange={() => onChange({ subjectMode: value })}
                  className="mt-0.5"
                />
                <span>{SUBJECT_MODE_LABELS[value]}</span>
              </label>
            ))}
          </div>
          {mode === "custom" && (
            <p
              data-custom-subject-warning="1"
              className="mt-2 rounded-control border border-gold bg-gold-l px-2 py-1 text-[11.5px] text-ink"
            >
              {CUSTOM_SUBJECT_WARNING}
            </p>
          )}
        </fieldset>
      )}
      <ManualStepEditor
        subject={current.subject}
        body={current.body}
        samples={samples}
        sampleId={sampleId}
        onSample={setSampleId}
        onChange={patch}
        tab={tab}
        /*
          **Verrouillé seulement en mode « Garder ».** Le champ est alors
          remplacé par l'objet du fil de **ce groupe** et par la raison — le
          masquer sans rien dire ferait chercher un champ disparu. En mode
          « Objet personnalisé », `null` rend le champ éditable, avec les puces,
          les replis et le refus de {video} comme sur l'étape 1.
        */
        lockedSubject={
          position === 1 || mode === "custom"
            ? null
            : subjectForGroup(threadSteps, position, tab === "default" ? null : tab).template
        }
        /* Le lien de secours, quand le fil n'a pas d'objet pour ce groupe. */
        onWriteFirstSubject={
          position === 1 || onWriteFirstSubject === undefined
            ? undefined
            : () => onWriteFirstSubject(tab)
        }
        focusSubject={position === 1 && asked}
        scope={
          tab === "default"
            ? "le message par défaut de cette étape"
            : `la variante « ${GROUP_LABELS[tab]} »`
        }
      />
      {/*
        **L'aperçu appelle le décideur, comme l'envoi.** `subjectForGroup` tranche
        entre l'objet du fil et l'objet personnalisé, et `renderSubjectPlan`
        applique le repli de vide : un aperçu calculé autrement montrerait un
        objet que l'envoi ne produit pas.
      */}
      <GroupPreviews
        steps={threadSteps}
        position={position}
        variants={variants}
        samples={samples}
        otherRouting={otherRouting}
      />
    </>
  );
}
