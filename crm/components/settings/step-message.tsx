"use client";

import { useEffect, useState } from "react";
import { GROUP_LABELS, type ContactGroup } from "@/lib/domain/contact-group";
import {
  editedVariant,
  threadSubjectFor,
  threadTemplate,
  type OtherRouting,
  type StepVariant,
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
  firstVariants,
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
  /** Toutes les étapes — l'objet du fil se lit sur l'étape 1, groupe par groupe. */
  readonly threadSteps: readonly {
    readonly position: number;
    readonly subject: string;
    readonly body: string;
  }[];
  /** Les variantes de l'étape 1 : ce sont elles qui portent l'objet du fil. */
  readonly firstVariants: readonly StepVariant[];
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
  /** Le gabarit tel qu'il partira : objet du fil compris, groupe par groupe. */
  const thread = threadTemplate(threadSteps, position, variants, firstVariants);

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
      <ManualStepEditor
        subject={current.subject}
        body={current.body}
        samples={samples}
        sampleId={sampleId}
        onSample={setSampleId}
        onChange={patch}
        tab={tab}
        /*
          Sur une relance, l'objet ne se saisit pas : il vient de l'étape 1.
          Le champ est remplacé par sa valeur en lecture seule et la raison —
          le masquer sans rien dire ferait chercher un champ disparu.
        */
        /*
          **L'objet du fil de CE groupe** : la variante d'étape 1 du même
          groupe, à défaut l'objet par défaut de l'étape 1. C'était le défaut —
          l'écran ne lisait que le défaut, et annonçait « l'étape 1 ne porte pas
          encore d'objet » au-dessus d'un groupe qui en avait un.
        */
        lockedSubject={
          position === 1
            ? null
            : threadSubjectFor(
                threadSteps,
                position,
                firstVariants,
                tab === "default" ? null : tab,
              )
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
        **L'aperçu montre le gabarit du fil**, pas celui de l'étape : sur une
        relance, l'objet vient de l'étape 1 groupe par groupe, et c'est
        `threadTemplate` — la fonction de la composition — qui l'applique. Un
        aperçu calculé autrement montrerait un objet que l'envoi ne produit pas.
      */}
      <GroupPreviews
        step={thread.step}
        variants={thread.variants}
        samples={samples}
        otherRouting={otherRouting}
      />
    </>
  );
}
