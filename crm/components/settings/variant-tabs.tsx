"use client";

import { CONTACT_GROUPS, GROUP_LABELS, type ContactGroup } from "@/lib/domain/contact-group";
import { renderSubject, renderTemplate } from "@/lib/domain/merge-tags";
import {
  describeChoice,
  isWrittenVariant,
  templateFor,
  type StepVariant,
} from "@/lib/domain/step-variants";
import { STEP_ONE_SEEDS } from "@/lib/domain/step-variant-seeds";
import type { SampleContact } from "./manual-step-editor";

/**
 * **La rangée des variantes, et l'aperçu par groupe.**
 *
 * Deux choses que l'éditeur ne peut pas dire tout seul :
 *
 * 1. **quel texte on est en train d'écrire** — « Défaut » ou l'un des quatre
 *    groupes. Une pastille dit lesquels portent déjà un texte, parce qu'un
 *    groupe sans variante reçoit le défaut et qu'on veut le savoir avant
 *    d'envoyer, pas après ;
 * 2. **ce que chaque groupe recevra**, sur un contact réel de ce groupe, avec le
 *    nom de la variante utilisée. Sans cette dernière mention, un aperçu du
 *    défaut et un aperçu d'une variante se ressemblent, et l'on croit avoir
 *    écrit une variante qu'on n'a pas enregistrée.
 *
 * Le rendu passe par **les mêmes fonctions que la composition** : un aperçu
 * calculé autrement montrerait un texte que l'envoi ne produit pas.
 */

export type VariantTab = "default" | ContactGroup;

export function VariantTabRow({
  tab,
  step,
  variants,
  onTab,
  onSeed,
}: {
  readonly tab: VariantTab;
  readonly step: { readonly subject: string; readonly body: string };
  readonly variants: readonly StepVariant[];
  readonly onTab: (tab: VariantTab) => void;
  /** Pré-remplit les variantes manquantes. `null` = rien à proposer ici. */
  readonly onSeed: null | (() => void);
}) {
  const written = new Set(
    variants.filter(isWrittenVariant).map((variant) => variant.group),
  );
  const defaultWritten = step.subject.trim() !== "" || step.body.trim() !== "";

  return (
    <div className="sm:col-span-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11.5px] font-semibold text-muted">Message pour</span>
        <TabButton active={tab === "default"} onClick={() => onTab("default")}>
          Défaut{defaultWritten ? "" : " (vide)"}
        </TabButton>
        {CONTACT_GROUPS.map((group) => (
          <TabButton key={group} active={tab === group} onClick={() => onTab(group)}>
            {GROUP_LABELS[group]}
            {written.has(group) ? "" : " ·"}
          </TabButton>
        ))}
      </div>

      <p className="mt-1.5 text-[11.5px] text-muted">
        Un groupe sans variante — marqué « · » — reçoit le message par défaut de
        l&apos;étape. C&apos;est aussi ce qui fait qu&apos;une campagne écrite avant les
        groupes se comporte exactement comme avant.
        {onSeed !== null && (
          <>
            {" "}
            <button
              type="button"
              onClick={onSeed}
              className="font-semibold text-brand-d underline hover:text-brand"
            >
              Pré-remplir les variantes de l&apos;étape 1
            </button>{" "}
            — des points de départ à retoucher, qui n&apos;écrasent rien de ce qui est
            déjà écrit.
          </>
        )}
      </p>

      {tab !== "default" && STEP_ONE_SEEDS[tab].optionalSentence !== undefined && (
        /*
          **La phrase facultative est nommée, pas retirée d'office.** Un argument
          utile à une partie des destinataires est du bruit pour les autres :
          l'installation Shopify rassure une responsable e commerce et
          n'intéresse pas une fondatrice. La signaler laisse le choix, et évite
          de la chercher dans le texte.
        */
        <p className="mt-1.5 rounded-control border border-line bg-surface-2 p-2 text-[11.5px] text-muted">
          Phrase que vous pouvez supprimer telle quelle :{" "}
          <i>« {STEP_ONE_SEEDS[tab].optionalSentence} »</i>
        </p>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-[44px] rounded-control border px-2.5 text-[12px] lg:min-h-0 lg:py-1 ${
        active
          ? "border-brand bg-brand-l font-semibold text-brand-d"
          : "border-line bg-surface text-muted hover:border-brand"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Un aperçu par groupe, sur un contact réel de ce groupe.
 *
 * Les groupes sans aucun inscrit ne sont pas rendus : un aperçu sur un contact
 * inventé montrerait toujours le cas heureux, alors que ce qu'on veut voir est
 * précisément ce que donnent les fiches réelles (jalon 87).
 */
export function GroupPreviews({
  step,
  variants,
  samples,
}: {
  readonly step: { readonly subject: string; readonly body: string };
  readonly variants: readonly StepVariant[];
  readonly samples: readonly SampleContact[];
}) {
  const byGroup = new Map<string, SampleContact>();
  for (const sample of samples) {
    const key = sample.groupSetBy === "none" ? "none" : sample.group;
    if (!byGroup.has(key)) byGroup.set(key, sample);
  }

  if (byGroup.size === 0) return null;

  return (
    <div className="mt-2 grid gap-2 sm:col-span-2">
      {[...byGroup.entries()].map(([key, sample]) => {
        const chosen = templateFor(step, variants, key === "none" ? null : key);
        return (
          <div key={key} className="rounded-card border border-line bg-surface-2 p-2.5">
            <p className="text-[11.5px] font-semibold text-muted">
              {key === "none" ? "Non classé" : GROUP_LABELS[key as ContactGroup]} ·{" "}
              {sample.name} · {describeChoice(chosen)}
            </p>
            <p className="mt-1.5 text-[11.5px] font-semibold text-muted">Objet</p>
            <p className="text-[12.5px] text-ink">
              {renderSubject(chosen.subject, sample.values)}
            </p>
            <p className="mt-1.5 text-[11.5px] font-semibold text-muted">Message</p>
            <pre className="whitespace-pre-wrap font-sans text-[12.5px] leading-relaxed text-ink">
              {renderTemplate(chosen.body, sample.values)}
            </pre>
          </div>
        );
      })}
    </div>
  );
}
