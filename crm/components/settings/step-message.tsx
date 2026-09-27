"use client";

import { useState } from "react";
import { GROUP_LABELS, type ContactGroup } from "@/lib/domain/contact-group";
import { editedVariant, type StepVariant } from "@/lib/domain/step-variants";
import { STEP_ONE_SEEDS } from "@/lib/domain/step-variant-seeds";
import { ManualStepEditor, type SampleContact } from "./manual-step-editor";
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
  position,
  onChange,
}: {
  readonly subject: string;
  readonly body: string;
  readonly variants: readonly StepVariant[];
  readonly samples: readonly SampleContact[];
  /** 1, 2 ou 3 — le pré-remplissage n'est proposé que sur la première étape. */
  readonly position: number;
  readonly onChange: (change: {
    subject?: string;
    body?: string;
    variants?: readonly StepVariant[];
  }) => void;
}) {
  const [tab, setTab] = useState<VariantTab>("default");
  const [sampleId, setSampleId] = useState("");

  const current = tab === "default" ? { subject, body } : editedVariant(variants, tab);

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
        scope={
          tab === "default"
            ? "le message par défaut de cette étape"
            : `la variante « ${GROUP_LABELS[tab]} »`
        }
      />
      <GroupPreviews step={{ subject, body }} variants={variants} samples={samples} />
    </>
  );
}
